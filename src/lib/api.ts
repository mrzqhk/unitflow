/**
 * lib/api.ts — Typed wrappers around window.api.invoke().
 *
 * Every IPC call goes through here so we have type-safety in the renderer.
 * When running in Electron, calls use the real preload IPC bridge to SQLite.
 * When previewed in a standard web browser (where window.api is undefined),
 * a seamless local storage fallback is provided so the UI remains fully functional.
 */

import {
  User,
  Role,
  Customer,
  Product,
  CustomerType,
  Quotation,
  Order,
  Design,
  Payment,
  Invoice,
  CustomerDue,
  DuesSummary,
  CustomerBalance,
} from "../types";

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
  const STORAGE_DESIGNS = "unitflow_mock_designs";
  const STORAGE_PAYMENTS = "unitflow_mock_payments";
  const STORAGE_INVOICES = "unitflow_mock_invoices";

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

  // ── Mock Designs ───────────────────────────────────────────────────────────
  const getMockDesigns = (): Design[] => {
    try {
      const data = localStorage.getItem(STORAGE_DESIGNS);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  };
  const saveMockDesigns = (d: Design[]) => localStorage.setItem(STORAGE_DESIGNS, JSON.stringify(d));

  // ── Mock Payments ──────────────────────────────────────────────────────────
  const getMockPayments = (): Payment[] => {
    try {
      const data = localStorage.getItem(STORAGE_PAYMENTS);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  };
  const saveMockPayments = (p: Payment[]) => localStorage.setItem(STORAGE_PAYMENTS, JSON.stringify(p));

  // ── Mock Invoices ──────────────────────────────────────────────────────────
  const getMockInvoices = (): Invoice[] => {
    try {
      const data = localStorage.getItem(STORAGE_INVOICES);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  };
  const saveMockInvoices = (i: Invoice[]) => localStorage.setItem(STORAGE_INVOICES, JSON.stringify(i));

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
          const payments = getMockPayments();
          const designs = getMockDesigns();
          const filtered = payload?.customer_id
            ? orders.filter((o: Order) => o.customer_id === payload.customer_id)
            : orders;
          return {
            success: true,
            data: filtered.map((o: Order) => {
              const paid = payments
                .filter(p => p.order_id === o.id && !p.is_cancelled)
                .reduce((s, p) => s + p.amount, 0);
              let payment_status: any = "unpaid";
              if (paid >= o.total) payment_status = "paid";
              else if (paid > 0 && o.status === "confirmed") payment_status = "advance_paid";
              else if (paid > 0) payment_status = "partially_paid";

              const orderDesigns = designs.filter(d => d.order_id === o.id).sort((a, b) => b.version_number - a.version_number);

              return {
                ...o,
                customer_name: customers.find(c => c.id === o.customer_id)?.name ?? "Unknown",
                paid_amount: paid,
                balance_amount: Math.max(0, o.total - paid),
                payment_status,
                latest_design: orderDesigns[0] || null,
              };
            }),
          };
        }
        case "orders:get": {
          const o = getMockOrders().find((x: Order) => x.id === payload.id);
          if (!o) return { success: false, error: "Order not found." };
          const customers = getMockCustomers();
          const payments = getMockPayments();
          const designs = getMockDesigns();

          const paid = payments
            .filter(p => p.order_id === o.id && !p.is_cancelled)
            .reduce((s, p) => s + p.amount, 0);
          let payment_status: any = "unpaid";
          if (paid >= o.total) payment_status = "paid";
          else if (paid > 0 && o.status === "confirmed") payment_status = "advance_paid";
          else if (paid > 0) payment_status = "partially_paid";

          const orderDesigns = designs.filter(d => d.order_id === o.id).sort((a, b) => b.version_number - a.version_number);

          return {
            success: true,
            data: {
              ...o,
              customer_name: customers.find(c => c.id === o.customer_id)?.name ?? "Unknown",
              paid_amount: paid,
              balance_amount: Math.max(0, o.total - paid),
              payment_status,
              latest_design: orderDesigns[0] || null,
            },
          };
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
            paid_amount: 0,
            balance_amount: subtotal,
            payment_status: "unpaid",
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
            paid_amount: 0,
            balance_amount: q.total,
            payment_status: "unpaid",
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
          if (payload.status === "in_production") {
            const designs = getMockDesigns().filter(d => d.order_id === payload.id).sort((a, b) => b.version_number - a.version_number);
            if (designs.length === 0) {
              return { success: false, error: "Cannot move order to In Production: No design file has been uploaded for this order." };
            }
            if (designs[0].approval_status !== "approved") {
              return {
                success: false,
                error: `Cannot move order to In Production: Latest design (version ${designs[0].version_number}) is ${designs[0].approval_status}. The design must be approved first.`,
              };
            }
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

        // ── Designs ──────────────────────────────────────────────────────────
        case "designs:list": {
          const designs = getMockDesigns()
            .filter(d => d.order_id === payload.order_id)
            .sort((a, b) => b.version_number - a.version_number);
          return { success: true, data: designs };
        }
        case "designs:upload": {
          const designs = getMockDesigns();
          const existingForOrder = designs.filter(d => d.order_id === payload.order_id);
          const nextVersion = existingForOrder.length > 0 ? Math.max(...existingForOrder.map(d => d.version_number)) + 1 : 1;
          const newD: Design = {
            id: Date.now(),
            order_id: payload.order_id,
            version_number: nextVersion,
            file_path: `mock://designs/${payload.file_name}`,
            file_name: payload.file_name,
            uploaded_by: payload.callerUsername,
            uploaded_at: new Date().toISOString(),
            approval_status: "pending",
            approved_by_name: null,
            approved_on: null,
            approval_method: null,
            remarks: null,
            preview: payload.file_data?.startsWith("data:") ? payload.file_data : null,
          };
          designs.unshift(newD);
          saveMockDesigns(designs);
          return { success: true, data: newD };
        }
        case "designs:update-approval": {
          if (!payload.remarks?.trim()) {
            return { success: false, error: "A remark is required for any approval action." };
          }
          if (payload.approval_status === "approved") {
            if (!payload.approved_by_name?.trim()) return { success: false, error: "Approver name is required." };
            if (!payload.approval_method?.trim()) return { success: false, error: "Approval method is required." };
            if (!payload.approved_on?.trim()) return { success: false, error: "Approval date is required." };
          }
          const designs = getMockDesigns();
          const idx = designs.findIndex(d => d.id === payload.id);
          if (idx === -1) return { success: false, error: "Design not found." };
          designs[idx] = {
            ...designs[idx],
            approval_status: payload.approval_status,
            approved_by_name: payload.approval_status === "approved" ? payload.approved_by_name : null,
            approved_on: payload.approval_status === "approved" ? payload.approved_on : null,
            approval_method: payload.approval_status === "approved" ? payload.approval_method : null,
            remarks: payload.remarks.trim(),
          };
          saveMockDesigns(designs);
          return { success: true, data: designs[idx] };
        }
        case "designs:open-file": {
          return { success: true, data: true };
        }

        // ── Payments ─────────────────────────────────────────────────────────
        case "payments:list": {
          const payments = getMockPayments();
          const orders = getMockOrders();
          const customers = getMockCustomers();
          let filtered = payments;
          if (payload?.order_id) filtered = filtered.filter(p => p.order_id === payload.order_id);
          else if (payload?.customer_id) filtered = filtered.filter(p => p.customer_id === payload.customer_id);
          return {
            success: true,
            data: filtered.map(p => {
              const o = orders.find(x => x.id === p.order_id);
              const c = customers.find(x => x.id === p.customer_id);
              return {
                ...p,
                order_number: o?.order_number ?? `OD-${p.order_id}`,
                order_total: o?.total ?? 0,
                customer_name: c?.name ?? "Unknown",
              };
            }),
          };
        }
        case "payments:create": {
          const allowed = ["owner", "admin", "sales", "accountant"].includes(payload.callerRole);
          if (!allowed) return { success: false, error: "Permission denied." };
          if (!payload.amount || payload.amount <= 0) return { success: false, error: "Payment amount must be greater than zero." };

          const orders = getMockOrders();
          const o = orders.find(x => x.id === payload.order_id);
          if (!o) return { success: false, error: "Order not found." };

          const payments = getMockPayments();
          const currentPaid = payments.filter(p => p.order_id === o.id && !p.is_cancelled).reduce((s, p) => s + p.amount, 0);
          const remaining = Math.max(0, o.total - currentPaid);

          if (payload.amount > remaining + 0.01) {
            if (payload.callerRole !== "owner") {
              return {
                success: false,
                error: `Payment amount (₹${payload.amount}) exceeds remaining balance (₹${remaining.toFixed(2)}). Only the owner can approve an overpayment.`,
              };
            }
            if (!payload.overpayment_reason?.trim()) {
              return { success: false, error: "An approval reason is required when a payment exceeds the remaining order balance." };
            }
          }

          const newP: Payment = {
            id: Date.now(),
            order_id: payload.order_id,
            customer_id: payload.customer_id || o.customer_id,
            amount: payload.amount,
            payment_date: payload.payment_date || new Date().toISOString().split("T")[0],
            mode: payload.mode || "cash",
            reference_number: payload.reference_number || null,
            notes: payload.notes || (payload.overpayment_reason ? `Overpayment: ${payload.overpayment_reason}` : null),
            received_by: payload.callerUsername,
            is_cancelled: 0,
            cancel_reason: null,
            cancelled_by: null,
            cancelled_at: null,
            created_at: new Date().toISOString(),
          };
          payments.unshift(newP);
          saveMockPayments(payments);
          return { success: true, data: newP };
        }
        case "payments:cancel": {
          const allowed = ["owner", "admin", "sales", "accountant"].includes(payload.callerRole);
          if (!allowed) return { success: false, error: "Permission denied." };
          if (!payload.cancel_reason?.trim()) return { success: false, error: "A cancellation reason is required." };
          const payments = getMockPayments();
          const idx = payments.findIndex(p => p.id === payload.id);
          if (idx === -1) return { success: false, error: "Payment not found." };
          payments[idx].is_cancelled = 1;
          payments[idx].cancel_reason = payload.cancel_reason.trim();
          payments[idx].cancelled_by = payload.callerUsername;
          payments[idx].cancelled_at = new Date().toISOString();
          saveMockPayments(payments);
          return { success: true, data: true };
        }

        // ── Invoices ─────────────────────────────────────────────────────────
        case "invoices:list": {
          const invoices = getMockInvoices();
          const orders = getMockOrders();
          const customers = getMockCustomers();
          let filtered = invoices;
          if (payload?.order_id) filtered = filtered.filter(i => i.order_id === payload.order_id);
          else if (payload?.customer_id) filtered = filtered.filter(i => i.customer_id === payload.customer_id);
          return {
            success: true,
            data: filtered.map(i => {
              const o = orders.find(x => x.id === i.order_id);
              const c = customers.find(x => x.id === i.customer_id);
              return {
                ...i,
                order_number: o?.order_number ?? `OD-${i.order_id}`,
                customer_name: c?.name ?? "Unknown",
              };
            }),
          };
        }
        case "invoices:get": {
          const invoices = getMockInvoices();
          const inv = invoices.find(i => i.id === payload.id);
          if (!inv) return { success: false, error: "Invoice not found." };
          const orders = getMockOrders();
          const customers = getMockCustomers();
          const payments = getMockPayments();
          const o = orders.find(x => x.id === inv.order_id);
          const c = customers.find(x => x.id === inv.customer_id);
          const paid = payments.filter(p => p.order_id === inv.order_id && !p.is_cancelled).reduce((s, p) => s + p.amount, 0);
          return {
            success: true,
            data: {
              ...inv,
              order_number: o?.order_number,
              customer_name: c?.name,
              billing_address: c?.billing_address,
              gst_number: c?.gst_number,
              phone: c?.phone,
              amount_paid: paid,
              balance_due: Math.max(0, inv.total - paid),
            },
          };
        }
        case "invoices:create": {
          const allowed = ["owner", "admin", "sales", "accountant"].includes(payload.callerRole);
          if (!allowed) return { success: false, error: "Permission denied." };
          const invoices = getMockInvoices();
          const subtotal = payload.subtotal ?? (payload.items || []).reduce((s: number, it: any) => s + it.line_total, 0);
          const discount = payload.discount || 0;
          const discountAmt = (subtotal * discount) / 100;
          const taxPercent = payload.tax_percent || 0;
          const taxAmount = ((subtotal - discountAmt) * taxPercent) / 100;
          const total = subtotal - discountAmt + taxAmount;

          const newInv: Invoice = {
            id: Date.now(),
            invoice_number: `INV-${String(invoices.length + 1).padStart(4, "0")}`,
            order_id: payload.order_id,
            customer_id: payload.customer_id,
            date: payload.date || new Date().toISOString().split("T")[0],
            subtotal,
            discount,
            tax_percent: taxPercent,
            tax_amount: taxAmount,
            total,
            type: payload.type || "final",
            status: "issued",
            cancel_reason: null,
            cancelled_by: null,
            cancelled_at: null,
            notes: payload.notes || null,
            items: payload.items || [],
            created_by: payload.callerUsername,
            created_at: new Date().toISOString(),
          };
          invoices.unshift(newInv);
          saveMockInvoices(invoices);
          return { success: true, data: newInv };
        }
        case "invoices:cancel": {
          if (payload.callerRole !== "owner") {
            return { success: false, error: "Permission denied: Only the owner can cancel an issued invoice." };
          }
          if (!payload.cancel_reason?.trim()) {
            return { success: false, error: "A cancellation reason is required." };
          }
          const invoices = getMockInvoices();
          const idx = invoices.findIndex(i => i.id === payload.id);
          if (idx === -1) return { success: false, error: "Invoice not found." };
          invoices[idx].status = "cancelled";
          invoices[idx].cancel_reason = payload.cancel_reason.trim();
          invoices[idx].cancelled_by = payload.callerUsername;
          invoices[idx].cancelled_at = new Date().toISOString();
          saveMockInvoices(invoices);
          return { success: true, data: true };
        }

        // ── Dues & Customer Balance ──────────────────────────────────────────
        case "accounts:get-dues": {
          const customers = getMockCustomers();
          const orders = getMockOrders();
          const payments = getMockPayments();
          const invoices = getMockInvoices();

          const duesList: any[] = [];
          let totalOutstanding = 0;
          let totalCollected = 0;
          const today = new Date().toISOString().split("T")[0];
          const todayMs = new Date(today).getTime();

          for (const c of customers) {
            const custOrders = orders.filter(o => o.customer_id === c.id && o.status !== "cancelled");
            const totalOrders = custOrders.reduce((s, o) => s + o.total, 0);

            const custPayments = payments.filter(p => p.customer_id === c.id && !p.is_cancelled);
            const totalPaid = custPayments.reduce((s, p) => s + p.amount, 0);
            totalCollected += totalPaid;

            const balance = Math.max(0, totalOrders - totalPaid);

            if (balance > 0.01) {
              totalOutstanding += balance;
              const oldest = custOrders.sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime())[0];
              const oldestDate = oldest?.due_date || oldest?.order_date || today;
              const days = Math.max(0, Math.floor((todayMs - new Date(oldestDate).getTime()) / (1000 * 60 * 60 * 24)));

              duesList.push({
                customer_id: c.id,
                name: c.name,
                company: c.company,
                phone: c.phone,
                total_orders: totalOrders,
                total_paid: totalPaid,
                balance,
                oldest_date: oldestDate,
                days_overdue: days,
              });
            }
          }

          duesList.sort((a, b) => b.days_overdue - a.days_overdue);

          return {
            success: true,
            data: {
              dues: duesList,
              summary: {
                total_outstanding: totalOutstanding,
                total_collected: totalCollected,
                overdue_customers_count: duesList.length,
                total_invoices: invoices.filter(i => i.status !== "cancelled").length,
              },
            },
          };
        }
        case "customers:get-balance": {
          const orders = getMockOrders().filter(o => o.customer_id === payload.customer_id && o.status !== "cancelled");
          const payments = getMockPayments().filter(p => p.customer_id === payload.customer_id && !p.is_cancelled);
          const total_orders = orders.reduce((s, o) => s + o.total, 0);
          const total_paid = payments.reduce((s, p) => s + p.amount, 0);
          return {
            success: true,
            data: {
              total_orders,
              total_paid,
              balance: Math.max(0, total_orders - total_paid),
            },
          };
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

  getBalance: (customer_id: number) =>
    call<CustomerBalance>("customers:get-balance", { customer_id }),
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

// ── Designs ───────────────────────────────────────────────────────────────────
export const designsApi = {
  list: (order_id: number) =>
    call<Design[]>("designs:list", { order_id }),

  upload: (payload: {
    order_id: number;
    file_name: string;
    file_data: string;
    callerUsername: string;
  }) => call<Design>("designs:upload", payload),

  updateApproval: (payload: {
    id: number;
    approval_status: "approved" | "rejected" | "revision_requested";
    approved_by_name?: string;
    approved_on?: string;
    approval_method?: string;
    remarks: string;
    callerRole: string;
    callerUsername: string;
  }) => call<Design>("designs:update-approval", payload),

  openFile: (id: number) =>
    call<boolean>("designs:open-file", { id }),
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const paymentsApi = {
  list: (order_id?: number, customer_id?: number) =>
    call<Payment[]>("payments:list", { order_id, customer_id }),

  create: (payload: {
    order_id: number;
    customer_id: number;
    amount: number;
    payment_date: string;
    mode: string;
    reference_number?: string;
    notes?: string;
    overpayment_reason?: string;
    callerRole: string;
    callerUsername: string;
  }) => call<Payment>("payments:create", payload),

  cancel: (payload: {
    id: number;
    cancel_reason: string;
    callerRole: string;
    callerUsername: string;
  }) => call<boolean>("payments:cancel", payload),
};

// ── Invoices ──────────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: (order_id?: number, customer_id?: number) =>
    call<Invoice[]>("invoices:list", { order_id, customer_id }),

  get: (id: number) =>
    call<Invoice>("invoices:get", { id }),

  create: (payload: {
    order_id: number;
    customer_id: number;
    type?: "advance" | "partial" | "final";
    date?: string;
    subtotal?: number;
    discount?: number;
    tax_percent?: number;
    notes?: string;
    items: Array<{
      description: string;
      specification?: string;
      quantity: number;
      rate: number;
      line_total: number;
    }>;
    callerRole: string;
    callerUsername: string;
  }) => call<Invoice>("invoices:create", payload),

  cancel: (payload: {
    id: number;
    cancel_reason: string;
    callerRole: string;
    callerUsername: string;
  }) => call<boolean>("invoices:cancel", payload),
};

// ── Accounts & Dues ───────────────────────────────────────────────────────────
export const accountsApi = {
  getDues: () =>
    call<{ dues: CustomerDue[]; summary: DuesSummary }>("accounts:get-dues"),
};
