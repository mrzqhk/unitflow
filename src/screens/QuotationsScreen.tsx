/**
 * QuotationsScreen.tsx — Quotations Management (Phase 3).
 *
 * Features:
 * 1. Searchable list with status filter.
 * 2. Create / Edit modal — pick customer, add items, auto-fill price by customer type & slab.
 * 3. Auto-calculates subtotal, discount, tax, grand total.
 * 4. Only owner/admin can override a rate below standard (reason required).
 * 5. Only draft quotations can be edited.
 * 6. Status management: draft → sent → accepted / rejected / expired.
 * 7. "Convert to Order" button on accepted quotations.
 * 8. PDF export via browser print.
 * 9. Full English + Malayalam labels.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Plus,
  Search,
  ArrowLeft,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Printer,
  X,
  Lock,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { quotationsApi, ordersApi, customersApi, productsApi } from "../lib/api";
import { Quotation, QuotationItem, Customer, Product } from "../types";
import { canManageQuotations, canOverridePrice } from "../lib/permissions";
import { cn } from "../lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick the correct base rate for a product given customer type and quantity. */
function resolveRate(product: Product, customerType: string, qty: number): number {
  if (customerType === "wholesale") {
    // Find the best matching slab (highest min_qty that is <= qty)
    const slabs = (product.slabs || []).slice().sort((a, b) => b.min_quantity - a.min_quantity);
    for (const slab of slabs) {
      if (qty >= slab.min_quantity) return slab.price;
    }
    return product.wholesale_price;
  }
  return product.retail_price;
}

/** Format currency. */
const fmt = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Status Badges ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-slate-100 text-slate-600 border-slate-200",
  sent:     "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  expired:  "bg-amber-50 text-amber-700 border-amber-200",
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useApp();
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
      {t(`quotations.status_${status}`) || status}
    </span>
  );
}

// ── Empty line item factory ───────────────────────────────────────────────────

function emptyItem(): QuotationItem & { _key: number } {
  return {
    _key: Date.now() + Math.random(),
    product_id: null,
    description: "",
    specification: "",
    quantity: 1,
    rate: 0,
    line_total: 0,
    price_override: 0,
    override_reason: "",
  } as any;
}

// ── Quotation Form Modal ──────────────────────────────────────────────────────

interface QuotationModalProps {
  editQuotation?: Quotation | null;
  onClose: () => void;
  onSaved: (q: Quotation) => void;
}

