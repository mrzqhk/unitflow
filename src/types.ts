/**
 * types.ts — Shared type definitions for the renderer process.
 */

export type Role =
  | "owner"
  | "sales"
  | "designer"
  | "supervisor"
  | "worker"
  | "store"
  | "delivery"
  | "accountant";

export interface User {
  id: number;
  full_name: string;
  username: string;
  role: Role;
  active: number;
  created_at?: string;
}

export type CustomerType = "retail" | "wholesale";

export interface Customer {
  id: number;
  name: string;
  company?: string | null;
  phone: string;
  alternate_phone?: string | null;
  email?: string | null;
  billing_address?: string | null;
  delivery_address?: string | null;
  gst_number?: string | null;
  customer_type: CustomerType;
  credit_limit?: number | null;
  notes?: string | null;
  active: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface WholesaleSlab {
  id?: number;
  product_id?: number;
  min_quantity: number;
  price: number;
  created_at?: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  unit: string;
  retail_price: number;
  wholesale_price: number;
  active: number;
  slabs?: WholesaleSlab[];
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  performed_by: string;
  performed_at: string;
  old_value?: string | null;
  new_value?: string | null;
}

export type Language = "en" | "ml"; // ml = Malayalam

// ── Quotations ────────────────────────────────────────────────────────────────

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface QuotationItem {
  id?: number;
  quotation_id?: number;
  product_id?: number | null;
  description: string;
  specification?: string | null;
  quantity: number;
  rate: number;
  line_total: number;
  price_override?: number; // 1 = overridden below standard
  override_reason?: string | null;
  sort_order?: number;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  customer_id: number;
  customer_name?: string;
  customer_type?: string;
  billing_address?: string | null;
  gst_number?: string | null;
  date: string;
  valid_until?: string | null;
  status: QuotationStatus;
  discount: number;
  tax_percent: number;
  notes?: string | null;
  terms?: string | null;
  subtotal: number;
  total: number;
  linked_order_id?: number | null;
  items?: QuotationItem[];
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

// ── Orders ────────────────────────────────────────────────────────────────────

export type OrderStatus = "confirmed" | "in_production" | "ready" | "delivered" | "closed" | "cancelled";
export type OrderPriority = "normal" | "urgent";

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id?: number | null;
  description: string;
  specification?: string | null;
  quantity: number;
  rate: number;
  line_total: number;
  sort_order?: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name?: string;
  billing_address?: string | null;
  gst_number?: string | null;
  quotation_id?: number | null;
  order_date: string;
  due_date?: string | null;
  priority: OrderPriority;
  status: OrderStatus;
  special_instructions?: string | null;
  cancel_reason?: string | null;
  subtotal: number;
  total: number;
  items?: OrderItem[];
  paid_amount?: number;
  balance_amount?: number;
  payment_status?: OrderPaymentStatus;
  latest_design?: Design | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export type OrderPaymentStatus = "unpaid" | "advance_paid" | "partially_paid" | "paid";

// ── Designs (Design & Approval Workflow) ──────────────────────────────────────

export type DesignApprovalStatus = "pending" | "approved" | "rejected" | "revision_requested";
export type DesignApprovalMethod = "phone" | "WhatsApp" | "in person" | "email";

export interface Design {
  id: number;
  order_id: number;
  version_number: number;
  file_path: string;
  file_name: string;
  uploaded_by: string;
  uploaded_at: string;
  approval_status: DesignApprovalStatus;
  approved_by_name?: string | null;
  approved_on?: string | null;
  approval_method?: DesignApprovalMethod | null;
  remarks?: string | null;
  preview?: string | null; // Data URL for image thumbnails
}

// ── Payments ──────────────────────────────────────────────────────────────────

export type PaymentMode = "cash" | "UPI" | "bank transfer" | "cheque";

export interface Payment {
  id: number;
  order_id: number;
  order_number?: string;
  order_total?: number;
  customer_id: number;
  customer_name?: string;
  amount: number;
  payment_date: string;
  mode: PaymentMode;
  reference_number?: string | null;
  notes?: string | null;
  received_by: string;
  is_cancelled: number;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  created_at: string;
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export type InvoiceType = "advance" | "partial" | "final";
export type InvoiceStatus = "issued" | "cancelled";

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  description: string;
  specification?: string | null;
  quantity: number;
  rate: number;
  line_total: number;
  sort_order?: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  order_id: number;
  order_number?: string;
  customer_id: number;
  customer_name?: string;
  billing_address?: string | null;
  gst_number?: string | null;
  phone?: string | null;
  date: string;
  subtotal: number;
  discount: number;
  tax_percent: number;
  tax_amount: number;
  total: number;
  type: InvoiceType;
  status: InvoiceStatus;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  notes?: string | null;
  items?: InvoiceItem[];
  amount_paid?: number;
  balance_due?: number;
  created_by: string;
  created_at: string;
}

// ── Dues & Customer Balance ───────────────────────────────────────────────────

export interface CustomerDue {
  customer_id: number;
  name: string;
  company?: string | null;
  phone: string;
  total_orders: number;
  total_paid: number;
  balance: number;
  oldest_date: string;
  days_overdue: number;
}

export interface DuesSummary {
  total_outstanding: number;
  total_collected: number;
  overdue_customers_count: number;
  total_invoices: number;
}

export interface CustomerBalance {
  total_orders: number;
  total_paid: number;
  balance: number;
}
