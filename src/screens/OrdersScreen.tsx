/**
 * OrdersScreen.tsx — Orders Management (Phase 3).
 *
 * Features:
 * 1. Searchable list with status filter and overdue highlight.
 * 2. Order detail page with 5 tabs: Details, Items, Design (placeholder), Payments (placeholder), Production (placeholder).
 * 3. Create new order directly (not from quotation — that path is in QuotationsScreen).
 * 4. Cancel order with mandatory reason (no hard delete).
 * 5. Status progression: confirmed → in_production → ready → delivered → closed.
 * 6. Full English + Malayalam labels.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  ArrowLeft,
  Eye,
  Loader2,
  AlertTriangle,
  X,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  CreditCard,
  Settings2,
  Paintbrush,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { ordersApi, customersApi, productsApi } from "../lib/api";
import { Order, OrderItem, Customer, Product } from "../types";
import { canManageQuotations, canViewOrders } from "../lib/permissions";
import { cn } from "../lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function isOverdue(order: Order): boolean {
  if (!order.due_date) return false;
  if (["delivered", "closed", "cancelled"].includes(order.status)) return false;
  return new Date(order.due_date) < new Date(new Date().toISOString().split("T")[0]);
}

// ── Status Badges ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  confirmed:     "bg-blue-50 text-blue-700 border-blue-200",
  in_production: "bg-violet-50 text-violet-700 border-violet-200",
  ready:         "bg-amber-50 text-amber-700 border-amber-200",
  delivered:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed:        "bg-slate-100 text-slate-600 border-slate-200",
  cancelled:     "bg-rose-50 text-rose-700 border-rose-200",
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useApp();
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
      {t(`orders.status_${status}`) || status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useApp();
  return priority === "urgent" ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
      {t("orders.priority_urgent")}
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
      {t("orders.priority_normal")}
    </span>
  );
}

// ── Empty item factory ────────────────────────────────────────────────────────

function emptyItem(): OrderItem & { _key: number } {
  return {
    _key: Date.now() + Math.random(),
    product_id: null,
    description: "",
    specification: "",
    quantity: 1,
    rate: 0,
    line_total: 0,
  } as any;
}

// ── Cancel Modal ──────────────────────────────────────────────────────────────

interface CancelModalProps {
  order: Order;
  onClose: () => void;
  onCancelled: () => void;
}

function CancelModal({ order, onClose, onCancelled }: CancelModalProps) {
  const { currentUser, t } = useApp();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!reason.trim()) { setError(t("orders.cancel_reason_required")); return; }
    if (!currentUser) return;
    setSaving(true);
    setError(null);
    try {
      await ordersApi.updateStatus({
        id: order.id,
        status: "cancelled",
        cancel_reason: reason,
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
      });
      onCancelled();
    } catch (err: any) {
      setError(err?.message ?? t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-lg font-bold text-slate-800 mb-1">{t("orders.cancel_order")}</h2>
        <p className="text-sm text-slate-500 mb-4">Cancelling order <strong>{order.order_number}</strong>. This cannot be undone.</p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /><span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("orders.cancel_reason")} <span className="text-rose-500">*</span></label>
          <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Explain why the order is being cancelled…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400" />
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">
            {t("general.cancel")}
          </button>
          <button onClick={handleCancel} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("orders.cancel_order")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Order Modal ────────────────────────────────────────────────────────

interface OrderModalProps {
  onClose: () => void;
  onSaved: (o: Order) => void;
}

function OrderModal({ onClose, onSaved }: OrderModalProps) {
  const { currentUser, t } = useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<number | "">("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [items, setItems] = useState<Array<OrderItem & { _key: number }>>([emptyItem()]);

  useEffect(() => {
    Promise.all([customersApi.list(), productsApi.list()])
      .then(([c, p]) => { setCustomers(c.filter(x => x.active === 1)); setProducts(p.filter(x => x.active === 1)); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const subtotal = items.reduce((s, it) => s + (it.line_total || 0), 0);

  function handleProductSelect(key: number, productId: number | "") {
    setItems(prev => prev.map(it => {
      if ((it as any)._key !== key) return it;
      if (!productId) return { ...it, product_id: null, description: "", rate: 0, line_total: 0 };
      const p = products.find(x => x.id === Number(productId));
      if (!p) return it;
      const rate = p.retail_price;
      return { ...it, product_id: p.id, description: p.name, rate, line_total: parseFloat((rate * it.quantity).toFixed(2)) };
    }));
  }

  function handleItemChange(key: number, field: string, value: any) {
    setItems(prev => prev.map(it => {
      if ((it as any)._key !== key) return it;
      const updated: any = { ...it, [field]: value };
      if (field === "quantity" || field === "rate") {
        const qty = field === "quantity" ? Number(value) : it.quantity;
        const rate = field === "rate" ? Number(value) : it.rate;
        updated.line_total = parseFloat((qty * rate).toFixed(2));
      }
      return updated;
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    if (!customerId) { setError("Please select a customer."); return; }
    if (items.length === 0) { setError("Add at least one item."); return; }
    for (const it of items) {
      if (!it.description.trim()) { setError("Every item must have a description."); return; }
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await ordersApi.create({
        customer_id: Number(customerId),
        order_date: orderDate,
        due_date: dueDate || undefined,
        priority,
        special_instructions: specialInstructions || undefined,
        items: items.map(it => ({
          product_id: it.product_id ?? null,
          description: it.description,
          specification: it.specification || undefined,
          quantity: it.quantity,
          rate: it.rate,
          line_total: it.line_total,
        })),
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
      });
      onSaved(saved);
    } catch (err: any) {
      setError(err?.message ?? t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-3xl my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{t("orders.add")}</h2>
              <p className="text-xs text-slate-500">New confirmed order</p>
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

            {/* Customer / dates / priority */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("orders.customer")} <span className="text-rose-500">*</span></label>
                <select value={customerId} onChange={e => setCustomerId(Number(e.target.value) || "")}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" required>
                  <option value="">— Select customer —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("orders.order_date")}</label>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("orders.due_date")}</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("orders.priority")}</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20">
                  <option value="normal">{t("orders.priority_normal")}</option>
                  <option value="urgent">{t("orders.priority_urgent")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">{t("orders.special_instructions")}</label>
                <input type="text" value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)}
                  placeholder="Any special requirements…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-700">{t("quotations.items")}</h3>
                <button type="button" onClick={() => setItems(prev => [...prev, emptyItem()])}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition">
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
                      return (
                        <tr key={key}>
                          <td className="px-2 py-2">
                            <select value={item.product_id ?? ""}
                              onChange={e => handleProductSelect(key, Number(e.target.value) || "")}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500">
                              <option value="">Free-text</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input type="text" value={item.description}
                              onChange={e => handleItemChange(key, "description", e.target.value)}
                              placeholder="Item description…"
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" />
                          </td>
                          <td className="px-2 py-2">
                            <input type="text" value={item.specification || ""}
                              onChange={e => handleItemChange(key, "specification", e.target.value)}
                              placeholder="Size…"
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" min="0.01" step="0.01" value={item.quantity}
                              onChange={e => handleItemChange(key, "quantity", parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500" />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" min="0" step="0.01" value={item.rate}
                              onChange={e => handleItemChange(key, "rate", parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500" />
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-slate-700 text-xs">{fmt(item.line_total)}</td>
                          <td className="px-2 py-2">
                            <button type="button" onClick={() => setItems(prev => prev.filter(it => (it as any)._key !== key))}
                              className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {items.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-6 text-slate-400 text-xs">{t("quotations.no_items")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-2 text-sm font-semibold text-slate-700">
                Total: <span className="ml-2">{fmt(subtotal)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button type="button" onClick={onClose} disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">
                {t("general.cancel")}
              </button>
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm transition flex items-center gap-2">
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

// ── Order Detail View ─────────────────────────────────────────────────────────

interface OrderDetailProps {
  order: Order;
  onBack: () => void;
  onRefresh: () => void;
}

type OrderTab = "details" | "items" | "design" | "payments" | "production";

function OrderDetailView({ order, onBack, onRefresh }: OrderDetailProps) {
  const { currentUser, t } = useApp();
  const [activeTab, setActiveTab] = useState<OrderTab>("details");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const canManage = currentUser ? canManageQuotations(currentUser.role) : false;
  const overdue = isOverdue(order);
  const isCancelled = order.status === "cancelled";

  // Status flow: confirmed → in_production → ready → delivered → closed
  const STATUS_FLOW: Record<string, string | null> = {
    confirmed:     "in_production",
    in_production: "ready",
    ready:         "delivered",
    delivered:     "closed",
    closed:        null,
    cancelled:     null,
  };
  const nextStatus = STATUS_FLOW[order.status];

  async function changeStatus(status: string) {
    if (!currentUser) return;
    setUpdatingStatus(true);
    try {
      await ordersApi.updateStatus({ id: order.id, status, callerRole: currentUser.role, callerUsername: currentUser.username });
      onRefresh();
    } catch (err: any) {
      alert(err?.message ?? t("general.error"));
    } finally {
      setUpdatingStatus(false);
    }
  }

  const tabs = [
    { key: "details",    label: t("orders.tab_details"),    icon: FileText },
    { key: "items",      label: t("orders.tab_items"),      icon: ShoppingBag },
    { key: "design",     label: t("orders.tab_design"),     icon: Paintbrush },
    { key: "production", label: t("orders.tab_production"), icon: Settings2 },
    { key: "payments",   label: t("orders.tab_payments"),   icon: CreditCard },
  ];

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm transition hover:bg-slate-50">
          <ArrowLeft className="w-4 h-4" /> {t("orders.back_to_list")}
        </button>

        {canManage && !isCancelled && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Advance status */}
            {nextStatus && (
              <button onClick={() => changeStatus(nextStatus)} disabled={updatingStatus}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-xl shadow-sm transition">
                {updatingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("orders.update_status")} → {t(`orders.status_${nextStatus}`)}
              </button>
            )}
            {/* Cancel */}
            <button onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-rose-700 bg-rose-50 px-4 py-2 rounded-xl border border-rose-200 hover:bg-rose-100 transition">
              <XCircle className="w-4 h-4" /> {t("orders.cancel_order")}
            </button>
          </div>
        )}
      </div>

      {/* Header card */}
      <div className={cn("rounded-2xl border shadow-sm p-6", overdue ? "bg-rose-50 border-rose-200" : "bg-white border-slate-100")}>
        <div className="flex flex-wrap gap-4 justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">{order.order_number}</h1>
              <StatusBadge status={order.status} />
              <PriorityBadge priority={order.priority} />
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-600 text-white">
                  <Clock className="w-3 h-3" /> {t("orders.overdue")}
                </span>
              )}
            </div>
            <p className="text-slate-600 font-semibold">{order.customer_name}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              <span>Order Date: <strong className="text-slate-700">{order.order_date}</strong></span>
              {order.due_date && <span>Due: <strong className={cn(overdue ? "text-rose-700" : "text-slate-700")}>{order.due_date}</strong></span>}
              {order.quotation_id && <span className="text-indigo-600">{t("orders.from_quotation")}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Total</p>
            <p className="text-3xl font-bold text-slate-800">{fmt(order.total)}</p>
          </div>
        </div>
        {isCancelled && order.cancel_reason && (
          <div className="mt-3 p-3 rounded-xl bg-rose-100 border border-rose-200 text-rose-800 text-sm">
            <strong>Cancelled:</strong> {order.cancel_reason}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-4 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key as OrderTab;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as OrderTab)}
              className={cn("flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition -mb-px whitespace-nowrap",
                isActive ? "border-amber-600 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Details */}
      {activeTab === "details" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Order Info</h3>
            {[
              ["Order Number", order.order_number],
              ["Customer", order.customer_name ?? "—"],
              ["Order Date", order.order_date],
              ["Due Date", order.due_date ?? "—"],
              ["Priority", order.priority],
              ["Status", order.status],
              ["From Quotation", order.quotation_id ? `QT / ID #${order.quotation_id}` : "—"],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-1 border-b border-slate-50 text-sm">
                <span className="text-slate-500">{label}:</span>
                <span className="font-semibold text-slate-700 capitalize">{val}</span>
              </div>
            ))}
          </div>
          {order.special_instructions && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t("orders.special_instructions")}</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{order.special_instructions}</p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2 text-xs text-slate-600">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Audit</h3>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">{t("general.created_by")}:</span>
              <span className="font-semibold">{order.created_by}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">{t("general.created_at")}:</span>
              <span>{new Date(order.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">{t("general.updated_by")}:</span>
              <span className="font-semibold">{order.updated_by}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Items */}
      {activeTab === "items" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
              {(order.items || []).map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                  <td className="px-5 py-3 font-medium text-slate-800">{item.description}</td>
                  <td className="px-5 py-3 text-slate-500">{item.specification || "—"}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{item.quantity}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{fmt(item.rate)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmt(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50/70">
              <tr>
                <td colSpan={5} className="px-5 py-3 text-right font-bold text-slate-800">Total</td>
                <td className="px-5 py-3 text-right font-bold text-lg text-slate-800">{fmt(order.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Placeholder tabs */}
      {(activeTab === "design" || activeTab === "production" || activeTab === "payments") && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">🚧</div>
          <h3 className="text-lg font-bold text-slate-800">
            {activeTab === "design" ? t("orders.tab_design") : activeTab === "production" ? t("orders.tab_production") : t("orders.tab_payments")}
          </h3>
          <p className="text-sm text-slate-500 mt-1">This module will be built in a future phase.</p>
          <span className="mt-4 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Coming soon</span>
        </div>
      )}

      {showCancelModal && (
        <CancelModal order={order} onClose={() => setShowCancelModal(false)} onCancelled={() => { setShowCancelModal(false); onRefresh(); }} />
      )}
    </div>
  );
}

// ── Main Orders Screen ────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const { currentUser, t } = useApp();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);

  const canManage = currentUser ? canManageQuotations(currentUser.role) : false;

  const loadOrders = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const list = await ordersApi.list(undefined, currentUser.role);
      setOrders(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  async function refreshView(id: number) {
    try {
      const updated = await ordersApi.get(id);
      setViewOrder(updated);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o));
    } catch {}
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      const matchSearch = !q || o.order_number.toLowerCase().includes(q) || (o.customer_name ?? "").toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, search, filterStatus]);

  if (viewOrder) {
    return <OrderDetailView order={viewOrder} onBack={() => setViewOrder(null)} onRefresh={() => refreshView(viewOrder.id)} />;
  }

  const statuses = ["all", "confirmed", "in_production", "ready", "delivered", "closed", "cancelled"];

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t("orders.title")}</h1>
            <p className="text-sm text-slate-500">{t("orders.subtitle")}</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" />{t("orders.add")}
          </button>
        )}
      </div>

      {/* Search + status filter */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t("orders.search_placeholder")}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
        </div>
        <div className="flex items-center rounded-xl border border-slate-200 p-0.5 text-xs font-medium text-slate-600 overflow-x-auto">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn("px-3 py-1.5 rounded-lg capitalize transition whitespace-nowrap",
                filterStatus === s ? "bg-amber-600 text-white shadow-xs" : "hover:text-slate-900")}>
              {s === "all" ? t("general.all") : (t(`orders.status_${s}`) || s)}
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
                  <th className="px-5 py-3.5">{t("orders.number")}</th>
                  <th className="px-5 py-3.5">{t("orders.customer")}</th>
                  <th className="px-5 py-3.5">{t("orders.order_date")}</th>
                  <th className="px-5 py-3.5">{t("orders.due_date")}</th>
                  <th className="px-5 py-3.5">{t("orders.priority")}</th>
                  <th className="px-5 py-3.5">{t("orders.status")}</th>
                  <th className="px-5 py-3.5 text-right">{t("orders.total")}</th>
                  <th className="px-5 py-3.5 text-right">{t("general.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(o => {
                  const overdue = isOverdue(o);
                  return (
                    <tr key={o.id}
                      onClick={() => { ordersApi.get(o.id).then(full => setViewOrder(full)); }}
                      className={cn("hover:bg-slate-50/60 transition cursor-pointer group", overdue && "bg-rose-50/40")}>
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-amber-700">{o.order_number}</td>
                      <td className="px-5 py-4 font-semibold text-slate-800 group-hover:text-amber-600 transition">{o.customer_name}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{o.order_date}</td>
                      <td className="px-5 py-4 text-xs">
                        {o.due_date ? (
                          <span className={cn("font-medium", overdue ? "text-rose-700" : "text-slate-600")}>
                            {overdue && <Clock className="w-3 h-3 inline mr-1" />}{o.due_date}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-4"><PriorityBadge priority={o.priority} /></td>
                      <td className="px-5 py-4"><StatusBadge status={o.status} /></td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-700">{fmt(o.total)}</td>
                      <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { ordersApi.get(o.id).then(full => setViewOrder(full)); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                          title={t("orders.view_details")}>
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">{t("orders.empty")}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <OrderModal
          onClose={() => setShowModal(false)}
          onSaved={async () => { setShowModal(false); await loadOrders(); }}
        />
      )}
    </div>
  );
}

