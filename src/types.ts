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
