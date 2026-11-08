/**
 * lib/permissions.ts — Role-based access control for the renderer.
 *
 * This file defines which screens/actions each role can access.
 * The UI uses this to hide menu items and block navigation.
 * The main process ALSO enforces rules independently (not just the UI).
 */

import { Role } from "../types";

/** Every named screen / action in the app. */
export type Screen =
  | "dashboard"
  | "customers"
  | "products"
  | "quotations"
  | "orders"
  | "sales"
  | "design"
  | "production"
  | "store"
  | "delivery"
  | "accounts"
  | "users";       // Owner only

/** Map of which screens each role can access. */
const ROLE_PERMISSIONS: Record<Role, Screen[]> = {
  owner:      ["dashboard", "customers", "products", "quotations", "orders", "sales", "design", "production", "store", "delivery", "accounts", "users"],
  sales:      ["dashboard", "customers", "products", "quotations", "orders", "sales"],
  designer:   ["dashboard", "products", "design", "orders"],
  supervisor: ["dashboard", "customers", "products", "orders", "production", "design", "store"],
  worker:     ["dashboard", "production", "orders"],
  store:      ["dashboard", "products", "store", "orders"],
  delivery:   ["dashboard", "customers", "delivery", "orders"],
  accountant: ["dashboard", "customers", "products", "accounts", "quotations", "orders"],
};

/** Returns true if the given role can access the given screen. */
export function canAccess(role: Role, screen: Screen): boolean {
  return ROLE_PERMISSIONS[role]?.includes(screen) ?? false;
}

/** Check if role can add or edit customers (Rule 8: owner, admin, sales) */
export function canManageCustomers(role: Role): boolean {
  return role === "owner" || role === "sales";
}

/** Check if role can edit product prices (Rule 8: only owner) */
export function canEditPrices(role: Role): boolean {
  return role === "owner";
}

/** Check if role can create/edit quotations and orders. */
export function canManageQuotations(role: Role): boolean {
  return role === "owner" || role === "admin" || role === "sales";
}

/** Check if role can view orders (broader access). */
export function canViewOrders(role: Role): boolean {
  return ["owner", "admin", "sales", "supervisor", "worker", "store", "delivery", "accountant", "designer"].includes(role);
}

/** Check if owner/admin can override a price below standard on a quotation. */
export function canOverridePrice(role: Role): boolean {
  return role === "owner" || role === "admin";
}

/** Returns all screens the role can access. */
export function allowedScreens(role: Role): Screen[] {
  return ROLE_PERMISSIONS[role] ?? ["dashboard"];
}

/** Human-readable label for a role (English fallback). */
export const ROLE_LABELS: Record<Role, string> = {
  owner:      "Owner",
  sales:      "Sales",
  designer:   "Designer",
  supervisor: "Supervisor",
  worker:     "Worker",
  store:      "Store",
  delivery:   "Delivery",
  accountant: "Accountant",
};
