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
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}
