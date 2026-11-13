/**
 * AccountsScreen.tsx — Accounts & Customer Dues Screen (Phase 4).
 *
 * Implements:
 * 1. Overview metrics: Total Outstanding, Overdue Customers count, Total Collections, Invoices count.
 * 2. Customer Dues table: Customers with unpaid balances sorted oldest first with days overdue.
 * 3. Quick Payment shortcut to record payment directly from the dues screen.
 * 4. Invoices Registry table: List of all invoices, print PDF (English/Malayalam), cancel invoice (owner only).
 * 5. Role guarding: Sales, owner, admin and accountant can access and record payments/invoices.
 * 6. Bilingual English and Malayalam strings.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Loader2,
  AlertTriangle,
  Clock,
  Printer,
  Ban,
  ArrowUpRight,
  TrendingDown,
  Building2,
  Phone,
  CheckCircle2,
  FileCheck2,
  CreditCard,
  UserCheck,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { accountsApi, paymentsApi, invoicesApi, ordersApi } from "../lib/api";
import {
  CustomerDue,
  DuesSummary,
  Invoice,
  PaymentMode,
  Order,
} from "../types";
import {
  canManagePayments,
  canManageInvoices,
  canCancelInvoice,
  canApproveOverpayment,
} from "../lib/permissions";
import { cn } from "../lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Invoice PDF Print Helper ─────────────────────────────────────────────────

function printInvoice(inv: Invoice, lang: "en" | "ml" = "en") {
  const isMl = lang === "ml";
  const companyName = "UNITFLOW MANUFACTURING";
  const companyTag = isMl ? "നിർമ്മാണ മാനേജ്‌മെന്റ് സിസ്റ്റം" : "Manufacturing & Production Hub";
  const companyAddr = "Industrial Estate, Ernakulam, Kerala - 682024\nGSTIN: 32ABCDE1234F1Z5 | Phone: +91 98765 43210";

  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup blocked! Please allow popups to print invoice.");
    return;
  }

  const itemsHtml = (inv.items || [])
    .map(
      (it, idx) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11px;">${idx + 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">
        ${it.description}
        ${it.specification ? `<div style="font-size: 10px; color: #64748b; font-weight: normal;">${it.specification}</div>` : ""}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155;">${it.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155;">₹${Number(it.rate || 0).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1e293b;">₹${Number(it.line_total || 0).toFixed(2)}</td>
    </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${inv.invoice_number} - Invoice</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;600;700&family=Inter:wght@400;600;700&display=swap');
    body {
      font-family: 'Noto Sans Malayalam', 'Nirmala UI', 'Inter', -apple-system, sans-serif;
      margin: 24px;
      color: #1e293b;
      font-size: 12px;
      line-height: 1.4;
    }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; }
    .company h1 { margin: 0; font-size: 20px; color: #1e3a8a; letter-spacing: -0.5px; }
    .company p { margin: 2px 0; color: #64748b; font-size: 11px; white-space: pre-line; }
    .inv-meta { text-align: right; }
    .inv-title { font-size: 22px; font-weight: bold; color: #2563eb; margin: 0; }
    .inv-no { font-family: monospace; font-size: 13px; font-weight: bold; color: #0f172a; }
    .section-title { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f8fafc; color: #475569; font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 8px; border-bottom: 2px solid #e2e8f0; }
    .totals { width: 280px; margin-left: auto; margin-top: 16px; border-collapse: collapse; }
    .totals td { padding: 4px 8px; }
    .grand-total { font-size: 14px; font-weight: bold; color: #1e3a8a; border-top: 2px solid #2563eb; border-bottom: 2px solid #2563eb; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; background: #e0f2fe; color: #0369a1; text-transform: uppercase; }
    .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { margin: 12mm 15mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; padding: 8px 16px; background: #eff6ff; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
    <span><strong>${inv.invoice_number}</strong> — ${isMl ? "ഇൻവോയ്സ് പ്രിന്റ് പ്രിവ്യൂ" : "Invoice Print Preview"}</span>
    <button onclick="window.print()" style="padding: 6px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
      ${isMl ? "പ്രിന്റ് ചെയ്യുക (Print)" : "Print Invoice"}
    </button>
  </div>

  <div class="header">
    <div class="company">
      <h1>${companyName}</h1>
      <p style="font-weight: 600; color: #2563eb;">${companyTag}</p>
      <p>${companyAddr}</p>
    </div>
    <div class="inv-meta">
      <h2 class="inv-title">${isMl ? "ടാക്സ് ഇൻവോയ്സ്" : "TAX INVOICE"}</h2>
      <p class="inv-no">${inv.invoice_number}</p>
      <p style="color: #64748b; margin: 2px 0;">${isMl ? "തീയതി" : "Date"}: <strong>${inv.date}</strong></p>
      <span class="badge">${inv.type}</span>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
    <div>
      <div class="section-title">${isMl ? "ബിൽ നൽകുന്നത് (Billed To)" : "Billed To"}</div>
      <div style="font-size: 14px; font-weight: bold; color: #0f172a;">${inv.customer_name || "Customer"}</div>
      <div style="color: #475569; font-size: 11px; margin-top: 2px;">
        ${inv.billing_address ? `<div style="white-space: pre-line;">${inv.billing_address}</div>` : ""}
        ${inv.gst_number ? `<div><strong>GSTIN:</strong> ${inv.gst_number}</div>` : ""}
      </div>
    </div>
    <div style="text-align: right;">
      <div class="section-title">${isMl ? "റഫറൻസ് (Reference)" : "Reference"}</div>
      <div style="color: #475569;">${isMl ? "ഓർഡർ നമ്പർ" : "Order No"}: <strong>${inv.order_number || "—"}</strong></div>
      <div style="color: #475569;">${isMl ? "സ്റ്റാറ്റസ്" : "Status"}: <strong style="text-transform: capitalize;">${inv.status}</strong></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 32px; text-align: center;">#</th>
        <th style="text-align: left;">${isMl ? "വിവരണം" : "Description"}</th>
        <th style="width: 60px; text-align: right;">${isMl ? "എണ്ണം" : "Qty"}</th>
        <th style="width: 90px; text-align: right;">${isMl ? "നിരക്ക്" : "Rate"}</th>
        <th style="width: 100px; text-align: right;">${isMl ? "മൊത്തം" : "Amount"}</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <table class="totals">
    <tr>
      <td style="color: #64748b;">${isMl ? "ഉപതുക (Subtotal)" : "Subtotal"}:</td>
      <td style="text-align: right; font-weight: 600;">₹${Number(inv.subtotal || 0).toFixed(2)}</td>
    </tr>
    ${
      inv.discount > 0
        ? `<tr>
      <td style="color: #64748b;">${isMl ? "കിഴിവ് (Discount)" : "Discount"}:</td>
      <td style="text-align: right; color: #dc2626;">-₹${Number(inv.discount).toFixed(2)}</td>
    </tr>`
        : ""
    }
    ${
      inv.tax_amount > 0
        ? `<tr>
      <td style="color: #64748b;">${isMl ? "നികുതി (Tax)" : `Tax (${inv.tax_percent}%)`}:</td>
      <td style="text-align: right; font-weight: 600;">+₹${Number(inv.tax_amount).toFixed(2)}</td>
    </tr>`
        : ""
    }
    <tr class="grand-total">
      <td style="padding: 8px 8px;">${isMl ? "ആകെ തുക (Grand Total)" : "Grand Total"}:</td>
      <td style="text-align: right; padding: 8px 8px;">₹${Number(inv.total || 0).toFixed(2)}</td>
    </tr>
  </table>

  <div class="footer">
    <div>${isMl ? "കമ്പ്യൂട്ടർ നിർമ്മിത ഇൻവോയ്സ്. ഒപ്പ് ആവശ്യമില്ല." : "This is a computer generated invoice and does not require a physical signature."}</div>
    <div>${isMl ? "യൂണിറ്റ്ഫ്ലോ മാനുഫാക്ചറിംഗ് സിസ്റ്റം" : "UnitFlow Manufacturing Management"}</div>
  </div>
</body>
</html>
  `;

  win.document.write(html);
  win.document.close();
}

// ── Quick Pay Modal (from Dues Screen) ────────────────────────────────────────

interface QuickPayModalProps {
  customerDue: CustomerDue;
  onClose: () => void;
  onSaved: () => void;
}

function QuickPayModal({ customerDue, onClose, onSaved }: QuickPayModalProps) {
  const { currentUser, t } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | "">("");
  const [amount, setAmount] = useState<number>(customerDue.total_balance);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [ownerApprovalReason, setOwnerApprovalReason] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentUser?.role === "owner";

  useEffect(() => {
    ordersApi.list(customerDue.customer_id).then((list) => {
      // Find orders with balance > 0
      const withBal = list.filter((o) => (o.balance_amount ?? o.total) > 0);
      setOrders(withBal);
      if (withBal.length > 0) {
        setSelectedOrderId(withBal[0].id);
        setAmount(withBal[0].balance_amount ?? withBal[0].total);
      }
      setLoadingOrders(false);
    });
  }, [customerDue.customer_id]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const orderBalance = selectedOrder ? (selectedOrder.balance_amount ?? selectedOrder.total) : customerDue.total_balance;
  const isOverpayment = amount > orderBalance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    if (!selectedOrderId) {
      setError("Please select an order for this payment.");
      return;
    }
    if (amount <= 0) {
      setError(t("payments.error_positive_amount"));
      return;
    }
    if (isOverpayment && !isOwner) {
      setError(t("payments.error_overpayment_not_allowed"));
      return;
    }
    if (isOverpayment && isOwner && !ownerApprovalReason.trim()) {
      setError(t("payments.error_overpayment_reason_required"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await paymentsApi.create({
        order_id: Number(selectedOrderId),
        customer_id: customerDue.customer_id,
        amount,
        payment_date: paymentDate,
        mode,
        reference_number: referenceNumber,
        notes,
        owner_approval_reason: isOverpayment ? ownerApprovalReason : undefined,
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
      });
      onSaved();
    } catch (err: any) {
      setError(err?.message || t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-lg font-bold text-slate-800 mb-1">{t("payments.record_title")}</h2>
        <p className="text-sm text-slate-500 mb-4">
          Customer: <strong>{customerDue.customer_name}</strong> • Total Due: <strong>{fmt(customerDue.total_balance)}</strong>
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loadingOrders ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>{t("general.loading")}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Apply To Order <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedOrderId}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSelectedOrderId(val);
                  const ord = orders.find((o) => o.id === val);
                  if (ord) setAmount(ord.balance_amount ?? ord.total);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_number} ({o.order_date}) — Bal: {fmt(o.balance_amount ?? o.total)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("payments.amount")} (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("payments.date")}
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("payments.mode")}
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as PaymentMode)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="UPI">{t("payments.mode_upi")}</option>
                  <option value="cash">{t("payments.mode_cash")}</option>
                  <option value="bank transfer">{t("payments.mode_bank_transfer")}</option>
                  <option value="cheque">{t("payments.mode_cheque")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("payments.reference_number")}
                </label>
                <input
                  type="text"
                  placeholder="UTR / Cheque #"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("payments.notes")}
              </label>
              <input
                type="text"
                placeholder="Optional notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {isOverpayment && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-2">
                <p>
                  Amount exceeds order balance ({fmt(orderBalance)}) by{" "}
                  <strong>{fmt(amount - orderBalance)}</strong>.
                </p>
                {isOwner ? (
                  <div>
                    <label className="block font-semibold uppercase tracking-wider text-amber-900 mb-1">
                      Owner Approval Reason <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Reason for overpayment"
                      value={ownerApprovalReason}
                      onChange={(e) => setOwnerApprovalReason(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-amber-300 text-xs bg-white"
                    />
                  </div>
                ) : (
                  <p className="text-rose-600 font-semibold">
                    Only owner can approve overpayments.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
              >
                {t("general.cancel")}
              </button>
              <button
                type="submit"
                disabled={saving || (isOverpayment && !isOwner)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("payments.record_btn")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Cancel Invoice Modal ──────────────────────────────────────────────────────

interface CancelInvoiceModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

function CancelInvoiceModal({ invoice, onClose, onSuccess }: CancelInvoiceModalProps) {
  const { currentUser, t } = useApp();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!reason.trim()) {
      setError(t("invoices.cancel_reason_required"));
      return;
    }
    if (!currentUser) return;
    setSaving(true);
    setError(null);
    try {
      await invoicesApi.cancel({
        id: invoice.id,
        cancel_reason: reason,
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-lg font-bold text-slate-800 mb-1">{t("invoices.cancel_title")}</h2>
        <p className="text-sm text-slate-500 mb-3">
          Cancelling invoice <strong>{invoice.invoice_number}</strong>. Rule: Only owner can cancel invoices.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t("invoices.cancel_reason")} <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for cancellation…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
          />
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
          >
            {t("general.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("general.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Accounts Screen ──────────────────────────────────────────────────────

export default function AccountsScreen() {
  const { currentUser, t } = useApp();

  const [activeTab, setActiveTab] = useState<"dues" | "invoices">("dues");
  const [dues, setDues] = useState<CustomerDue[]>([]);
  const [summary, setSummary] = useState<DuesSummary>({
    total_outstanding: 0,
    customers_with_dues: 0,
    total_invoiced: 0,
    total_collected: 0,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [payTarget, setPayTarget] = useState<CustomerDue | null>(null);
  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState<Invoice | null>(null);

  const canPay = currentUser ? canManagePayments(currentUser.role) : false;
  const canCancelInv = currentUser ? canCancelInvoice(currentUser.role) : false;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [duesData, invList] = await Promise.all([
        accountsApi.getDues(),
        invoicesApi.list(),
      ]);
      setDues(duesData.dues || []);
      setSummary(duesData.summary);
      setInvoices(invList || []);
    } catch (err) {
      console.error("Failed to load accounts data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Dues
  const filteredDues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dues;
    return dues.filter(
      (d) =>
        d.customer_name.toLowerCase().includes(q) ||
        (d.company && d.company.toLowerCase().includes(q)) ||
        d.phone.includes(q)
    );
  }, [dues, search]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.invoice_number.toLowerCase().includes(q) ||
        (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
        (inv.order_number && inv.order_number.toLowerCase().includes(q))
    );
  }, [invoices, search]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t("accounts.title")}</h1>
            <p className="text-sm text-slate-500">{t("accounts.subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("accounts.total_outstanding")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">
            {fmt(summary.total_outstanding)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">
            From {summary.customers_with_dues} customer(s)
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("accounts.total_collected")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {fmt(summary.total_collected)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Total cash received</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("accounts.total_invoiced")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-600 mt-2">
            {fmt(summary.total_invoiced)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">{invoices.length} invoices issued</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("accounts.overdue_customers")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">
            {summary.customers_with_dues}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Pending payment</span>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("dues")}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold transition",
              activeTab === "dues"
                ? "bg-primary-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {t("accounts.dues_tab")} ({dues.length})
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold transition",
              activeTab === "invoices"
                ? "bg-primary-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {t("accounts.invoices_tab")} ({invoices.length})
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === "dues"
                ? t("accounts.search_dues")
                : t("invoices.search_placeholder")
            }
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
      </div>

      {/* ── Tab: Customer Dues ────────────────────────────────────────────────── */}
      {activeTab === "dues" && (
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
                    <th className="px-5 py-3.5">{t("accounts.customer")}</th>
                    <th className="px-5 py-3.5">{t("customers.phone")}</th>
                    <th className="px-5 py-3.5">{t("customers.type")}</th>
                    <th className="px-5 py-3.5 text-center">{t("accounts.orders_count")}</th>
                    <th className="px-5 py-3.5 text-right">{t("accounts.total_billed")}</th>
                    <th className="px-5 py-3.5 text-right">{t("accounts.total_paid")}</th>
                    <th className="px-5 py-3.5 text-right">{t("accounts.balance_due")}</th>
                    <th className="px-5 py-3.5">{t("accounts.days_overdue")}</th>
                    <th className="px-5 py-3.5 text-right">{t("general.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredDues.map((d, idx) => {
                    const hasOverdue = (d.days_overdue ?? 0) > 0;
                    return (
                      <tr
                        key={d.customer_id}
                        className={cn(
                          "hover:bg-slate-50/60 transition group",
                          hasOverdue && "bg-rose-50/30"
                        )}
                      >
                        <td className="px-5 py-4 font-mono text-xs text-slate-400">{idx + 1}</td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800">{d.customer_name}</p>
                          {d.company && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3" />
                              {d.company}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-600">{d.phone}</td>
                        <td className="px-5 py-4 capitalize">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                            {d.customer_type}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center font-semibold text-slate-700">
                          {d.orders_count}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-700">
                          {fmt(d.total_billed)}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-emerald-600">
                          {fmt(d.total_paid)}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-rose-600 text-base">
                          {fmt(d.total_balance)}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {hasOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              <Clock className="w-3 h-3" /> {d.days_overdue} days
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {canPay && (
                            <button
                              onClick={() => setPayTarget(d)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
                            >
                              <Plus className="w-3 h-3" />
                              {t("payments.record_btn")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDues.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                        <p className="font-semibold text-slate-700">{t("accounts.empty_dues")}</p>
                        <p className="text-xs text-slate-400 mt-0.5">All customer accounts are clear!</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Invoices Registry ────────────────────────────────────────────── */}
      {activeTab === "invoices" && (
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
                    <th className="px-5 py-3.5">{t("invoices.number")}</th>
                    <th className="px-5 py-3.5">{t("invoices.date")}</th>
                    <th className="px-5 py-3.5">{t("quotations.customer")}</th>
                    <th className="px-5 py-3.5">{t("orders.number")}</th>
                    <th className="px-5 py-3.5">{t("invoices.type")}</th>
                    <th className="px-5 py-3.5 text-right">{t("invoices.subtotal")}</th>
                    <th className="px-5 py-3.5 text-right">{t("invoices.tax_amount")}</th>
                    <th className="px-5 py-3.5 text-right">{t("invoices.total")}</th>
                    <th className="px-5 py-3.5">{t("invoices.status")}</th>
                    <th className="px-5 py-3.5 text-right">{t("general.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredInvoices.map((inv) => {
                    const isCanc = inv.status === "cancelled";
                    return (
                      <tr
                        key={inv.id}
                        className={cn(
                          "transition",
                          isCanc ? "bg-rose-50/20 text-slate-400" : "hover:bg-slate-50/50 text-slate-700"
                        )}
                      >
                        <td className="px-5 py-4 font-mono font-bold text-primary-700 text-xs">
                          {inv.invoice_number}
                        </td>
                        <td className="px-5 py-4 text-xs">{inv.date}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800">{inv.customer_name}</td>
                        <td className="px-5 py-4 font-mono text-xs text-amber-700">
                          {inv.order_number || "—"}
                        </td>
                        <td className="px-5 py-4 capitalize text-xs">{inv.type}</td>
                        <td className="px-5 py-4 text-right font-medium">{fmt(inv.subtotal)}</td>
                        <td className="px-5 py-4 text-right font-medium">{fmt(inv.tax_amount)}</td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900">
                          {fmt(inv.total)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                              inv.status === "issued"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            )}
                          >
                            {inv.status}
                          </span>
                          {inv.cancel_reason && (
                            <span className="block text-[10px] text-rose-600 mt-0.5">
                              {inv.cancel_reason}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => printInvoice(inv, "en")}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-primary-700 hover:bg-primary-50 transition"
                              title="Print English Invoice"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => printInvoice(inv, "ml")}
                              className="px-2 py-1 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition"
                              title="Print Malayalam Invoice"
                            >
                              മലയാളം
                            </button>
                            {!isCanc && canCancelInv && (
                              <button
                                onClick={() => setCancelInvoiceTarget(inv)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Cancel Invoice (Owner Only)"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-400">
                        <FileCheck2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">{t("invoices.empty_invoices")}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {payTarget && (
        <QuickPayModal
          customerDue={payTarget}
          onClose={() => setPayTarget(null)}
          onSaved={() => {
            setPayTarget(null);
            loadData();
          }}
        />
      )}

      {cancelInvoiceTarget && (
        <CancelInvoiceModal
          invoice={cancelInvoiceTarget}
          onClose={() => setCancelInvoiceTarget(null)}
          onSuccess={() => {
            setCancelInvoiceTarget(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