function QuotationModal({ editQuotation, onClose, onSaved }: QuotationModalProps) {
  const { currentUser, t } = useApp();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [customerId, setCustomerId] = useState<number | "">(editQuotation?.customer_id ?? "");
  const [date, setDate] = useState(editQuotation?.date ?? new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState(editQuotation?.valid_until ?? "");
  const [discount, setDiscount] = useState(editQuotation?.discount ?? 0);
  const [taxPercent, setTaxPercent] = useState(editQuotation?.tax_percent ?? 0);
  const [notes, setNotes] = useState(editQuotation?.notes ?? "");
  const [terms, setTerms] = useState(editQuotation?.terms ?? "");

  // Items with a local _key for React list rendering
  const [items, setItems] = useState<Array<QuotationItem & { _key: number }>>(
    editQuotation?.items?.map(it => ({ ...it, _key: Date.now() + Math.random() } as any)) ?? [emptyItem()]
  );

  // Load customers and products once
  useEffect(() => {
    Promise.all([customersApi.list(), productsApi.list()])
      .then(([c, p]) => {
        setCustomers(c.filter(x => x.active === 1));
        setProducts(p.filter(x => x.active === 1));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectedCustomer = customers.find(c => c.id === customerId);
  const customerType = selectedCustomer?.customer_type ?? "retail";

  // Totals
  const subtotal = items.reduce((s, it) => s + (it.line_total || 0), 0);
  const discountAmt = (subtotal * discount) / 100;
  const taxAmt = ((subtotal - discountAmt) * taxPercent) / 100;
  const grandTotal = subtotal - discountAmt + taxAmt;

  /** When a product is selected on a line, auto-fill description and rate. */
  function handleProductSelect(key: number, productId: number | "") {
    setItems(prev =>
      prev.map(it => {
        if ((it as any)._key !== key) return it;
        if (!productId) return { ...it, product_id: null, description: "", rate: 0, line_total: 0 };
        const p = products.find(x => x.id === Number(productId));
        if (!p) return it;
        const rate = resolveRate(p, customerType, it.quantity);
        return {
          ...it,
          product_id: p.id,
          description: p.name,
          rate,
          line_total: parseFloat((rate * it.quantity).toFixed(2)),
          price_override: 0,
          override_reason: "",
        };
      })
    );
  }

  /** Handle any item field change, recalculate line_total and check for price override. */
  function handleItemChange(key: number, field: string, value: any) {
    setItems(prev =>
      prev.map(it => {
        if ((it as any)._key !== key) return it;
        const updated: any = { ...it, [field]: value };

        // Recalculate line total on qty/rate change
        if (field === "quantity" || field === "rate") {
          const qty = field === "quantity" ? Number(value) : it.quantity;
          const rate = field === "rate" ? Number(value) : it.rate;
          updated.line_total = parseFloat((qty * rate).toFixed(2));

          // If rate was manually changed, check if below standard
          if (field === "rate" && it.product_id) {
            const p = products.find(x => x.id === it.product_id);
            if (p) {
              const standardRate = resolveRate(p, customerType, qty);
              updated.price_override = Number(value) < standardRate ? 1 : 0;
            }
          }
        }

        // Also recalculate when qty changes with product
        if (field === "quantity" && it.product_id) {
          const p = products.find(x => x.id === it.product_id);
          if (p) {
            const newQty = Number(value);
            const newRate = resolveRate(p, customerType, newQty);
            // Only auto-update rate if not already overridden
            if (!it.price_override) {
              updated.rate = newRate;
              updated.line_total = parseFloat((newRate * newQty).toFixed(2));
            }
          }
        }

        return updated;
      })
    );
  }

  function addItem() {
    setItems(prev => [...prev, emptyItem()]);
  }

  function removeItem(key: number) {
    setItems(prev => prev.filter(it => (it as any)._key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    if (!customerId) { setError("Please select a customer."); return; }
    if (items.length === 0) { setError("Add at least one item."); return; }
    for (const it of items) {
      if (!it.description.trim()) { setError("Every item must have a description."); return; }
      if (it.price_override && !canOverridePrice(currentUser.role)) {
        setError("Only owner or admin can set a rate below the standard price."); return;
      }
      if (it.price_override && !it.override_reason?.trim()) {
        setError("Please provide a reason for the price override on each discounted item."); return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        customer_id: Number(customerId),
        date,
        valid_until: validUntil || undefined,
        discount,
        tax_percent: taxPercent,
        notes: notes || undefined,
        terms: terms || undefined,
        items: items.map(it => ({
          product_id: it.product_id ?? null,
          description: it.description,
          specification: it.specification || undefined,
          quantity: it.quantity,
          rate: it.rate,
          line_total: it.line_total,
          price_override: Boolean(it.price_override),
          override_reason: it.override_reason || undefined,
        })),
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
      };

      const saved = editQuotation
        ? await quotationsApi.update({ id: editQuotation.id, ...payload })
        : await quotationsApi.create(payload);

      onSaved(saved);
    } catch (err: any) {
      setError(err?.message ?? t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {editQuotation ? t("quotations.edit") : t("quotations.add")}
              </h2>
              <p className="text-xs text-slate-500">
                {editQuotation ? editQuotation.quotation_number : "New quotation — draft status"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span>
              </div>
            )}

            {/* Customer + Date row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("quotations.customer")} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={customerId}
                  onChange={e => setCustomerId(Number(e.target.value) || "")}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                >
                  <option value="">— Select customer —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>
                  ))}
                </select>
                {selectedCustomer && (
                  <p className="text-xs text-indigo-600 mt-1 font-medium capitalize">{selectedCustomer.customer_type} customer</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("quotations.date")}</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("quotations.valid_until")}</label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-700">{t("quotations.items")}</h3>
                <button type="button" onClick={addItem}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">
                  <Plus className="w-3.5 h-3.5" />{t("quotations.add_item")}
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5 text-left w-40">{t("quotations.product")}</th>
                      <th className="px-3 py-2.5 text-left">{t("quotations.description")}</th>
                      <th className="px-3 py-2.5 text-left w-28">{t("quotations.specification")}</th>
                      <th className="px-3 py-2.5 text-right w-16">{t("quotations.qty")}</th>
                      <th className="px-3 py-2.5 text-right w-24">{t("quotations.rate")}</th>
                      <th className="px-3 py-2.5 text-right w-24">{t("quotations.line_total")}</th>
                      <th className="px-3 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(item => {
                      const key = (item as any)._key;
                      const isOverride = Boolean(item.price_override);
                      const canOverride = currentUser ? canOverridePrice(currentUser.role) : false;
                      return (
                        <React.Fragment key={key}>
                          <tr className="group">
                            {/* Product picker */}
                            <td className="px-2 py-2">
                              <select
                                value={item.product_id ?? ""}
                                onChange={e => handleProductSelect(key, Number(e.target.value) || "")}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">Free-text</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </td>
                            {/* Description */}
                            <td className="px-2 py-2">
                              <input type="text" value={item.description}
                                onChange={e => handleItemChange(key, "description", e.target.value)}
                                placeholder="Item description…"
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </td>
                            {/* Specification */}
                            <td className="px-2 py-2">
                              <input type="text" value={item.specification || ""}
                                onChange={e => handleItemChange(key, "specification", e.target.value)}
                                placeholder="Size, colour…"
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </td>
                            {/* Qty */}
                            <td className="px-2 py-2">
                              <input type="number" min="0.01" step="0.01" value={item.quantity}
                                onChange={e => handleItemChange(key, "quantity", parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </td>
                            {/* Rate */}
                            <td className="px-2 py-2">
                              <div className="relative">
                                <input type="number" min="0" step="0.01" value={item.rate}
                                  onChange={e => handleItemChange(key, "rate", parseFloat(e.target.value) || 0)}
                                  className={cn(
                                    "w-full px-2 py-1.5 rounded-lg border text-xs text-right focus:outline-none focus:ring-1",
                                    isOverride ? "border-amber-400 bg-amber-50 focus:ring-amber-400" : "border-slate-200 focus:ring-indigo-500"
                                  )} />
                                {isOverride && <Lock className="w-3 h-3 text-amber-500 absolute right-1.5 top-2" />}
                              </div>
                            </td>
                            {/* Line total */}
                            <td className="px-2 py-2 text-right font-semibold text-slate-700 text-xs">
                              {fmt(item.line_total)}
                            </td>
                            {/* Remove */}
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => removeItem(key)}
                                className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                          {/* Override reason row */}
                          {isOverride && (
                            <tr className="bg-amber-50/50">
                              <td colSpan={7} className="px-4 py-1.5">
                                <div className="flex items-center gap-2 text-xs text-amber-800">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  {canOverride ? (
                                    <input
                                      type="text"
                                      placeholder={t("quotations.override_reason") + " (required)"}
                                      value={item.override_reason || ""}
                                      onChange={e => handleItemChange(key, "override_reason", e.target.value)}
                                      className="flex-1 px-2 py-1 rounded border border-amber-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                                    />
                                  ) : (
                                    <span className="text-rose-600 font-semibold">
                                      {t("quotations.price_override_label")} Only owner/admin can apply.
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-400 text-xs">
                          {t("quotations.no_items")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discount / Tax / Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("quotations.discount")}</label>
                    <input type="number" min="0" max="100" step="0.5" value={discount}
                      onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("quotations.tax")}</label>
                    <input type="number" min="0" max="100" step="0.5" value={taxPercent}
                      onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("quotations.notes")}</label>
                  <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("quotations.terms")}</label>
                  <textarea rows={2} value={terms} onChange={e => setTerms(e.target.value)}
                    placeholder="e.g. Payment within 15 days, subject to availability…"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>

              {/* Totals box */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-2 text-sm self-start">
                <div className="flex justify-between text-slate-600">
                  <span>{t("quotations.subtotal")}</span>
                  <span className="font-semibold">{fmt(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount ({discount}%)</span>
                    <span>−{fmt(discountAmt)}</span>
                  </div>
                )}
                {taxPercent > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({taxPercent}%)</span>
                    <span>+{fmt(taxAmt)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between text-slate-800 font-bold text-base">
                  <span>{t("quotations.grand_total")}</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button type="button" onClick={onClose} disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">
                {t("general.cancel")}
              </button>
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("general.save")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Convert-to-Order Modal ────────────────────────────────────────────────────

interface ConvertModalProps {
  quotation: Quotation;
  onClose: () => void;
  onConverted: (order: any) => void;
}

function ConvertModal({ quotation, onClose, onConverted }: ConvertModalProps) {
  const { currentUser, t } = useApp();
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    if (!currentUser) return;
    setSaving(true);
    setError(null);
    try {
      const order = await ordersApi.convertFromQuotation({
        quotation_id: quotation.id,
        due_date: dueDate || undefined,
        priority,
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
      });
      onConverted(order);
    } catch (err: any) {
      setError(err?.message ?? t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-lg font-bold text-slate-800 mb-1">{t("quotations.convert_to_order")}</h2>
        <p className="text-sm text-slate-500 mb-4">Converting quotation <strong>{quotation.quotation_number}</strong> into a confirmed order.</p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /><span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("quotations.due_date_modal")}</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("orders.priority")}</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="normal">{t("orders.priority_normal")}</option>
              <option value="urgent">{t("orders.priority_urgent")}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">
            {t("general.cancel")}
          </button>
          <button onClick={handleConvert} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("quotations.convert_to_order")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PDF Export ────────────────────────────────────────────────────────────────

function exportPDF(quotation: Quotation, t: (k: string) => string) {
  const html = `
    <!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${quotation.quotation_number}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Noto Sans Malayalam', 'Nirmala UI', 'Kartika', 'Manjari', 'Gayathri', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        margin: 40px;
        color: #1e293b;
        font-size: 13px;
        line-height: 1.5;
      }
      h1 { font-size: 22px; color: #4f46e5; margin-bottom: 4px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
      .company { font-size: 20px; font-weight: 700; color: #1e293b; }
      .meta { text-align: right; font-size: 12px; color: #64748b; }
      .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 6px; margin-top: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      thead { background: #f8fafc; }
      th { padding: 8px 10px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0; }
      th.r, td.r { text-align: right; }
      td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
      .total-row td { font-weight: 700; border-top: 2px solid #e2e8f0; font-size: 14px; }
      .footer { margin-top: 30px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    </style>
    </head><body>
    <div class="header">
      <div>
        <div class="company">UnitFlow</div>
        <div style="color:#64748b;font-size:12px;">Manufacturing Management System</div>
      </div>
      <div class="meta">
        <div style="font-size:18px;font-weight:700;color:#4f46e5">${quotation.quotation_number}</div>
        <div>${t("quotations.date")}: ${quotation.date}</div>
        ${quotation.valid_until ? `<div>${t("quotations.valid_until")}: ${quotation.valid_until}</div>` : ""}
        <div style="margin-top:4px;padding:3px 8px;background:#f1f5f9;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase">${t(`quotations.status_${quotation.status}`) || quotation.status}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div>
        <div class="section-title">${t("quotations.customer")}</div>
        <div style="font-weight:600">${quotation.customer_name ?? ""}</div>
        ${quotation.billing_address ? `<div style="color:#64748b;font-size:12px;white-space:pre-wrap">${quotation.billing_address}</div>` : ""}
        ${quotation.gst_number ? `<div style="color:#64748b;font-size:12px;">GST: ${quotation.gst_number}</div>` : ""}
      </div>
    </div>

    <div class="section-title">${t("quotations.items")}</div>
    <table>
      <thead>
        <tr>
          <th>#</th><th>${t("quotations.description")}</th><th>${t("quotations.specification")}</th>
          <th class="r">${t("quotations.qty")}</th><th class="r">${t("quotations.rate")}</th><th class="r">${t("quotations.line_total")}</th>
        </tr>
      </thead>
      <tbody>
        ${(quotation.items || []).map((it, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${it.description}</td>
            <td>${it.specification || "—"}</td>
            <td class="r">${it.quantity}</td>
            <td class="r">₹${Number(it.rate).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="r">₹${Number(it.line_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>`).join("")}
      </tbody>
      <tfoot>
        <tr><td colspan="5" class="r" style="font-size:11px;color:#64748b">${t("quotations.subtotal")}</td><td class="r">₹${Number(quotation.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
        ${quotation.discount ? `<tr><td colspan="5" class="r" style="font-size:11px;color:#64748b">${t("quotations.discount")} (${quotation.discount}%)</td><td class="r" style="color:#16a34a">−₹${((quotation.subtotal * quotation.discount) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>` : ""}
        ${quotation.tax_percent ? `<tr><td colspan="5" class="r" style="font-size:11px;color:#64748b">${t("quotations.tax")} (${quotation.tax_percent}%)</td><td class="r">+₹${(((quotation.subtotal - (quotation.subtotal * quotation.discount) / 100) * quotation.tax_percent) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>` : ""}
        <tr class="total-row"><td colspan="5" class="r">${t("quotations.grand_total")}</td><td class="r">₹${Number(quotation.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
      </tfoot>
    </table>

    ${quotation.terms ? `<div class="section-title" style="margin-top:20px">${t("quotations.terms")}</div><div style="font-size:12px;color:#475569">${quotation.terms}</div>` : ""}
    ${quotation.notes ? `<div class="section-title">${t("quotations.notes")}</div><div style="font-size:12px;color:#475569">${quotation.notes}</div>` : ""}

    <div class="footer">Generated by UnitFlow &bull; ${new Date().toLocaleDateString()}</div>
    </body></html>
  `;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }
}

// ── Quotation Detail View ─────────────────────────────────────────────────────

interface QuotationDetailProps {
  quotation: Quotation;
  onBack: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}

function QuotationDetailView({ quotation, onBack, onEdit, onRefresh }: QuotationDetailProps) {
  const { currentUser, t } = useApp();
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const canManage = currentUser ? canManageQuotations(currentUser.role) : false;
  const isDraft = quotation.status === "draft";
  const isAccepted = quotation.status === "accepted";
  const hasLinkedOrder = Boolean(quotation.linked_order_id);

  async function changeStatus(status: string) {
    if (!currentUser) return;
    setUpdatingStatus(true);
    try {
      await quotationsApi.updateStatus({ id: quotation.id, status, callerRole: currentUser.role, callerUsername: currentUser.username });
      onRefresh();
    } catch (err: any) {
      alert(err?.message ?? t("general.error"));
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm transition hover:bg-slate-50">
          <ArrowLeft className="w-4 h-4" /> {t("quotations.back_to_list")}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export PDF */}
          <button onClick={() => exportPDF(quotation, t)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition">
            <Printer className="w-4 h-4" /> {t("quotations.export_pdf")}
          </button>

          {/* Edit — only in draft */}
          {canManage && isDraft && (
            <button onClick={onEdit}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition">
              <Pencil className="w-4 h-4" /> {t("quotations.edit")}
            </button>
          )}

          {/* Status actions */}
          {canManage && (
            <>
              {quotation.status === "draft" && (
                <button onClick={() => changeStatus("sent")} disabled={updatingStatus}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 hover:bg-blue-100 transition">
                  {t("quotations.mark_sent")}
                </button>
              )}
              {quotation.status === "sent" && (
                <>
                  <button onClick={() => changeStatus("accepted")} disabled={updatingStatus}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition">
                    <CheckCircle2 className="w-4 h-4" /> {t("quotations.mark_accepted")}
                  </button>
                  <button onClick={() => changeStatus("rejected")} disabled={updatingStatus}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-rose-700 bg-rose-50 px-4 py-2 rounded-xl border border-rose-200 hover:bg-rose-100 transition">
                    <XCircle className="w-4 h-4" /> {t("quotations.mark_rejected")}
                  </button>
                </>
              )}
              {quotation.status === "draft" || quotation.status === "sent" ? (
                <button onClick={() => changeStatus("expired")} disabled={updatingStatus}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200 hover:bg-amber-100 transition">
                  {t("quotations.mark_expired")}
                </button>
              ) : null}

              {/* Convert to order */}
              {isAccepted && !hasLinkedOrder && (
                <button onClick={() => setShowConvertModal(true)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl shadow-sm transition">
                  <ShoppingBag className="w-4 h-4" /> {t("quotations.convert_to_order")}
                </button>
              )}
              {isAccepted && hasLinkedOrder && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" /> {t("quotations.linked_order")} linked
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-wrap gap-4 justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">{quotation.quotation_number}</h1>
              <StatusBadge status={quotation.status} />
            </div>
            <p className="text-slate-600 font-semibold">{quotation.customer_name}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              <span>Date: <strong className="text-slate-700">{quotation.date}</strong></span>
              {quotation.valid_until && <span>Valid Until: <strong className="text-slate-700">{quotation.valid_until}</strong></span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">{t("quotations.grand_total")}</p>
            <p className="text-3xl font-bold text-slate-800">{fmt(quotation.total)}</p>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h3 className="text-sm font-bold text-slate-700">{t("quotations.items")}</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">#</th>
              <th className="px-5 py-3 text-left">{t("quotations.description")}</th>
              <th className="px-5 py-3 text-left">{t("quotations.specification")}</th>
              <th className="px-5 py-3 text-right">{t("quotations.qty")}</th>
              <th className="px-5 py-3 text-right">{t("quotations.rate")}</th>
              <th className="px-5 py-3 text-right">{t("quotations.line_total")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(quotation.items || []).map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="px-5 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                <td className="px-5 py-3 font-medium text-slate-800">
                  {item.description}
                  {item.price_override ? (
                    <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">override{item.override_reason ? `: ${item.override_reason}` : ""}</span>
                  ) : null}
                </td>
                <td className="px-5 py-3 text-slate-500">{item.specification || "—"}</td>
                <td className="px-5 py-3 text-right text-slate-700">{item.quantity}</td>
                <td className="px-5 py-3 text-right text-slate-700">{fmt(item.rate)}</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50/70">
            <tr>
              <td colSpan={5} className="px-5 py-2 text-right text-xs text-slate-500">{t("quotations.subtotal")}</td>
              <td className="px-5 py-2 text-right font-semibold">{fmt(quotation.subtotal)}</td>
            </tr>
            {quotation.discount > 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-1 text-right text-xs text-slate-500">Discount ({quotation.discount}%)</td>
                <td className="px-5 py-1 text-right text-emerald-700">−{fmt((quotation.subtotal * quotation.discount) / 100)}</td>
              </tr>
            )}
            {quotation.tax_percent > 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-1 text-right text-xs text-slate-500">Tax ({quotation.tax_percent}%)</td>
                <td className="px-5 py-1 text-right">+{fmt(((quotation.subtotal - (quotation.subtotal * quotation.discount) / 100) * quotation.tax_percent) / 100)}</td>
              </tr>
            )}
            <tr className="border-t border-slate-200">
              <td colSpan={5} className="px-5 py-3 text-right font-bold text-slate-800">{t("quotations.grand_total")}</td>
              <td className="px-5 py-3 text-right font-bold text-lg text-slate-800">{fmt(quotation.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes / Terms */}
      {(quotation.notes || quotation.terms) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quotation.notes && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t("quotations.notes")}</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}
          {quotation.terms && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t("quotations.terms")}</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{quotation.terms}</p>
            </div>
          )}
        </div>
      )}

      {/* Convert modal */}
      {showConvertModal && (
        <ConvertModal
          quotation={quotation}
          onClose={() => setShowConvertModal(false)}
          onConverted={() => { setShowConvertModal(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Main Quotations Screen ────────────────────────────────────────────────────

export default function QuotationsScreen() {
  const { currentUser, t } = useApp();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
  const [modalQuotation, setModalQuotation] = useState<Quotation | null | "new">(null);

  const canManage = currentUser ? canManageQuotations(currentUser.role) : false;

  const loadQuotations = useCallback(async () => {
    try {
      setLoading(true);
      const list = await quotationsApi.list();
      setQuotations(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQuotations(); }, [loadQuotations]);

  // Refresh a single quotation in the view (after status change)
  async function refreshView(id: number) {
    try {
      const updated = await quotationsApi.get(id);
      setViewQuotation(updated);
      setQuotations(prev => prev.map(q => q.id === id ? { ...q, ...updated } : q));
    } catch {}
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotations.filter(x => {
      const matchSearch = !q ||
        x.quotation_number.toLowerCase().includes(q) ||
        (x.customer_name ?? "").toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || x.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [quotations, search, filterStatus]);

  // ── Detail view ──────────────────────────────────────────────────────────
  if (viewQuotation) {
    return (
      <QuotationDetailView
        quotation={viewQuotation}
        onBack={() => setViewQuotation(null)}
        onEdit={() => setModalQuotation(viewQuotation)}
        onRefresh={() => refreshView(viewQuotation.id)}
      />
    );
  }

  const statuses = ["all", "draft", "sent", "accepted", "rejected", "expired"];

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t("quotations.title")}</h1>
            <p className="text-sm text-slate-500">{t("quotations.subtitle")}</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setModalQuotation("new")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" />{t("quotations.add")}
          </button>
        )}
      </div>

      {/* Search + status filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t("quotations.search_placeholder")}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
        </div>
        <div className="flex items-center rounded-xl border border-slate-200 p-0.5 text-xs font-medium text-slate-600 overflow-x-auto">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn("px-3 py-1.5 rounded-lg capitalize transition whitespace-nowrap",
                filterStatus === s ? "bg-indigo-600 text-white shadow-xs" : "hover:text-slate-900")}>
              {s === "all" ? t("general.all") : (t(`quotations.status_${s}`) || s)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />{t("general.loading")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3.5">{t("quotations.number")}</th>
                  <th className="px-5 py-3.5">{t("quotations.customer")}</th>
                  <th className="px-5 py-3.5">{t("quotations.date")}</th>
                  <th className="px-5 py-3.5">{t("quotations.valid_until")}</th>
                  <th className="px-5 py-3.5">{t("quotations.status")}</th>
                  <th className="px-5 py-3.5 text-right">{t("quotations.total")}</th>
                  <th className="px-5 py-3.5 text-right">{t("general.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(q => (
                  <tr key={q.id} onClick={() => { quotationsApi.get(q.id).then(full => setViewQuotation(full)); }}
                    className="hover:bg-slate-50/60 transition cursor-pointer group">
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-indigo-700">{q.quotation_number}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800 group-hover:text-indigo-600 transition">{q.customer_name}</td>
                    <td className="px-5 py-4 text-slate-500 text-xs">{q.date}</td>
                    <td className="px-5 py-4 text-slate-500 text-xs">{q.valid_until ?? "—"}</td>
                    <td className="px-5 py-4"><StatusBadge status={q.status} /></td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-700">{fmt(q.total)}</td>
                    <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { quotationsApi.get(q.id).then(full => setViewQuotation(full)); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                        title={t("quotations.view_details")}>
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">{t("quotations.empty")}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalQuotation && (
        <QuotationModal
          editQuotation={modalQuotation === "new" ? null : modalQuotation}
          onClose={() => setModalQuotation(null)}
          onSaved={async saved => {
            setModalQuotation(null);
            await loadQuotations();
            if (viewQuotation && viewQuotation.id === saved.id) setViewQuotation(saved);
          }}
        />
      )}
    </div>
  );
}

