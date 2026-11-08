/**
 * CustomersScreen.tsx — Customer Management Screen & Customer Details View.
 *
 * Implements:
 * 1. Searchable, sortable customers table (search by name, company or phone).
 * 2. Add / Edit / Disable customer workflows (no hard delete).
 * 3. Add/Edit form with validation (name & phone required) and duplicate phone warning.
 * 4. Customer detail page with 4 tabs: Details, Quotations, Orders, Payments.
 * 5. Role guarding: only owner, admin, and sales can add/edit/disable customers.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Search,
  Plus,
  ArrowLeft,
  Pencil,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ShoppingBag,
  CreditCard,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileCheck,
  Coins,
  Calendar,
  Clock,
  UserCheck,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { customersApi, quotationsApi, ordersApi } from "../lib/api";
import { Customer, CustomerType, Quotation, Order } from "../types";
import { canManageCustomers } from "../lib/permissions";
import { cn } from "../lib/utils";

// ── Badges ───────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: CustomerType }) {
  return type === "wholesale" ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
      Wholesale
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      Retail
    </span>
  );
}

function StatusBadge({ active }: { active: number }) {
  return active === 1 ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
      <XCircle className="w-3 h-3 text-slate-400" /> Inactive
    </span>
  );
}

// ── Customer Form Modal (Add / Edit) ──────────────────────────────────────────

interface CustomerModalProps {
  editCustomer?: Customer | null;
  onClose: () => void;
  onSaved: (saved: Customer) => void;
}

function CustomerModal({ editCustomer, onClose, onSaved }: CustomerModalProps) {
  const { currentUser, t } = useApp();

  const [form, setForm] = useState({
    name: editCustomer?.name ?? "",
    company: editCustomer?.company ?? "",
    phone: editCustomer?.phone ?? "",
    alternate_phone: editCustomer?.alternate_phone ?? "",
    email: editCustomer?.email ?? "",
    billing_address: editCustomer?.billing_address ?? "",
    delivery_address: editCustomer?.delivery_address ?? "",
    gst_number: editCustomer?.gst_number ?? "",
    customer_type: (editCustomer?.customer_type ?? "retail") as CustomerType,
    credit_limit: editCustomer?.credit_limit ?? 0,
    notes: editCustomer?.notes ?? "",
  });

  const [sameAddress, setSameAddress] = useState(
    Boolean(
      editCustomer &&
        editCustomer.billing_address &&
        editCustomer.billing_address === editCustomer.delivery_address
    )
  );

  const [existingPhoneOwner, setExistingPhoneOwner] = useState<string | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Phone duplicate checker with debounce
  useEffect(() => {
    const trimmed = form.phone.trim();
    if (!trimmed || trimmed.length < 5) {
      setExistingPhoneOwner(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingPhone(true);
        const res = await customersApi.checkPhone(trimmed, editCustomer?.id);
        if (res) {
          setExistingPhoneOwner(res.name);
        } else {
          setExistingPhoneOwner(null);
        }
      } catch {
        setExistingPhoneOwner(null);
      } finally {
        setCheckingPhone(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.phone, editCustomer]);

  function handleChange(field: keyof typeof form, val: any) {
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      if (field === "billing_address" && sameAddress) {
        updated.delivery_address = val;
      }
      return updated;
    });
  }

  function handleSameAddressToggle(checked: boolean) {
    setSameAddress(checked);
    if (checked) {
      setForm(prev => ({ ...prev, delivery_address: prev.billing_address }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;

    if (!form.name.trim()) {
      setError(t("customers.name_required"));
      return;
    }
    if (!form.phone.trim()) {
      setError(t("customers.phone_required"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editCustomer) {
        const updated = await customersApi.update({
          id: editCustomer.id,
          ...form,
          credit_limit: Number(form.credit_limit) || 0,
          callerRole: currentUser.role,
          callerUsername: currentUser.username,
        });
        onSaved(updated);
      } else {
        const created = await customersApi.create({
          ...form,
          credit_limit: Number(form.credit_limit) || 0,
          callerRole: currentUser.role,
          callerUsername: currentUser.username,
        });
        onSaved(created);
      }
    } catch (err: any) {
      setError(err?.message ?? t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {editCustomer ? t("customers.edit") : t("customers.add")}
              </h2>
              <p className="text-xs text-slate-500">
                {editCustomer ? "Update customer profile and parameters" : "Register a new client or business account"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Duplicate Phone Warning */}
          {existingPhoneOwner && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">
                  {t("customers.phone_warning")} <strong>{existingPhoneOwner}</strong>
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You may still save if this is an authorized shared number or multi-contact branch.
                </p>
              </div>
            </div>
          )}

          {/* Section: Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("customers.name")} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => handleChange("name", e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("customers.company")}
              </label>
              <input
                type="text"
                value={form.company}
                onChange={e => handleChange("company", e.target.value)}
                placeholder="e.g. Skyline Textiles Ltd"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Section: Contact */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("customers.phone")} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={form.phone}
                  onChange={e => handleChange("phone", e.target.value)}
                  placeholder="e.g. 9847012345"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
                {checkingPhone && (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-3" />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("customers.alternate_phone")}
              </label>
              <input
                type="text"
                value={form.alternate_phone}
                onChange={e => handleChange("alternate_phone", e.target.value)}
                placeholder="Optional backup phone"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("customers.email")}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => handleChange("email", e.target.value)}
                placeholder="e.g. contact@client.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Section: Customer Type, GST & Credit Limit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("customers.type")}
              </label>
              <select
                value={form.customer_type}
                onChange={e => handleChange("customer_type", e.target.value as CustomerType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value="retail">{t("customers.retail")}</option>
                <option value="wholesale">{t("customers.wholesale")}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("customers.gst")}
              </label>
              <input
                type="text"
                value={form.gst_number}
                onChange={e => handleChange("gst_number", e.target.value.toUpperCase())}
                placeholder="e.g. 32AAAAA0000A1Z5"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("customers.credit_limit")}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={form.credit_limit || ""}
                  onChange={e => handleChange("credit_limit", parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Section: Addresses */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("customers.billing_address")}
              </label>
              <textarea
                rows={2}
                value={form.billing_address}
                onChange={e => handleChange("billing_address", e.target.value)}
                placeholder="Street address, city, pin code..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  {t("customers.delivery_address")}
                </label>
                <label className="flex items-center gap-1.5 text-xs text-primary-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sameAddress}
                    onChange={e => handleSameAddressToggle(e.target.checked)}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>{t("customers.same_as_billing")}</span>
                </label>
              </div>
              <textarea
                rows={2}
                disabled={sameAddress}
                value={sameAddress ? form.billing_address : form.delivery_address}
                onChange={e => handleChange("delivery_address", e.target.value)}
                placeholder="Destination or factory address if different..."
                className={cn(
                  "w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
                  sameAddress && "bg-slate-50 text-slate-400 cursor-not-allowed"
                )}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t("customers.notes")}
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => handleChange("notes", e.target.value)}
              placeholder="Payment terms, special preferences, contact person..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
            >
              {t("general.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("general.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Customer Detail View with 4 Tabs ──────────────────────────────────────────

interface CustomerDetailViewProps {
  customer: Customer;
  onBack: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}

function CustomerDetailView({
  customer,
  onBack,
  onEdit,
  onToggleActive,
}: CustomerDetailViewProps) {
  const { currentUser, t } = useApp();
  const [activeTab, setActiveTab] = useState<"details" | "quotations" | "orders" | "payments">("details");
  const canEdit = currentUser ? canManageCustomers(currentUser.role) : false;

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingRecords(true);
    Promise.all([
      quotationsApi.list(customer.id).catch(() => []),
      ordersApi.list(customer.id, currentUser?.role).catch(() => []),
    ]).then(([qList, oList]) => {
      if (active) {
        setQuotations(qList);
        setOrders(oList);
        setLoadingRecords(false);
      }
    });
    return () => {
      active = false;
    };
  }, [customer.id, currentUser?.role]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Top bar with back button & actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("customers.back_to_list")}
        </button>

        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition"
            >
              <Pencil className="w-4 h-4 text-slate-500" />
              {t("customers.edit")}
            </button>

            <button
              onClick={onToggleActive}
              className={cn(
                "inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border shadow-sm transition",
                customer.active === 1
                  ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              )}
            >
              {customer.active === 1 ? (
                <>
                  <XCircle className="w-4 h-4" />
                  {t("customers.disable")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {t("customers.enable")}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Hero Customer Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl shrink-0">
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-800">{customer.name}</h1>
                <TypeBadge type={customer.customer_type} />
                <StatusBadge active={customer.active} />
              </div>
              {customer.company && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-1">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>{customer.company}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-6 bg-slate-50 px-5 py-3 rounded-xl border border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Credit Limit</p>
              <p className="text-lg font-bold text-slate-800">
                ₹{Number(customer.credit_limit || 0).toLocaleString()}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</p>
              <p className="text-lg font-bold capitalize text-slate-800">{customer.customer_type}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex gap-4">
        {[
          { key: "details", label: t("customers.details_tab"), icon: UserCheck },
          { key: "quotations", label: t("customers.quotations_tab"), icon: FileText },
          { key: "orders", label: t("customers.orders_tab"), icon: ShoppingBag },
          { key: "payments", label: t("customers.payments_tab"), icon: CreditCard },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                "flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition -mb-px",
                isActive
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Details */}
      {activeTab === "details" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Details */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary-500" /> Contact Information
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Primary Phone:</span>
                <span className="font-semibold text-slate-800">{customer.phone}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Alternate Phone:</span>
                <span className="font-medium text-slate-800">{customer.alternate_phone || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Email Address:</span>
                <span className="font-medium text-slate-800">{customer.email || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">GST Number:</span>
                <span className="font-mono font-medium text-slate-800">{customer.gst_number || "—"}</span>
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-500" /> Addresses
            </h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 font-semibold mb-1">Billing Address</p>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                  {customer.billing_address || "No billing address provided."}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold mb-1">Delivery Address</p>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                  {customer.delivery_address || "No delivery address provided."}
                </p>
              </div>
            </div>
          </div>

          {/* Notes Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary-500" /> Internal Notes
            </h3>
            <p className="text-slate-700 text-sm bg-slate-50 p-3.5 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
              {customer.notes || "No internal notes recorded for this customer."}
            </p>
          </div>

          {/* Audit Metadata */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-500" /> Audit Log & History
            </h3>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">{t("general.created_by")}:</span>
                <span className="font-semibold text-slate-700">{customer.created_by}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">{t("general.created_at")}:</span>
                <span>{new Date(customer.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">{t("general.updated_by")}:</span>
                <span className="font-semibold text-slate-700">{customer.updated_by}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">{t("general.updated_at")}:</span>
                <span>{new Date(customer.updated_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Quotations */}
      {activeTab === "quotations" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loadingRecords ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>{t("general.loading")}</span>
            </div>
          ) : quotations.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t("customers.quotations_tab")}</h3>
              <p className="text-sm text-slate-500 max-w-md mt-1">{t("customers.empty_quotations")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-5 py-3.5">#</th>
                    <th className="px-5 py-3.5">{t("quotations.number")}</th>
                    <th className="px-5 py-3.5">{t("quotations.date")}</th>
                    <th className="px-5 py-3.5">{t("quotations.valid_until")}</th>
                    <th className="px-5 py-3.5">{t("quotations.status")}</th>
                    <th className="px-5 py-3.5 text-right">{t("quotations.total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {quotations.map((q, idx) => (
                    <tr key={q.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-5 py-4 font-mono font-semibold text-indigo-700">{q.quotation_number}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{q.date}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{q.valid_until || "—"}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-slate-100 text-slate-700 border border-slate-200">
                          {t(`quotations.status_${q.status}`) || q.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-800">
                        ₹{Number(q.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Orders */}
      {activeTab === "orders" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loadingRecords ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>{t("general.loading")}</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-4">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t("customers.orders_tab")}</h3>
              <p className="text-sm text-slate-500 max-w-md mt-1">{t("customers.empty_orders")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-5 py-3.5">#</th>
                    <th className="px-5 py-3.5">{t("orders.number")}</th>
                    <th className="px-5 py-3.5">{t("orders.order_date")}</th>
                    <th className="px-5 py-3.5">{t("orders.due_date")}</th>
                    <th className="px-5 py-3.5">{t("orders.priority")}</th>
                    <th className="px-5 py-3.5">{t("orders.status")}</th>
                    <th className="px-5 py-3.5 text-right">{t("orders.total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.map((o, idx) => {
                    const isOverdue =
                      o.due_date &&
                      !["delivered", "closed", "cancelled"].includes(o.status) &&
                      new Date(o.due_date) < new Date(new Date().toISOString().split("T")[0]);

                    return (
                      <tr key={o.id} className={cn("hover:bg-slate-50/50 transition", isOverdue && "bg-rose-50/30")}>
                        <td className="px-5 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-5 py-4 font-mono font-semibold text-amber-700">{o.order_number}</td>
                        <td className="px-5 py-4 text-slate-500 text-xs">{o.order_date}</td>
                        <td className="px-5 py-4 text-xs">
                          {o.due_date ? (
                            <span className={cn("font-medium", isOverdue ? "text-rose-700 font-semibold" : "text-slate-600")}>
                              {isOverdue && <Clock className="w-3 h-3 inline mr-1 text-rose-600" />}
                              {o.due_date}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize",
                              o.priority === "urgent"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            )}
                          >
                            {t(`orders.priority_${o.priority}`) || o.priority}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-slate-100 text-slate-700 border border-slate-200">
                            {t(`orders.status_${o.status}`) || o.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-800">
                          ₹{Number(o.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Payments (Placeholder) */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
            <CreditCard className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">{t("customers.payments_tab")}</h3>
          <p className="text-sm text-slate-500 max-w-md mt-1">{t("customers.empty_payments")}</p>
          <span className="mt-4 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            Phase 8 Module
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Customers Screen ─────────────────────────────────────────────────────

export default function CustomersScreen() {
  const { currentUser, t } = useApp();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "retail" | "wholesale">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  // Selection & modal states
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [modalCustomer, setModalCustomer] = useState<Customer | null | "new">(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const canManage = currentUser ? canManageCustomers(currentUser.role) : false;

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const list = await customersApi.list();
      setCustomers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Toggle active/inactive
  async function handleToggle(cust: Customer) {
    if (!currentUser) return;
    try {
      setTogglingId(cust.id);
      const newActive = cust.active === 1 ? false : true;
      await customersApi.toggleActive({
        id: cust.id,
        active: newActive,
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
      });
      await loadCustomers();
      if (viewCustomer && viewCustomer.id === cust.id) {
        setViewCustomer(prev => (prev ? { ...prev, active: newActive ? 1 : 0 } : null));
      }
    } catch (err: any) {
      alert(err?.message || "Failed to toggle status");
    } finally {
      setTogglingId(null);
    }
  }

  // Filtered and searched list
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c => {
      // Search
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        c.phone.includes(q) ||
        (c.alternate_phone && c.alternate_phone.includes(q));

      // Type
      const matchType = filterType === "all" || c.customer_type === filterType;

      // Status
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && c.active === 1) ||
        (filterStatus === "inactive" && c.active === 0);

      return matchSearch && matchType && matchStatus;
    });
  }, [customers, search, filterType, filterStatus]);

  // If viewing a detail page
  if (viewCustomer) {
    return (
      <CustomerDetailView
        customer={viewCustomer}
        onBack={() => setViewCustomer(null)}
        onEdit={() => setModalCustomer(viewCustomer)}
        onToggleActive={() => handleToggle(viewCustomer)}
      />
    );
  }

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t("customers.title")}</h1>
            <p className="text-sm text-slate-500">{t("customers.subtitle")}</p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={() => setModalCustomer("new")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            {t("customers.add")}
          </button>
        )}
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("customers.search_placeholder")}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center rounded-xl border border-slate-200 p-0.5 text-xs font-medium text-slate-600">
            {(["all", "retail", "wholesale"] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-3 py-1.5 rounded-lg capitalize transition",
                  filterType === type ? "bg-primary-600 text-white shadow-xs" : "hover:text-slate-900"
                )}
              >
                {type === "all" ? t("general.all") : t(`customers.${type}`)}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-xl border border-slate-200 p-0.5 text-xs font-medium text-slate-600">
            {(["all", "active", "inactive"] as const).map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg capitalize transition",
                  filterStatus === st ? "bg-slate-800 text-white shadow-xs" : "hover:text-slate-900"
                )}
              >
                {st === "all" ? t("general.all") : t(`customers.${st}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>{t("general.loading")}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3.5">#</th>
                  <th className="px-5 py-3.5">{t("customers.name")}</th>
                  <th className="px-5 py-3.5">{t("customers.phone")}</th>
                  <th className="px-5 py-3.5">{t("customers.type")}</th>
                  <th className="px-5 py-3.5 text-right">{t("customers.credit_limit")}</th>
                  <th className="px-5 py-3.5">{t("customers.status")}</th>
                  <th className="px-5 py-3.5 text-right">{t("general.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCustomers.map((cust, idx) => (
                  <tr
                    key={cust.id}
                    className="hover:bg-slate-50/60 transition group cursor-pointer"
                    onClick={() => setViewCustomer(cust)}
                  >
                    <td className="px-5 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <div>
                        <span className="font-semibold text-slate-800 group-hover:text-primary-600 transition">
                          {cust.name}
                        </span>
                        {cust.company && (
                          <p className="text-xs text-slate-500 font-normal">{cust.company}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">
                      <div>{cust.phone}</div>
                      {cust.email && <div className="text-slate-400 font-sans">{cust.email}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <TypeBadge type={cust.customer_type} />
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-700">
                      ₹{Number(cust.credit_limit || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge active={cust.active} />
                    </td>
                    <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details */}
                        <button
                          onClick={() => setViewCustomer(cust)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition"
                          title={t("customers.view_details")}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        {canManage && (
                          <button
                            onClick={() => setModalCustomer(cust)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            title={t("customers.edit")}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}

                        {/* Toggle active */}
                        {canManage && (
                          <button
                            onClick={() => handleToggle(cust)}
                            disabled={togglingId === cust.id}
                            className={cn(
                              "p-1.5 rounded-lg transition",
                              cust.active === 1
                                ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            )}
                            title={cust.active === 1 ? t("customers.disable") : t("customers.enable")}
                          >
                            {togglingId === cust.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            ) : cust.active === 1 ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">No customers found</p>
                      <p className="text-xs text-slate-400 mt-0.5">Try refining your search query or add a new customer.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalCustomer && (
        <CustomerModal
          editCustomer={modalCustomer === "new" ? null : modalCustomer}
          onClose={() => setModalCustomer(null)}
          onSaved={async saved => {
            setModalCustomer(null);
            await loadCustomers();
            setViewCustomer(prev => (prev && prev.id === saved.id ? saved : prev));
          }}
        />
      )}
    </div>
  );
}
