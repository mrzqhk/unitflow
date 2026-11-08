/**
 * lib/api.ts — Typed wrappers around window.api.invoke().
 *
 * Every IPC call goes through here so we have type-safety in the renderer.
 * When running in Electron, calls use the real preload IPC bridge to SQLite.
 * When previewed in a standard web browser (where window.api is undefined),
 * a seamless local storage fallback is provided so the UI remains fully functional.
 */

import { User, Role, Customer, Product, CustomerType, Quotation, Order } from "../types";

// window.api is injected by the preload script in Electron
declare global {
  interface Window {
    api?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
    };
  }
}

// ── Web Browser Fallback Mock ──────────────────────────────────────────────────
if (typeof window !== "undefined" && !window.api) {
  console.warn(
    "[UnitFlow] Running in web browser mode (window.api is undefined). Using local browser mock storage."
  );

  const STORAGE_USERS = "unitflow_mock_users";
  const STORAGE_CUSTOMERS = "unitflow_mock_customers";
  const STORAGE_PRODUCTS = "unitflow_mock_products";
  const STORAGE_QUOTATIONS = "unitflow_mock_quotations";
  const STORAGE_ORDERS = "unitflow_mock_orders";

  const getMockUsers = (): User[] => {
    try {
      const data = localStorage.getItem(STORAGE_USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const saveMockUsers = (users: User[]) => {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  };

  const getMockCustomers = (): Customer[] => {
    try {
      const data = localStorage.getItem(STORAGE_CUSTOMERS);
      if (data) return JSON.parse(data);
    } catch {}
    // Default initial mock customers
    const initial: Customer[] = [
      {
        id: 1,
        name: "Rahul Verma",
        company: "Apex Apparels Ltd",
        phone: "9876543210",
        alternate_phone: "9876543211",
        email: "rahul@apexapparels.com",
        billing_address: "Plot 42, Industrial Area, Phase 1, Kochi",
        delivery_address: "Plot 42, Industrial Area, Phase 1, Kochi",
        gst_number: "32AAAAA0000A1Z5",
        customer_type: "wholesale",
        credit_limit: 50000,
        notes: "Preferred payment terms: 15 days net.",
        active: 1,
        created_by: "owner",
        updated_by: "owner",
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 2,
        name: "Ananya Menon",
        company: "Menon Designs",
        phone: "9123456789",
        alternate_phone: "",
        email: "ananya@menondesigns.in",
        billing_address: "12/488 MG Road, Ernakulam",
        delivery_address: "12/488 MG Road, Ernakulam",
        gst_number: "",
        customer_type: "retail",
        credit_limit: 10000,
        notes: "Individual custom order client.",
        active: 1,
        created_by: "sales",
        updated_by: "sales",
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ];
    localStorage.setItem(STORAGE_CUSTOMERS, JSON.stringify(initial));
    return initial;
  };

  const saveMockCustomers = (customers: Customer[]) => {
    localStorage.setItem(STORAGE_CUSTOMERS, JSON.stringify(customers));
  };

  const getMockProducts = (): Product[] => {
    try {
      const data = localStorage.getItem(STORAGE_PRODUCTS);
      if (data) return JSON.parse(data);
    } catch {}
    const initial: Product[] = [
      {
        id: 1,
        name: "Premium Cotton Shirt",
        category: "Apparel",
        unit: "pcs",
        retail_price: 1200,
        wholesale_price: 850,
        active: 1,
        slabs: [
          { min_quantity: 20, price: 800 },
          { min_quantity: 50, price: 750 },
          { min_quantity: 100, price: 700 },
        ],
        created_by: "owner",
        updated_by: "owner",
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      },
      {
        id: 2,
        name: "Linen Fabric Roll",
        category: "Raw Material",
        unit: "meter",
        retail_price: 450,
        wholesale_price: 320,
        active: 1,
        slabs: [
          { min_quantity: 50, price: 300 },
          { min_quantity: 200, price: 270 },
        ],
        created_by: "owner",
        updated_by: "owner",
        created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 8).toISOString(),
      },
      {
        id: 3,
        name: "Custom Embroidered Hoodie",
        category: "Apparel",
        unit: "pcs",
        retail_price: 2400,
        wholesale_price: 1800,
        active: 1,
        slabs: [
          { min_quantity: 25, price: 1650 },
        ],
        created_by: "owner",
        updated_by: "owner",
        created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      },
    ];
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(initial));
    return initial;
  };

  const saveMockProducts = (products: Product[]) => {
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
  };

  // ── Mock Quotations ────────────────────────────────────────────────────────
  const getMockQuotations = (): Quotation[] => {
    try {
      const data = localStorage.getItem(STORAGE_QUOTATIONS);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  };
  const saveMockQuotations = (q: Quotation[]) => localStorage.setItem(STORAGE_QUOTATIONS, JSON.stringify(q));

  // ── Mock Orders ────────────────────────────────────────────────────────────
  const getMockOrders = (): Order[] => {
    try {
      const data = localStorage.getItem(STORAGE_ORDERS);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  };
  const saveMockOrders = (o: Order[]) => localStorage.setItem(STORAGE_ORDERS, JSON.stringify(o));

  window.api = {
    invoke: async (channel: string, ...args: unknown[]) => {
      const payload = args[0] as any;
      const users = getMockUsers();
      const customers = getMockCustomers();
      const products = getMockProducts();

      switch (channel) {
        // ── Auth ─────────────────────────────────────────────────────────────
        case "auth:check-owner-exists": {
          const hasOwner = users.some(u => u.role === "owner" && u.active === 1);
          return { success: true, data: hasOwner };
        }
        case "auth:create-owner": {
          if (users.some(u => u.role === "owner")) {
            return { success: false, error: "An owner account already exists." };
          }
          const newOwner: User = {
            id: 1,
            full_name: payload.full_name,
            username: payload.username,
            role: "owner",
            active: 1,
            created_at: new Date().toISOString(),
          };
          users.push(newOwner);
          saveMockUsers(users);
          return { success: true, data: true };
        }
        case "auth:login": {
          const user = users.find(
            u => u.username.toLowerCase() === payload.username.toLowerCase() && u.active === 1
          );
          if (!user) {
            return { success: false, error: "Invalid username or password." };
          }
          return { success: true, data: user };
        }

        // ── Users ────────────────────────────────────────────────────────────
        case "users:list": {
          return { success: true, data: users };
        }
        case "users:create": {
          if (payload.callerRole !== "owner") {
            return { success: false, error: "Only the owner can create users." };
          }
          const newUser: User = {
            id: Date.now(),
            full_name: payload.full_name,
            username: payload.username,
            role: payload.role,
            active: 1,
            created_at: new Date().toISOString(),
          };
          users.push(newUser);
          saveMockUsers(users);
          return { success: true, data: true };
        }
        case "users:update": {
          if (payload.callerRole !== "owner") {
            return { success: false, error: "Only the owner can edit users." };
          }
          const idx = users.findIndex(u => u.id === payload.id);
          if (idx !== -1) {
            users[idx] = { ...users[idx], full_name: payload.full_name, role: payload.role };
            saveMockUsers(users);
          }
          return { success: true, data: true };
        }
        case "users:toggle-active": {
          if (payload.callerRole !== "owner") {
            return { success: false, error: "Only the owner can change user status." };
          }
          const idx = users.findIndex(u => u.id === payload.id);
          if (idx !== -1) {
            users[idx].active = payload.active ? 1 : 0;
            saveMockUsers(users);
          }
          return { success: true, data: true };
        }

        // ── Customers ────────────────────────────────────────────────────────
        case "customers:list": {
          return { success: true, data: customers };
        }
        case "customers:get": {
          const c = customers.find(x => x.id === payload.id);
          return c ? { success: true, data: c } : { success: false, error: "Customer not found." };
        }
        case "customers:check-phone": {
          const existing = customers.find(
            x => x.phone.trim() === payload.phone.trim() && (payload.excludeId ? x.id !== payload.excludeId : true)
          );
          return { success: true, data: existing ? { id: existing.id, name: existing.name } : null };
        }
        case "customers:create": {
          const isAllowed = ["owner", "admin", "sales"].includes(payload.callerRole);
          if (!isAllowed) {
            return { success: false, error: "Permission denied: Only owner, admin and sales roles can add customers." };
          }
          const newCust: Customer = {
            id: Date.now(),
            name: payload.name,
            company: payload.company || "",
            phone: payload.phone,
            alternate_phone: payload.alternate_phone || "",
            email: payload.email || "",
            billing_address: payload.billing_address || "",
            delivery_address: payload.delivery_address || "",
            gst_number: payload.gst_number || "",
            customer_type: payload.customer_type || "retail",
            credit_limit: payload.credit_limit || 0,
            notes: payload.notes || "",
            active: 1,
            created_by: payload.callerUsername || "user",
            updated_by: payload.callerUsername || "user",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          customers.unshift(newCust);
          saveMockCustomers(customers);
          return { success: true, data: newCust };
        }
        case "customers:update": {
          const isAllowed = ["owner", "admin", "sales"].includes(payload.callerRole);
          if (!isAllowed) {
            return { success: false, error: "Permission denied: Only owner, admin and sales roles can edit customers." };
          }
          const idx = customers.findIndex(x => x.id === payload.id);
          if (idx === -1) return { success: false, error: "Customer not found." };
          customers[idx] = {
            ...customers[idx],
            name: payload.name,
            company: payload.company,
            phone: payload.phone,
            alternate_phone: payload.alternate_phone,
            email: payload.email,
            billing_address: payload.billing_address,
            delivery_address: payload.delivery_address,
            gst_number: payload.gst_number,
            customer_type: payload.customer_type,
            credit_limit: payload.credit_limit,
            notes: payload.notes,
            updated_by: payload.callerUsername,
            updated_at: new Date().toISOString(),
          };
          saveMockCustomers(customers);
          return { success: true, data: customers[idx] };
        }
        case "customers:toggle-active": {
          const isAllowed = ["owner", "admin", "sales"].includes(payload.callerRole);
          if (!isAllowed) {
            return { success: false, error: "Permission denied: Only owner, admin and sales roles can change customer status." };
          }
          const idx = customers.findIndex(x => x.id === payload.id);
          if (idx !== -1) {
            customers[idx].active = payload.active ? 1 : 0;
            customers[idx].updated_by = payload.callerUsername;
            customers[idx].updated_at = new Date().toISOString();
            saveMockCustomers(customers);
          }
          return { success: true, data: true };
        }

        // ── Products ─────────────────────────────────────────────────────────
        case "products:list": {
          return { success: true, data: products };
        }
        case "products:get": {
          const p = products.find(x => x.id === payload.id);
          return p ? { success: true, data: p } : { success: false, error: "Product not found." };
        }
        case "products:create": {
          const isOwner = payload.callerRole === "owner";
          const hasPrices = (payload.retail_price > 0 || payload.wholesale_price > 0 || (payload.slabs && payload.slabs.length > 0));
          if (hasPrices && !isOwner) {
            return { success: false, error: "Permission denied: Only the owner can set or edit prices." };
          }
          const newProd: Product = {
            id: Date.now(),
            name: payload.name,
            category: payload.category || "General",
            unit: payload.unit || "pcs",
            retail_price: isOwner ? (payload.retail_price || 0) : 0,
            wholesale_price: isOwner ? (payload.wholesale_price || 0) : 0,
            active: 1,
            slabs: isOwner ? (payload.slabs || []) : [],
            created_by: payload.callerUsername,
            updated_by: payload.callerUsername,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          products.unshift(newProd);
          saveMockProducts(products);
          return { success: true, data: newProd };
        }
        case "products:update": {
          const isOwner = payload.callerRole === "owner";
          const idx = products.findIndex(x => x.id === payload.id);
          if (idx === -1) return { success: false, error: "Product not found." };
          const oldProd = products[idx];

          const priceModified =
            Number(payload.retail_price) !== Number(oldProd.retail_price) ||
            Number(payload.wholesale_price) !== Number(oldProd.wholesale_price);
          const slabsModified = JSON.stringify(oldProd.slabs || []) !== JSON.stringify(payload.slabs || []);

          if ((priceModified || slabsModified) && !isOwner) {
            return { success: false, error: "Permission denied: Only the owner can edit prices." };
          }

          products[idx] = {
            ...products[idx],
            name: payload.name,
            category: payload.category || "General",
            unit: payload.unit || "pcs",
            retail_price: isOwner ? Number(payload.retail_price || 0) : oldProd.retail_price,
            wholesale_price: isOwner ? Number(payload.wholesale_price || 0) : oldProd.wholesale_price,
            slabs: isOwner ? (payload.slabs || []) : oldProd.slabs,
            updated_by: payload.callerUsername,
            updated_at: new Date().toISOString(),
          };
          saveMockProducts(products);
          return { success: true, data: products[idx] };
        }
        case "products:toggle-active": {
          const idx = products.findIndex(x => x.id === payload.id);
          if (idx !== -1) {
            products[idx].active = payload.active ? 1 : 0;
            products[idx].updated_by = payload.callerUsername;
            products[idx].updated_at = new Date().toISOString();
            saveMockProducts(products);
          }
          return { success: true, data: true };
        }

        // ── Backup & App ─────────────────────────────────────────────────────
        case "backup:now": {
          return { success: true, data: "C:\\Users\\USER\\AppData\\Roaming\\unitflow\\backups\\unitflow-backup.db" };
        }
        case "app:get-version": {
          return { success: true, data: "1.0.0 (Browser Preview)" };
        }

        // ── Quotations ────────────────────────────────────────────────────────
        case "quotations:list": {
          const quotations = getMockQuotations();
          const customers = getMockCustomers();
          const filtered = payload?.customer_id
            ? quotations.filter((q: Quotation) => q.customer_id === payload.customer_id)
            : quotations;
          return {
            success: true,
            data: filtered.map((q: Quotation) => ({
              ...q,
              customer_name: customers.find(c => c.id === q.customer_id)?.name ?? "Unknown",
            })),
          };
        }
        case "quotations:get": {
          const q = getMockQuotations().find((x: Quotation) => x.id === payload.id);
          if (!q) return { success: false, error: "Quotation not found." };
          const customers = getMockCustomers();
          const c = customers.find(cu => cu.id === q.customer_id);
          return { success: true, data: { ...q, customer_name: c?.name ?? "Unknown", customer_type: c?.customer_type ?? "retail" } };
        }
        case "quotations:create": {
          const allowed = ["owner", "admin", "sales"].includes(payload.callerRole);
          if (!allowed) return { success: false, error: "Permission denied." };
          const quotations = getMockQuotations();
          const subtotal = (payload.items || []).reduce((s: number, i: any) => s + i.line_total, 0);
          const disc = (subtotal * (payload.discount || 0)) / 100;
          const tax = ((subtotal - disc) * (payload.tax_percent || 0)) / 100;
          const total = subtotal - disc + tax;
          const newQ: Quotation = {
            id: Date.now(),
            quotation_number: `QT-${String(quotations.length + 1).padStart(4, "0")}`,
            customer_id: payload.customer_id,
            date: payload.date || new Date().toISOString().split("T")[0],
            valid_until: payload.valid_until || null,
            status: "draft",
            discount: payload.discount || 0,
            tax_percent: payload.tax_percent || 0,
            notes: payload.notes || null,
            terms: payload.terms || null,
            subtotal,
            total,
            linked_order_id: null,
            items: (payload.items || []).map((it: any, idx: number) => ({ ...it, id: Date.now() + idx, quotation_id: Date.now() })),
            created_by: payload.callerUsername,
            updated_by: payload.callerUsername,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          quotations.unshift(newQ);
          saveMockQuotations(quotations);
          return { success: true, data: newQ };
        }
        case "quotations:update": {
          const allowed = ["owner", "admin", "sales"].includes(payload.callerRole);
          if (!allowed) return { success: false, error: "Permission denied." };
          const quotations = getMockQuotations();
          const idx = quotations.findIndex((q: Quotation) => q.id === payload.id);
          if (idx === -1) return { success: false, error: "Quotation not found." };
          if (quotations[idx].status !== "draft") return { success: false, error: "Only draft quotations can be edited." };
          const subtotal = (payload.items || []).reduce((s: number, i: any) => s + i.line_total, 0);
          const disc = (subtotal * (payload.discount || 0)) / 100;
          const tax = ((subtotal - disc) * (payload.tax_percent || 0)) / 100;
          const total = subtotal - disc + tax;
          quotations[idx] = { ...quotations[idx], ...payload, subtotal, total, updated_at: new Date().toISOString() };
          saveMockQuotations(quotations);
          return { success: true, data: quotations[idx] };
        }
        case "quotations:update-status": {
          const allowed = ["owner", "admin", "sales"].includes(payload.callerRole);
          if (!allowed) return { success: false, error: "Permission denied." };
          const quotations = getMockQuotations();
          const idx = quotations.findIndex((q: Quotation) => q.id === payload.id);
          if (idx === -1) return { success: false, error: "Quotation not found." };
          quotations[idx].status = payload.status;
          quotations[idx].updated_at = new Date().toISOString();
          saveMockQuotations(quotations);
          return { success: true, data: true };
        }

        // ── Orders ────────────────────────────────────────────────────────────
        case "orders:list": {
          const orders = getMockOrders();
          const customers = getMockCustomers();
          const filtered = payload?.customer_id
            ? orders.filter((o: Order) => o.customer_id === payload.customer_id)
            : orders;
          return {
            success: true,
            data: filtered.map((o: Order) => ({
              ...o,
              customer_name: customers.find(c => c.id === o.customer_id)?.name ?? "Unknown",
            })),
          };
        }
        case "orders:get": {
          const o = getMockOrders().find((x: Order) => x.id === payload.id);
          if (!o) return { success: false, error: "Order not found." };
          const customers = getMockCustomers();
          return { success: true, data: { ...o, customer_name: customers.find(c => c.id === o.customer_id)?.name ?? "Unknown" } };
        }
        case "orders:create": {
          const allowed = ["owner", "admin", "sales"].includes(payload.callerRole);
          if (!allowed) return { success: false, error: "Permission denied." };
          const orders = getMockOrders();
          const subtotal = (payload.items || []).reduce((s: number, i: any) => s + i.line_total, 0);
          const newO: Order = {
            id: Date.now(),
            order_number: `OD-${String(orders.length + 1).padStart(4, "0")}`,
            customer_id: payload.customer_id,
            quotation_id: payload.quotation_id || null,
            order_date: payload.order_date || new Date().toISOString().split("T")[0],
            due_date: payload.due_date || null,
            priority: payload.priority || "normal",
            status: "confirmed",
            special_instructions: payload.special_instructions || null,
            cancel_reason: null,
            subtotal,
            total: subtotal,
            items: (payload.items || []).map((it: any, idx: number) => ({ ...it, id: Date.now() + idx, order_id: Date.now() })),
            created_by: payload.callerUsername,
            updated_by: payload.callerUsername,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          orders.unshift(newO);
          saveMockOrders(orders);
          return { success: true, data: newO };
        }
        case "orders:convert-from-quotation": {
          const allowed = ["owner", "admin", "sales"].includes(payload.callerRole);
          if (!allowed) return { success: false, error: "Permission denied." };
          const quotations = getMockQuotations();
          const qi = quotations.findIndex((q: Quotation) => q.id === payload.quotation_id);
          if (qi === -1) return { success: false, error: "Quotation not found." };
          if (quotations[qi].status !== "accepted") return { success: false, error: "Only accepted quotations can be converted." };
          const q = quotations[qi];
          const orders = getMockOrders();
          const newO: Order = {
            id: Date.now(),
            order_number: `OD-${String(orders.length + 1).padStart(4, "0")}`,
            customer_id: q.customer_id,
            quotation_id: q.id,
            order_date: new Date().toISOString().split("T")[0],
            due_date: payload.due_date || null,
            priority: payload.priority || "normal",
            status: "confirmed",
            special_instructions: null,
            cancel_reason: null,
            subtotal: q.subtotal,
            total: q.total,
            items: (q.items || []).map((it: any, idx: number) => ({ ...it, id: Date.now() + idx, order_id: Date.now() })),
            created_by: payload.callerUsername,
            updated_by: payload.callerUsername,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          orders.unshift(newO);
          saveMockOrders(orders);
          quotations[qi].linked_order_id = newO.id;
          saveMockQuotations(quotations);
          return { success: true, data: newO };
        }
        case "orders:update-status": {
          const allowed = ["owner", "admin", "sales"].includes(payload.callerRole);
          if (!allowed) return { success: false, error: "Permission denied." };
          if (payload.status === "cancelled" && !payload.cancel_reason?.trim()) {
            return { success: false, error: "A cancellation reason is required." };
          }
          const orders = getMockOrders();
          const idx = orders.findIndex((o: Order) => o.id === payload.id);
          if (idx === -1) return { success: false, error: "Order not found." };
          orders[idx].status = payload.status;
          if (payload.status === "cancelled") orders[idx].cancel_reason = payload.cancel_reason;
          orders[idx].updated_at = new Date().toISOString();
          saveMockOrders(orders);
          return { success: true, data: true };
        }

        default:
          return { success: false, error: `Unknown mock channel: ${channel}` };
      }
    },
    on: () => {
      return () => {};
    },
  };
}

/** Check if running inside real desktop Electron environment */
export const isElectron =
  typeof window !== "undefined" &&
  Boolean((window as any).process?.type || navigator.userAgent.includes("Electron"));

/** Generic helper — throws if the IPC call reports failure. */
async function call<T>(channel: string, payload?: unknown): Promise<T> {
  if (!window.api) {
    throw new Error("Electron API is not initialized.");
  }
  const res = await window.api.invoke(channel, payload);
  if (!res.success) throw new Error(res.error ?? "IPC error");
  return res.data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  checkOwnerExists: () => call<boolean>("auth:check-owner-exists"),

  createOwner: (payload: { full_name: string; username: string; password: string }) =>
    call<boolean>("auth:create-owner", payload),

  login: (payload: { username: string; password: string }) =>
    call<User>("auth:login", payload),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => call<User[]>("users:list"),

  create: (payload: {
    full_name: string;
    username: string;
    password: string;
    role: Role;
    callerRole: string;
    callerUsername?: string;
  }) => call<boolean>("users:create", payload),

  update: (payload: {
    id: number;
    full_name: string;
    role: Role;
    password?: string;
    callerRole: string;
    callerUsername?: string;
  }) => call<boolean>("users:update", payload),

  toggleActive: (payload: { id: number; active: boolean; callerRole: string; callerUsername?: string }) =>
    call<boolean>("users:toggle-active", payload),
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customersApi = {
  list: () => call<Customer[]>("customers:list"),

  get: (id: number) => call<Customer>("customers:get", { id }),

  checkPhone: (phone: string, excludeId?: number) =>
    call<{ id: number; name: string } | null>("customers:check-phone", { phone, excludeId }),

  create: (payload: {
    name: string;
    company?: string;
    phone: string;
    alternate_phone?: string;
    email?: string;
    billing_address?: string;
    delivery_address?: string;
    gst_number?: string;
    customer_type: CustomerType;
    credit_limit?: number;
    notes?: string;
    callerRole: string;
    callerUsername: string;
  }) => call<Customer>("customers:create", payload),

  update: (payload: {
    id: number;
    name: string;
    company?: string;
    phone: string;
    alternate_phone?: string;
    email?: string;
    billing_address?: string;
    delivery_address?: string;
    gst_number?: string;
    customer_type: CustomerType;
    credit_limit?: number;
    notes?: string;
    callerRole: string;
    callerUsername: string;
  }) => call<Customer>("customers:update", payload),

  toggleActive: (payload: {
    id: number;
    active: boolean;
    callerRole: string;
    callerUsername: string;
  }) => call<boolean>("customers:toggle-active", payload),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productsApi = {
  list: () => call<Product[]>("products:list"),

  get: (id: number) => call<Product>("products:get", { id }),

  create: (payload: {
    name: string;
    category?: string;
    unit?: string;
    retail_price?: number;
    wholesale_price?: number;
    slabs?: { min_quantity: number; price: number }[];
    callerRole: string;
    callerUsername: string;
  }) => call<Product>("products:create", payload),

  update: (payload: {
    id: number;
    name: string;
    category?: string;
    unit?: string;
    retail_price: number;
    wholesale_price: number;
    slabs?: { min_quantity: number; price: number }[];
    callerRole: string;
    callerUsername: string;
  }) => call<Product>("products:update", payload),

  toggleActive: (payload: {
    id: number;
    active: boolean;
    callerRole: string;
    callerUsername: string;
  }) => call<boolean>("products:toggle-active", payload),
};

// ── Backup ────────────────────────────────────────────────────────────────────
export const backupApi = {
  now: () => call<string>("backup:now"),
};

// ── App info ──────────────────────────────────────────────────────────────────
export const appApi = {
  getVersion: () => call<string>("app:get-version"),
};

// ── Quotations ────────────────────────────────────────────────────────────────
export const quotationsApi = {
  list: (customer_id?: number) =>
    call<Quotation[]>("quotations:list", customer_id ? { customer_id } : undefined),

  get: (id: number) => call<Quotation>("quotations:get", { id }),

  create: (payload: {
    customer_id: number;
    date?: string;
    valid_until?: string;
    discount?: number;
    tax_percent?: number;
    notes?: string;
    terms?: string;
    items: Array<{
      product_id?: number | null;
      description: string;
      specification?: string;
      quantity: number;
      rate: number;
      line_total: number;
      price_override?: boolean;
      override_reason?: string;
    }>;
    callerRole: string;
    callerUsername: string;
  }) => call<Quotation>("quotations:create", payload),

  update: (payload: {
    id: number;
    customer_id: number;
    date?: string;
    valid_until?: string;
    discount?: number;
    tax_percent?: number;
    notes?: string;
    terms?: string;
    items: Array<{
      product_id?: number | null;
      description: string;
      specification?: string;
      quantity: number;
      rate: number;
      line_total: number;
      price_override?: boolean;
      override_reason?: string;
    }>;
    callerRole: string;
    callerUsername: string;
  }) => call<Quotation>("quotations:update", payload),

  updateStatus: (payload: {
    id: number;
    status: string;
    callerRole: string;
    callerUsername: string;
  }) => call<boolean>("quotations:update-status", payload),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (customer_id?: number, callerRole?: string) =>
    call<Order[]>("orders:list", { customer_id, callerRole }),

  get: (id: number) => call<Order>("orders:get", { id }),

  create: (payload: {
    customer_id: number;
    quotation_id?: number | null;
    order_date?: string;
    due_date?: string;
    priority?: string;
    special_instructions?: string;
    items: Array<{
      product_id?: number | null;
      description: string;
      specification?: string;
      quantity: number;
      rate: number;
      line_total: number;
    }>;
    callerRole: string;
    callerUsername: string;
  }) => call<Order>("orders:create", payload),

  convertFromQuotation: (payload: {
    quotation_id: number;
    due_date?: string;
    priority?: string;
    callerRole: string;
    callerUsername: string;
  }) => call<Order>("orders:convert-from-quotation", payload),

  updateStatus: (payload: {
    id: number;
    status: string;
    cancel_reason?: string;
    callerRole: string;
    callerUsername: string;
  }) => call<boolean>("orders:update-status", payload),
};
