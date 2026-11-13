/**
 * OrdersScreen.tsx — Orders Management (Phase 3 + Phase 4).
 *
 * Implements:
 * 1. Searchable list with status filter, overdue highlight, and payment status badges.
 * 2. Order detail page with 5 tabs: Details, Items, Design, Payments, Production (placeholder).
 * 3. Create new order directly with customer selection and item lines.
 * 4. Cancel order with mandatory reason (no hard delete).
 * 5. Status progression: confirmed → in_production → ready → delivered → closed.
 *    - RULE 4: An order CANNOT move to "in_production" unless its latest design is approved.
 * 6. Design Tab:
 *    - Upload image or PDF files (copied to app data folder).
 *    - Version history (v1, v2...) with latest version indicator.
 *    - Preview thumbnails & open file in system viewer.
 *    - Approval actions: Mark Approved (captures who, how, when, remarks), Request Revision, Reject.
 * 7. Payments Tab:
 *    - Order total, paid amount, balance due metrics.
 *    - Auto-computed payment status badge (Unpaid, Advance Paid, Partially Paid, Paid).
 *    - Record Payment modal with overpayment protection (only owner can approve overpayment with reason).
 *    - Payment cancellation with reason (struck through, never hard deleted).
 *    - Generate Invoice button (copies order items & prices).
 *    - Invoice PDF print in English and Malayalam with font bundling.
 *    - Invoice cancellation with reason (owner only).
 * 8. English & Malayalam bilingual localization.
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
  Upload,
  ExternalLink,
  Printer,
  Ban,
  FileCheck2,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  ordersApi,
  customersApi,
  productsApi,
  designsApi,
  paymentsApi,
  invoicesApi,
} from "../lib/api";
import {
  Order,
  OrderItem,
  Customer,
  Product,
  Design,
  Payment,
  Invoice,
  DesignApprovalStatus,
  DesignApprovalMethod,
  PaymentMode,
  InvoiceType,
} from "../types";
import {
  canManageQuotations,
  canViewOrders,
  canManageDesigns,
  canManagePayments,
  canManageInvoices,
  canApproveOverpayment,
  canCancelInvoice,
} from "../lib/permissions";
import { cn } from "../lib/utils";

// ── Currency Formatter ────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function isOverdue(order: Order): boolean {
  if (!order.due_date) return false;
  if (["delivered", "closed", "cancelled"].includes(order.status)) return false;
  return new Date(order.due_date) < new Date(new Date().toISOString().split("T")[0]);
}

// ── Badges ───────────────────────────────────────────────────────────────────

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

function PaymentStatusBadge({ status }: { status?: string }) {
  const { t } = useApp();
  const st = status || "unpaid";
  const styles: Record<string, string> = {
    unpaid:         "bg-rose-50 text-rose-700 border-rose-200",
    advance_paid:   "bg-indigo-50 text-indigo-700 border-indigo-200",
    partially_paid: "bg-amber-50 text-amber-700 border-amber-200",
    paid:           "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", styles[st] ?? styles.unpaid)}>
      {t(`orders.payment_${st}`) || st}
    </span>
  );
}

function DesignStatusBadge({ status }: { status?: string }) {
  const { t } = useApp();
  if (!status) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
        {t("designs.status_none")}
      </span>
    );
  }
  const styles: Record<string, string> = {
    pending:            "bg-amber-50 text-amber-700 border-amber-200",
    approved:           "bg-emerald-50 text-emerald-700 border-emerald-200",
    revision_requested: "bg-purple-50 text-purple-700 border-purple-200",
    rejected:           "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize", styles[status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
      {t(`designs.status_${status}`) || status.replace("_", " ")}
    </span>
  );
}

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

// ── Modals ───────────────────────────────────────────────────────────────────

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
    if (!reason.trim()) {
      setError(t("orders.cancel_reason_required"));
      return;
    }
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
        <p className="text-sm text-slate-500 mb-4">
          Cancelling order <strong>{order.order_number}</strong>. This cannot be undone.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t("orders.cancel_reason")} <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why the order is being cancelled…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
          />
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
          >
            {t("general.cancel")}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("general.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Design Upload Modal ───────────────────────────────────────────────────────

interface DesignUploadModalProps {
  order: Order;
  onClose: () => void;
  onUploaded: () => void;
}

function DesignUploadModal({ order, onClose, onUploaded }: DesignUploadModalProps) {
  const { currentUser, t } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  async function handleUpload() {
    if (!file) {
      setError(t("designs.error_no_file"));
      return;
    }
    if (!currentUser) return;
    setSaving(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          await designsApi.upload({
            order_id: order.id,
            file_name: file.name,
            file_data: dataUrl,
            remarks,
            callerUsername: currentUser.username,
          });
          onUploaded();
        } catch (err: any) {
          setError(err?.message || t("general.error"));
          setSaving(false);
        }
      };
      reader.onerror = () => {
        setError("Failed to read file.");
        setSaving(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err?.message || t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-lg font-bold text-slate-800 mb-1">{t("designs.upload_title")}</h2>
        <p className="text-sm text-slate-500 mb-4">
          Order <strong>{order.order_number}</strong>
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Select Design File (Image or PDF) <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {file && (
              <p className="text-xs text-slate-500 mt-1">
                Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t("designs.remarks")}
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Design revision notes, specs, changes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
          >
            {t("general.cancel")}
          </button>
          <button
            onClick={handleUpload}
            disabled={saving || !file}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("designs.upload_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Design Approval / Review Modal ───────────────────────────────────────────

interface DesignApprovalModalProps {
  order: Order;
  design: Design;
  action: "approved" | "revision_requested" | "rejected";
  onClose: () => void;
  onSuccess: () => void;
}

function DesignApprovalModal({ order, design, action, onClose, onSuccess }: DesignApprovalModalProps) {
  const { currentUser, t } = useApp();
  const [approvedByName, setApprovedByName] = useState(order.customer_name || "");
  const [approvedOn, setApprovedOn] = useState(new Date().toISOString().split("T")[0]);
  const [approvalMethod, setApprovalMethod] = useState<DesignApprovalMethod>("WhatsApp");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleKey =
    action === "approved"
      ? "designs.mark_approved"
      : action === "revision_requested"
      ? "designs.request_revision"
      : "designs.reject";

  async function handleConfirm() {
    if (!remarks.trim()) {
      setError(t("designs.error_remarks_required"));
      return;
    }
    if (action === "approved" && !approvedByName.trim()) {
      setError("Please specify who approved the design.");
      return;
    }
    if (!currentUser) return;

    setSaving(true);
    setError(null);
    try {
      await designsApi.updateApproval({
        id: design.id,
        approval_status: action,
        approved_by_name: action === "approved" ? approvedByName : undefined,
        approved_on: action === "approved" ? approvedOn : undefined,
        approval_method: action === "approved" ? approvalMethod : undefined,
        remarks,
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
        <h2 className="text-lg font-bold text-slate-800 mb-1">{t(titleKey)}</h2>
        <p className="text-sm text-slate-500 mb-4">
          Version <strong>v{design.version_number}</strong> ({design.file_name})
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3.5">
          {action === "approved" && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("designs.approved_by_name")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={approvedByName}
                  onChange={(e) => setApprovedByName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    {t("designs.approved_on")}
                  </label>
                  <input
                    type="date"
                    value={approvedOn}
                    onChange={(e) => setApprovedOn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    {t("designs.approval_method")}
                  </label>
                  <select
                    value={approvalMethod}
                    onChange={(e) => setApprovalMethod(e.target.value as DesignApprovalMethod)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="phone">Phone Call</option>
                    <option value="in person">In Person</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t("designs.remarks")} <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter remarks/reason for this decision…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
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
            className={cn(
              "flex-1 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2",
              action === "approved"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : action === "revision_requested"
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-rose-600 hover:bg-rose-700"
            )}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("general.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Record Payment Modal ──────────────────────────────────────────────────────

interface RecordPaymentModalProps {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}

function RecordPaymentModal({ order, onClose, onSaved }: RecordPaymentModalProps) {
  const { currentUser, t } = useApp();
  const balance = Number(order.balance_amount ?? order.total);

  const [amount, setAmount] = useState<number>(balance > 0 ? balance : 0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [ownerApprovalReason, setOwnerApprovalReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentUser?.role === "owner";
  const isOverpayment = amount > balance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
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
        order_id: order.id,
        customer_id: order.customer_id,
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
          Order <strong>{order.order_number}</strong> • Balance: <strong>{fmt(balance)}</strong>
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
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
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                placeholder="UTR / Cheque # / Ref"
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
              placeholder="Payment remarks or bank details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Overpayment Warning & Reason */}
          {isOverpayment && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Overpayment Alert</span>
              </div>
              <p>
                Amount ({fmt(amount)}) exceeds remaining balance ({fmt(balance)}) by{" "}
                <strong>{fmt(amount - balance)}</strong>.
              </p>
              {isOwner ? (
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-amber-900 mb-1">
                    Owner Approval Reason <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="State reason for accepting excess payment"
                    value={ownerApprovalReason}
                    onChange={(e) => setOwnerApprovalReason(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ) : (
                <p className="text-rose-600 font-semibold">
                  Only the owner can approve payments exceeding the balance.
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
      </div>
    </div>
  );
}

// ── Cancel Payment Modal ──────────────────────────────────────────────────────

interface CancelPaymentModalProps {
  payment: Payment;
  onClose: () => void;
  onSuccess: () => void;
}

function CancelPaymentModal({ payment, onClose, onSuccess }: CancelPaymentModalProps) {
  const { currentUser, t } = useApp();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!reason.trim()) {
      setError(t("payments.cancel_reason_required"));
      return;
    }
    if (!currentUser) return;
    setSaving(true);
    setError(null);
    try {
      await paymentsApi.cancel({
        id: payment.id,
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
        <h2 className="text-lg font-bold text-slate-800 mb-1">{t("payments.cancel_title")}</h2>
        <p className="text-sm text-slate-500 mb-3">
          Cancelling payment of <strong>{fmt(payment.amount)}</strong> received on {payment.payment_date}. It will be kept struck-through in records.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t("payments.cancel_reason")} <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for cancelling this payment entry..."
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

// ── Generate Invoice Modal ────────────────────────────────────────────────────

interface GenerateInvoiceModalProps {
  order: Order;
  onClose: () => void;
  onSuccess: (inv: Invoice) => void;
}

function GenerateInvoiceModal({ order, onClose, onSuccess }: GenerateInvoiceModalProps) {
  const { currentUser, t } = useApp();
  const [type, setType] = useState<InvoiceType>("final");
  const [discount, setDiscount] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(18);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = (order.items || []).reduce((acc, it) => acc + (it.line_total || 0), 0);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = (taxable * taxPercent) / 100;
  const grandTotal = taxable + taxAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    setError(null);
    try {
      const inv = await invoicesApi.create({
        order_id: order.id,
        customer_id: order.customer_id,
        type,
        date,
        discount,
        tax_percent: taxPercent,
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
      });
      onSuccess(inv);
    } catch (err: any) {
      setError(err?.message || t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-lg font-bold text-slate-800 mb-1">{t("invoices.generate_title")}</h2>
        <p className="text-sm text-slate-500 mb-4">
          Generate invoice for Order <strong>{order.order_number}</strong> ({order.customer_name})
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("invoices.type")}
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as InvoiceType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value="advance">{t("invoices.type_advance")}</option>
                <option value="partial">{t("invoices.type_partial")}</option>
                <option value="final">{t("invoices.type_final")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("invoices.date")}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("invoices.discount")} (₹)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("invoices.tax_percent")} (%)
              </label>
              <select
                value={taxPercent}
                onChange={(e) => setTaxPercent(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value={0}>0%</option>
                <option value={5}>5% (GST)</option>
                <option value={12}>12% (GST)</option>
                <option value={18}>18% (GST)</option>
                <option value={28}>28% (GST)</option>
              </select>
            </div>
          </div>

          {/* Breakdown calculation */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-500">
              <span>{t("invoices.subtotal")}:</span>
              <span className="font-semibold text-slate-700">{fmt(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>{t("invoices.discount")}:</span>
                <span>-{fmt(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>
                {t("invoices.tax_amount")} ({taxPercent}%):
              </span>
              <span className="font-semibold text-slate-700">+{fmt(taxAmount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
              <span>{t("invoices.total")}:</span>
              <span>{fmt(grandTotal)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
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
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("invoices.generate_btn")}
            </button>
          </div>
        </form>
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
          Cancelling invoice <strong>{invoice.invoice_number}</strong>. Rule: Only owner can cancel invoices. To correct it, create a new one.
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
            placeholder="State reason for cancelling this issued invoice..."
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

// ── Create Order Modal ────────────────────────────────────────────────────────

interface OrderModalProps {
  onClose: () => void;
  onSaved: (saved: Order) => void;
}

function OrderModal({ onClose, onSaved }: OrderModalProps) {
  const { currentUser, t } = useApp();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerId, setCustomerId] = useState<number | "">("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [specialInstructions, setSpecialInstructions] = useState("");

  const [items, setItems] = useState<Array<OrderItem & { _key: number }>>([emptyItem()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([customersApi.list(), productsApi.list()])
      .then(([c, p]) => {
        setCustomers(c.filter((x) => x.active === 1));
        setProducts(p.filter((x) => x.active === 1));
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId]
  );

  function handleProductSelect(idx: number, productId: number | null) {
    setItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[idx] };
      it.product_id = productId;
      if (productId) {
        const prod = products.find((p) => p.id === productId);
        if (prod) {
          it.description = prod.name;
          it.specification = prod.specification ?? "";
          const isWholesale = selectedCustomer?.customer_type === "wholesale";
          it.rate = isWholesale ? prod.wholesale_price : prod.retail_price;
          it.line_total = it.quantity * it.rate;
        }
      }
      copy[idx] = it;
      return copy;
    });
  }

  function handleItemChange(idx: number, field: keyof OrderItem, val: any) {
    setItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[idx], [field]: val };
      if (field === "quantity" || field === "rate") {
        const q = field === "quantity" ? Number(val) : it.quantity;
        const r = field === "rate" ? Number(val) : it.rate;
        it.line_total = Math.round(q * r * 100) / 100;
      }
      copy[idx] = it;
      return copy;
    });
  }

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.line_total) || 0), 0),
    [items]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    if (!customerId) {
      setError(t("quotations.customer_required"));
      return;
    }
    const cleanItems = items.filter((it) => it.description.trim() && it.quantity > 0);
    if (cleanItems.length === 0) {
      setError(t("quotations.items_required"));
      return;
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
        total: subtotal,
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
        items: cleanItems.map((it) => ({
          product_id: it.product_id,
          description: it.description,
          specification: it.specification,
          quantity: it.quantity,
          rate: it.rate,
          line_total: it.line_total,
        })),
      });
      onSaved(saved);
    } catch (err: any) {
      setError(err?.message ?? t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl p-6 my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{t("orders.add")}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Create a new production order</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mt-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>{t("general.loading")}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("quotations.customer")} <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="">{t("quotations.select_customer")}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ""} — {c.customer_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("orders.order_date")}
                </label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("orders.due_date")}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("orders.priority")}
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="normal">{t("orders.priority_normal")}</option>
                  <option value="urgent">{t("orders.priority_urgent")}</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("orders.special_instructions")}
                </label>
                <input
                  type="text"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Notes, delivery instructions, packaging preferences..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  {t("quotations.tab_items")}
                </span>
                <button
                  type="button"
                  onClick={() => setItems((prev) => [...prev, emptyItem()])}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("quotations.add_item")}
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left">{t("quotations.product")}</th>
                      <th className="px-3 py-2 text-left">{t("quotations.description")}</th>
                      <th className="px-3 py-2 text-left">{t("quotations.specification")}</th>
                      <th className="px-3 py-2 text-right w-20">{t("quotations.qty")}</th>
                      <th className="px-3 py-2 text-right w-28">{t("quotations.rate")}</th>
                      <th className="px-3 py-2 text-right w-28">{t("quotations.line_total")}</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const key = (item as any)._key;
                      return (
                        <tr key={key} className="align-top">
                          <td className="px-2 py-2 w-48">
                            <select
                              value={item.product_id ?? ""}
                              onChange={(e) =>
                                handleProductSelect(
                                  idx,
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="">{t("quotations.custom_item")}</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              required
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                              placeholder="Description *"
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={item.specification || ""}
                              onChange={(e) => handleItemChange(idx, "specification", e.target.value)}
                              placeholder="Size / Spec"
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="any"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-slate-700 text-xs">
                            {fmt(item.line_total)}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setItems((prev) => prev.filter((it) => (it as any)._key !== key))
                              }
                              className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-2 text-sm font-semibold text-slate-700">
                Total: <span className="ml-2 font-bold text-amber-700">{fmt(subtotal)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
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
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm transition flex items-center gap-2"
              >
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

  // Sub-records state
  const [designs, setDesigns] = useState<Design[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Modals state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [approvalModalData, setApprovalModalData] = useState<{
    design: Design;
    action: "approved" | "revision_requested" | "rejected";
  } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cancelPaymentTarget, setCancelPaymentTarget] = useState<Payment | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState<Invoice | null>(null);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const canManage = currentUser ? canManageQuotations(currentUser.role) : false;
  const canDesign = currentUser ? canManageDesigns(currentUser.role) : false;
  const canPay = currentUser ? canManagePayments(currentUser.role) : false;
  const canInv = currentUser ? canManageInvoices(currentUser.role) : false;
  const canCancelInv = currentUser ? canCancelInvoice(currentUser.role) : false;

  const overdue = isOverdue(order);
  const isCancelled = order.status === "cancelled";

  // Load sub-records (designs, payments, invoices)
  const loadSubRecords = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const [dList, pList, iList] = await Promise.all([
        designsApi.list(order.id).catch(() => []),
        paymentsApi.list(order.id).catch(() => []),
        invoicesApi.list(order.id).catch(() => []),
      ]);
      setDesigns(dList);
      setPayments(pList);
      setInvoices(iList);
    } finally {
      setLoadingSubs(false);
    }
  }, [order.id]);

  useEffect(() => {
    loadSubRecords();
  }, [loadSubRecords]);

  // Latest design logic
  const latestDesign = designs.length > 0 ? designs[0] : null;
  const isDesignApproved = latestDesign?.approval_status === "approved";

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

    // Rule 4 validation UI check
    if (status === "in_production" && !isDesignApproved) {
      setStatusError(
        t("designs.error_production_blocked") ||
          "Rule 4: Order cannot move to 'in_production' unless its latest design is approved."
      );
      return;
    }

    setUpdatingStatus(true);
    setStatusError(null);
    try {
      await ordersApi.updateStatus({
        id: order.id,
        status,
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
      });
      onRefresh();
    } catch (err: any) {
      setStatusError(err?.message ?? t("general.error"));
    } finally {
      setUpdatingStatus(false);
    }
  }

  const tabs = [
    { key: "details",    label: t("orders.tab_details"),    icon: FileText },
    { key: "items",      label: t("orders.tab_items"),      icon: ShoppingBag },
    { key: "design",     label: t("orders.tab_design"),     icon: Paintbrush },
    { key: "payments",   label: t("orders.tab_payments"),   icon: CreditCard },
    { key: "production", label: t("orders.tab_production"), icon: Settings2 },
  ];

  const totalPaid = payments
    .filter((p) => !p.cancelled)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = Math.max(0, order.total - totalPaid);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" /> {t("orders.back_to_list")}
        </button>

        {canManage && !isCancelled && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Advance status */}
            {nextStatus && (
              <button
                onClick={() => changeStatus(nextStatus)}
                disabled={updatingStatus}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-xl shadow-sm transition"
              >
                {updatingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("orders.update_status")} → {t(`orders.status_${nextStatus}`)}
              </button>
            )}

            {/* Cancel order */}
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-rose-700 bg-rose-50 px-4 py-2 rounded-xl border border-rose-200 hover:bg-rose-100 transition"
            >
              <XCircle className="w-4 h-4" /> {t("orders.cancel_order")}
            </button>
          </div>
        )}
      </div>

      {/* Rule 4 Error Banner */}
      {statusError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 animate-in fade-in">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-rose-900">Status Change Blocked</h4>
            <p className="mt-0.5">{statusError}</p>
          </div>
          <button
            onClick={() => setStatusError(null)}
            className="text-rose-500 hover:text-rose-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header card */}
      <div
        className={cn(
          "rounded-2xl border shadow-sm p-6",
          overdue ? "bg-rose-50/70 border-rose-200" : "bg-white border-slate-100"
        )}
      >
        <div className="flex flex-wrap gap-4 justify-between items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">{order.order_number}</h1>
              <StatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status} />
              <PriorityBadge priority={order.priority} />
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-600 text-white">
                  <Clock className="w-3 h-3" /> {t("orders.overdue")}
                </span>
              )}
            </div>
            <p className="text-slate-600 font-semibold">{order.customer_name}</p>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">
              <span>
                Order Date: <strong className="text-slate-700">{order.order_date}</strong>
              </span>
              {order.due_date && (
                <span>
                  Due:{" "}
                  <strong className={cn(overdue ? "text-rose-700 font-bold" : "text-slate-700")}>
                    {order.due_date}
                  </strong>
                </span>
              )}
              {order.quotation_id && (
                <span className="text-indigo-600">{t("orders.from_quotation")}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Total</p>
              <p className="text-xl font-bold text-slate-800">{fmt(order.total)}</p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Paid</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(totalPaid)}</p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Balance</p>
              <p
                className={cn(
                  "text-xl font-bold",
                  balance > 0 ? "text-rose-600" : "text-slate-600"
                )}
              >
                {fmt(balance)}
              </p>
            </div>
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
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === (tab.key as OrderTab);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as OrderTab)}
              className={cn(
                "flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition -mb-px whitespace-nowrap",
                isActive
                  ? "border-amber-600 text-amber-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.key === "design" && latestDesign && (
                <span className="text-[10px] ml-1">
                  <DesignStatusBadge status={latestDesign.approval_status} />
                </span>
              )}
              {tab.key === "payments" && (
                <span className="text-[10px] ml-1">
                  <PaymentStatusBadge status={order.payment_status} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Details ──────────────────────────────────────────────────────── */}
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                {t("orders.special_instructions")}
              </h3>
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

      {/* ── Tab: Items ────────────────────────────────────────────────────────── */}
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
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">
                    {fmt(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50/70">
              <tr>
                <td colSpan={5} className="px-5 py-3 text-right font-bold text-slate-800">
                  Total
                </td>
                <td className="px-5 py-3 text-right font-bold text-lg text-slate-800">
                  {fmt(order.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Tab: Design & Approval (Phase 4) ──────────────────────────────────── */}
      {activeTab === "design" && (
        <div className="space-y-6">
          {/* Header & Upload CTA */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Paintbrush className="w-5 h-5 text-amber-600" />
                {t("designs.title")}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Upload design mockups/drawings. Rule: Latest version must be approved before production.
              </p>
            </div>
            {canDesign && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition"
              >
                <Upload className="w-4 h-4" />
                {t("designs.upload_btn")}
              </button>
            )}
          </div>

          {/* Versions List */}
          {loadingSubs ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>{t("general.loading")}</span>
            </div>
          ) : designs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-4">
                <Paintbrush className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t("designs.empty_title")}</h3>
              <p className="text-sm text-slate-500 max-w-md mt-1">{t("designs.empty_desc")}</p>
              {canDesign && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition"
                >
                  <Upload className="w-4 h-4" />
                  {t("designs.upload_btn")}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {designs.map((d, idx) => {
                const isLatest = idx === 0;
                const isPdf = d.file_name.toLowerCase().endsWith(".pdf");

                return (
                  <div
                    key={d.id}
                    className={cn(
                      "bg-white rounded-2xl border p-5 transition shadow-sm",
                      isLatest ? "border-primary-200 ring-1 ring-primary-100" : "border-slate-100"
                    )}
                  >
                    <div className="flex flex-col md:flex-row gap-5 items-start">
                      {/* Thumbnail / Icon preview */}
                      <div className="w-32 h-32 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0 relative group">
                        {d.thumbnail_data ? (
                          <img
                            src={d.thumbnail_data}
                            alt={d.file_name}
                            className="w-full h-full object-cover"
                          />
                        ) : isPdf ? (
                          <div className="flex flex-col items-center text-rose-500">
                            <FileText className="w-10 h-10" />
                            <span className="text-[10px] font-bold uppercase mt-1">PDF File</span>
                          </div>
                        ) : (
                          <Paintbrush className="w-8 h-8 text-slate-400" />
                        )}
                        <button
                          onClick={() => designsApi.openFile(d.file_path)}
                          className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5"
                        >
                          <ExternalLink className="w-4 h-4" /> Open
                        </button>
                      </div>

                      {/* Info & Metadata */}
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-sm font-bold text-slate-800">
                            v{d.version_number}
                          </span>
                          <span className="text-sm font-semibold text-slate-700">{d.file_name}</span>
                          {isLatest && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary-100 text-primary-700">
                              {t("designs.latest_version")}
                            </span>
                          )}
                          <DesignStatusBadge status={d.approval_status} />
                        </div>

                        <div className="text-xs text-slate-500 space-y-1">
                          <div>
                            Uploaded by <strong className="text-slate-700">{d.uploaded_by}</strong> on{" "}
                            {new Date(d.uploaded_at).toLocaleString()}
                          </div>
                          {d.approved_by_name && (
                            <div className="text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 inline-block">
                              Approved by <strong>{d.approved_by_name}</strong> via{" "}
                              <strong>{d.approval_method || "WhatsApp"}</strong> on{" "}
                              <strong>{d.approved_on}</strong>
                            </div>
                          )}
                          {d.remarks && (
                            <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1">
                              <strong>Remarks:</strong> {d.remarks}
                            </p>
                          )}
                        </div>

                        {/* Actions on latest version */}
                        {isLatest && canDesign && !isCancelled && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                            {d.approval_status !== "approved" && (
                              <button
                                onClick={() =>
                                  setApprovalModalData({ design: d, action: "approved" })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t("designs.mark_approved")}
                              </button>
                            )}
                            {d.approval_status !== "revision_requested" && (
                              <button
                                onClick={() =>
                                  setApprovalModalData({
                                    design: d,
                                    action: "revision_requested",
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition"
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                                {t("designs.request_revision")}
                              </button>
                            )}
                            {d.approval_status !== "rejected" && (
                              <button
                                onClick={() =>
                                  setApprovalModalData({ design: d, action: "rejected" })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                {t("designs.reject")}
                              </button>
                            )}
                            <button
                              onClick={() => designsApi.openFile(d.file_path)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              {t("designs.open_file")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Payments & Invoices (Phase 4) ─────────────────────────────────── */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t("payments.order_total")}
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{fmt(order.total)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t("payments.paid")}
              </p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(totalPaid)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t("payments.balance")}
              </p>
              <p
                className={cn(
                  "text-2xl font-bold mt-1",
                  balance > 0 ? "text-rose-600" : "text-slate-700"
                )}
              >
                {fmt(balance)}
              </p>
            </div>
          </div>

          {/* Payments Section */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  {t("payments.list_title")}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Payments received for this order. No hard delete; wrong entries are cancelled with reasons.
                </p>
              </div>
              {canPay && !isCancelled && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  {t("payments.record_btn")}
                </button>
              )}
            </div>

            {loadingSubs ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>{t("general.loading")}</span>
              </div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {t("payments.empty_payments")}
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">{t("payments.date")}</th>
                    <th className="px-5 py-3">{t("payments.mode")}</th>
                    <th className="px-5 py-3">{t("payments.reference_number")}</th>
                    <th className="px-5 py-3 text-right">{t("payments.amount")}</th>
                    <th className="px-5 py-3">{t("payments.received_by")}</th>
                    <th className="px-5 py-3">{t("payments.notes")}</th>
                    <th className="px-5 py-3 text-right">{t("general.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p, idx) => {
                    const isCanc = p.cancelled === 1;
                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          "transition",
                          isCanc
                            ? "bg-slate-50/70 text-slate-400 line-through"
                            : "hover:bg-slate-50/50 text-slate-700"
                        )}
                      >
                        <td className="px-5 py-3 font-mono">{idx + 1}</td>
                        <td className="px-5 py-3 font-medium">{p.payment_date}</td>
                        <td className="px-5 py-3 capitalize">{p.mode}</td>
                        <td className="px-5 py-3 font-mono">{p.reference_number || "—"}</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900">
                          {fmt(p.amount)}
                        </td>
                        <td className="px-5 py-3">{p.received_by}</td>
                        <td className="px-5 py-3">
                          {isCanc ? (
                            <span className="text-rose-600 no-underline font-semibold block text-[11px]">
                              Cancelled: {p.cancel_reason}
                            </span>
                          ) : (
                            p.notes || "—"
                          )}
                          {p.owner_approval_reason && (
                            <span className="text-amber-700 text-[10px] block">
                              Owner Overpay Approval: {p.owner_approval_reason}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right no-underline">
                          {!isCanc && canPay && (
                            <button
                              onClick={() => setCancelPaymentTarget(p)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title={t("payments.cancel_payment")}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Invoices Section */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-primary-600" />
                  {t("invoices.title")}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tax invoices generated from this order. Includes bilingual Malayalam/English PDF print.
                </p>
              </div>
              {canInv && !isCancelled && (
                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  {t("invoices.generate_invoice")}
                </button>
              )}
            </div>

            {loadingSubs ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>{t("general.loading")}</span>
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {t("invoices.empty_invoices")}
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">{t("invoices.number")}</th>
                    <th className="px-5 py-3">{t("invoices.date")}</th>
                    <th className="px-5 py-3">{t("invoices.type")}</th>
                    <th className="px-5 py-3 text-right">{t("invoices.subtotal")}</th>
                    <th className="px-5 py-3 text-right">{t("invoices.tax_amount")}</th>
                    <th className="px-5 py-3 text-right">{t("invoices.total")}</th>
                    <th className="px-5 py-3">{t("invoices.status")}</th>
                    <th className="px-5 py-3 text-right">{t("general.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => {
                    const isCanc = inv.status === "cancelled";
                    return (
                      <tr
                        key={inv.id}
                        className={cn(
                          "transition",
                          isCanc ? "bg-rose-50/30 text-slate-400" : "hover:bg-slate-50/50 text-slate-700"
                        )}
                      >
                        <td className="px-5 py-3 font-mono font-bold text-primary-700">
                          {inv.invoice_number}
                        </td>
                        <td className="px-5 py-3">{inv.date}</td>
                        <td className="px-5 py-3 capitalize">{inv.type}</td>
                        <td className="px-5 py-3 text-right">{fmt(inv.subtotal)}</td>
                        <td className="px-5 py-3 text-right">{fmt(inv.tax_amount)}</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900">
                          {fmt(inv.total)}
                        </td>
                        <td className="px-5 py-3">
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
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => printInvoice(inv, "en")}
                              className="p-1 rounded text-slate-500 hover:text-primary-700 hover:bg-primary-50 transition"
                              title="Print English Invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => printInvoice(inv, "ml")}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition"
                              title="Print Malayalam Invoice"
                            >
                              മലയാളം
                            </button>
                            {!isCanc && canCancelInv && (
                              <button
                                onClick={() => setCancelInvoiceTarget(inv)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Cancel Invoice (Owner Only)"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Production (Placeholder Phase 5) ─────────────────────────────── */}
      {activeTab === "production" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">
            🏭
          </div>
          <h3 className="text-lg font-bold text-slate-800">{t("orders.tab_production")}</h3>
          <p className="text-sm text-slate-500 mt-1">
            Job card generation, floor tracking, stages, and operator assignments will be built in Phase 5.
          </p>
          <span className="mt-4 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            Phase 5 Module
          </span>
        </div>
      )}

      {/* Modals */}
      {showCancelModal && (
        <CancelModal
          order={order}
          onClose={() => setShowCancelModal(false)}
          onCancelled={() => {
            setShowCancelModal(false);
            onRefresh();
          }}
        />
      )}

      {showUploadModal && (
        <DesignUploadModal
          order={order}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            setShowUploadModal(false);
            loadSubRecords();
            onRefresh();
          }}
        />
      )}

      {approvalModalData && (
        <DesignApprovalModal
          order={order}
          design={approvalModalData.design}
          action={approvalModalData.action}
          onClose={() => setApprovalModalData(null)}
          onSuccess={() => {
            setApprovalModalData(null);
            loadSubRecords();
            onRefresh();
          }}
        />
      )}

      {showPaymentModal && (
        <RecordPaymentModal
          order={{ ...order, balance_amount: balance }}
          onClose={() => setShowPaymentModal(false)}
          onSaved={() => {
            setShowPaymentModal(false);
            loadSubRecords();
            onRefresh();
          }}
        />
      )}

      {cancelPaymentTarget && (
        <CancelPaymentModal
          payment={cancelPaymentTarget}
          onClose={() => setCancelPaymentTarget(null)}
          onSuccess={() => {
            setCancelPaymentTarget(null);
            loadSubRecords();
            onRefresh();
          }}
        />
      )}

      {showInvoiceModal && (
        <GenerateInvoiceModal
          order={order}
          onClose={() => setShowInvoiceModal(false)}
          onSuccess={(inv) => {
            setShowInvoiceModal(false);
            loadSubRecords();
            onRefresh();
            // Automatically prompt print
            printInvoice(inv, "en");
          }}
        />
      )}

      {cancelInvoiceTarget && (
        <CancelInvoiceModal
          invoice={cancelInvoiceTarget}
          onClose={() => setCancelInvoiceTarget(null)}
          onSuccess={() => {
            setCancelInvoiceTarget(null);
            loadSubRecords();
            onRefresh();
          }}
        />
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

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function refreshView(id: number) {
    try {
      const updated = await ordersApi.get(id);
      setViewOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)));
    } catch {}
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name ?? "").toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, search, filterStatus]);

  if (viewOrder) {
    return (
      <OrderDetailView
        order={viewOrder}
        onBack={() => setViewOrder(null)}
        onRefresh={() => refreshView(viewOrder.id)}
      />
    );
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
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            {t("orders.add")}
          </button>
        )}
      </div>

      {/* Search + status filter */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("orders.search_placeholder")}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
        <div className="flex items-center rounded-xl border border-slate-200 p-0.5 text-xs font-medium text-slate-600 overflow-x-auto">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg capitalize transition whitespace-nowrap",
                filterStatus === s ? "bg-amber-600 text-white shadow-xs" : "hover:text-slate-900"
              )}
            >
              {s === "all" ? t("general.all") : t(`orders.status_${s}`) || s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            {t("general.loading")}
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
                  <th className="px-5 py-3.5">{t("orders.tab_payments")}</th>
                  <th className="px-5 py-3.5 text-right">{t("orders.total")}</th>
                  <th className="px-5 py-3.5 text-right">{t("general.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((o) => {
                  const overdue = isOverdue(o);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => {
                        ordersApi.get(o.id).then((full) => setViewOrder(full));
                      }}
                      className={cn(
                        "hover:bg-slate-50/60 transition cursor-pointer group",
                        overdue && "bg-rose-50/40"
                      )}
                    >
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-amber-700">
                        {o.order_number}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-800 group-hover:text-amber-600 transition">
                        {o.customer_name}
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{o.order_date}</td>
                      <td className="px-5 py-4 text-xs">
                        {o.due_date ? (
                          <span
                            className={cn(
                              "font-medium",
                              overdue ? "text-rose-700 font-bold" : "text-slate-600"
                            )}
                          >
                            {overdue && <Clock className="w-3 h-3 inline mr-1 text-rose-600" />}
                            {o.due_date}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <PriorityBadge priority={o.priority} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-5 py-4">
                        <PaymentStatusBadge status={o.payment_status} />
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-700">
                        {fmt(o.total)}
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            ordersApi.get(o.id).then((full) => setViewOrder(full));
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                          title={t("orders.view_details")}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
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
          onSaved={async () => {
            setShowModal(false);
            await loadOrders();
          }}
        />
      )}
    </div>
  );
}
