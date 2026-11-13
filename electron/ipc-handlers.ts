/**
 * ipc-handlers.ts — All IPC handlers for the main process.
 *
 * Every database read/write happens HERE, never in the renderer.
 * The renderer calls window.api.invoke(channel, payload) and gets
 * a plain JSON-serialisable result back.
 *
 * Handlers return { success: true, data } or { success: false, error: string }.
 */

const bcrypt = require("bcryptjs");
const { dbAll, dbGet, dbRun, recordAudit } = require("./database");
const { app, shell } = require("electron");
const fs = require("fs");
const path = require("path");

// ── Role type ────────────────────────────────────────────────────────────────
type Role =
  | "owner"
  | "sales"
  | "designer"
  | "supervisor"
  | "worker"
  | "store"
  | "delivery"
  | "accountant";

// Helper: wrap a handler so errors are always returned as { success: false, error }
function safe(fn: (...args: any[]) => any) {
  return async (_event: any, ...args: any[]) => {
    try {
      const result = await fn(...args);
      return { success: true, data: result };
    } catch (err: any) {
      console.error("[IPC Error]", err);
      return { success: false, error: err?.message ?? "Unknown error" };
    }
  };
}

export function setupIpcHandlers(ipcMain: any) {
  // ── Auth ──────────────────────────────────────────────────────────────────

  /** Check if an owner account exists. Used to pick first-run vs login screen. */
  ipcMain.handle(
    "auth:check-owner-exists",
    safe(() => {
      const row = dbGet("SELECT COUNT(*) AS cnt FROM users WHERE role = 'owner' AND active = 1");
      return ((row?.cnt as number) ?? 0) > 0;
    })
  );

  /** Create the very first owner account (only when none exists). */
  ipcMain.handle(
    "auth:create-owner",
    safe(async (payload: { full_name: string; username: string; password: string }) => {
      const existing = dbGet("SELECT COUNT(*) AS cnt FROM users WHERE role = 'owner'");
      if ((existing?.cnt as number) > 0) {
        throw new Error("An owner account already exists.");
      }
      const hash = await bcrypt.hash(payload.password, 12);
      dbRun(
        "INSERT INTO users (full_name, username, password_hash, role, active) VALUES (?, ?, ?, 'owner', 1)",
        [payload.full_name, payload.username, hash]
      );
      const user = dbGet("SELECT id, full_name, username, role FROM users WHERE username = ?", [payload.username]);
      if (user) {
        recordAudit("user", user.id, "create_owner", payload.username, null, { username: payload.username, full_name: payload.full_name });
      }
      return true;
    })
  );

  /** Login: verify credentials, return safe user info (no hash sent). */
  ipcMain.handle(
    "auth:login",
    safe(async (payload: { username: string; password: string }) => {
      const user = dbGet(
        "SELECT * FROM users WHERE username = ? AND active = 1",
        [payload.username]
      );
      if (!user) throw new Error("Invalid username or password.");
      const valid = await bcrypt.compare(payload.password, user.password_hash);
      if (!valid) throw new Error("Invalid username or password.");
      return {
        id:        user.id,
        full_name: user.full_name,
        username:  user.username,
        role:      user.role,
        active:    user.active,
      };
    })
  );

  // ── Users (owner-only — enforced in main process) ─────────────────────────

  /** List all users (id, name, username, role, active — no hash). */
  ipcMain.handle(
    "users:list",
    safe(() =>
      dbAll("SELECT id, full_name, username, role, active, created_at FROM users ORDER BY id")
    )
  );

  /** Create a new user. Caller must pass their role for server-side enforcement. */
  ipcMain.handle(
    "users:create",
    safe(async (payload: {
      full_name: string;
      username: string;
      password: string;
      role: Role;
      callerRole: string;
      callerUsername?: string;
    }) => {
      if (payload.callerRole !== "owner") throw new Error("Only the owner can create users.");
      const hash = await bcrypt.hash(payload.password, 12);
      dbRun(
        "INSERT INTO users (full_name, username, password_hash, role, active) VALUES (?, ?, ?, ?, 1)",
        [payload.full_name, payload.username, hash, payload.role]
      );
      const inserted = dbGet("SELECT id, full_name, username, role, active FROM users WHERE username = ?", [payload.username]);
      if (inserted) {
        recordAudit("user", inserted.id, "create", payload.callerUsername || "owner", null, inserted);
      }
      return true;
    })
  );

  /** Update a user's name, role, and optionally reset password. */
  ipcMain.handle(
    "users:update",
    safe(async (payload: {
      id: number;
      full_name: string;
      role: Role;
      password?: string;
      callerRole: string;
      callerUsername?: string;
    }) => {
      if (payload.callerRole !== "owner") throw new Error("Only the owner can edit users.");
      const oldUser = dbGet("SELECT id, full_name, username, role, active FROM users WHERE id = ?", [payload.id]);
      if (payload.password) {
        const hash = await bcrypt.hash(payload.password, 12);
        dbRun(
          "UPDATE users SET full_name = ?, role = ?, password_hash = ?, updated_at = datetime('now') WHERE id = ?",
          [payload.full_name, payload.role, hash, payload.id]
        );
      } else {
        dbRun(
          "UPDATE users SET full_name = ?, role = ?, updated_at = datetime('now') WHERE id = ?",
          [payload.full_name, payload.role, payload.id]
        );
      }
      recordAudit("user", payload.id, "update", payload.callerUsername || "owner", oldUser, {
        full_name: payload.full_name,
        role: payload.role,
      });
      return true;
    })
  );

  /** Enable or disable a user account. */
  ipcMain.handle(
    "users:toggle-active",
    safe((payload: { id: number; active: boolean; callerRole: string; callerUsername?: string }) => {
      if (payload.callerRole !== "owner") throw new Error("Only the owner can enable/disable users.");
      const oldUser = dbGet("SELECT id, full_name, username, role, active FROM users WHERE id = ?", [payload.id]);
      dbRun(
        "UPDATE users SET active = ?, updated_at = datetime('now') WHERE id = ?",
        [payload.active ? 1 : 0, payload.id]
      );
      recordAudit("user", payload.id, payload.active ? "enable" : "disable", payload.callerUsername || "owner", oldUser, { active: payload.active });
      return true;
    })
  );

  // ── Customers ─────────────────────────────────────────────────────────────

  /** List all customers. */
  ipcMain.handle(
    "customers:list",
    safe(() =>
      dbAll("SELECT * FROM customers ORDER BY id DESC")
    )
  );

  /** Get single customer by id. */
  ipcMain.handle(
    "customers:get",
    safe((payload: { id: number }) => {
      const cust = dbGet("SELECT * FROM customers WHERE id = ?", [payload.id]);
      if (!cust) throw new Error("Customer not found.");
      return cust;
    })
  );

  /** Check if a phone number already exists (for warnings/validation). */
  ipcMain.handle(
    "customers:check-phone",
    safe((payload: { phone: string; excludeId?: number }) => {
      let query = "SELECT id, name, phone FROM customers WHERE phone = ?";
      const params: any[] = [payload.phone.trim()];
      if (payload.excludeId) {
        query += " AND id != ?";
        params.push(payload.excludeId);
      }
      const existing = dbGet(query, params);
      return existing || null;
    })
  );

  /** Create a new customer (owner, admin, sales only). */
  ipcMain.handle(
    "customers:create",
    safe((payload: {
      name: string;
      company?: string;
      phone: string;
      alternate_phone?: string;
      email?: string;
      billing_address?: string;
      delivery_address?: string;
      gst_number?: string;
      customer_type?: "retail" | "wholesale";
      credit_limit?: number;
      notes?: string;
      callerRole: string;
      callerUsername: string;
    }) => {
      const isAllowed = ["owner", "admin", "sales"].includes(payload.callerRole);
      if (!isAllowed) {
        throw new Error("Permission denied: Only owner, admin and sales roles can add customers.");
      }

      if (!payload.name || !payload.name.trim()) throw new Error("Customer name is required.");
      if (!payload.phone || !payload.phone.trim()) throw new Error("Phone number is required.");

      dbRun(
        `INSERT INTO customers (
          name, company, phone, alternate_phone, email, billing_address, delivery_address,
          gst_number, customer_type, credit_limit, notes, active, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          payload.name.trim(),
          payload.company?.trim() || null,
          payload.phone.trim(),
          payload.alternate_phone?.trim() || null,
          payload.email?.trim() || null,
          payload.billing_address?.trim() || null,
          payload.delivery_address?.trim() || null,
          payload.gst_number?.trim() || null,
          payload.customer_type || "retail",
          payload.credit_limit || 0,
          payload.notes?.trim() || null,
          payload.callerUsername,
          payload.callerUsername,
        ]
      );

      const inserted = dbGet("SELECT * FROM customers WHERE id = last_insert_rowid()");
      if (inserted) {
        recordAudit("customer", inserted.id, "create", payload.callerUsername, null, inserted);
      }
      return inserted;
    })
  );

  /** Update customer (owner, admin, sales only). */
  ipcMain.handle(
    "customers:update",
    safe((payload: {
      id: number;
      name: string;
      company?: string;
      phone: string;
      alternate_phone?: string;
      email?: string;
      billing_address?: string;
      delivery_address?: string;
      gst_number?: string;
      customer_type?: "retail" | "wholesale";
      credit_limit?: number;
      notes?: string;
      callerRole: string;
      callerUsername: string;
    }) => {
      const isAllowed = ["owner", "admin", "sales"].includes(payload.callerRole);
      if (!isAllowed) {
        throw new Error("Permission denied: Only owner, admin and sales roles can edit customers.");
      }

      const oldCust = dbGet("SELECT * FROM customers WHERE id = ?", [payload.id]);
      if (!oldCust) throw new Error("Customer not found.");

      if (!payload.name || !payload.name.trim()) throw new Error("Customer name is required.");
      if (!payload.phone || !payload.phone.trim()) throw new Error("Phone number is required.");

      dbRun(
        `UPDATE customers SET
          name = ?, company = ?, phone = ?, alternate_phone = ?, email = ?,
          billing_address = ?, delivery_address = ?, gst_number = ?,
          customer_type = ?, credit_limit = ?, notes = ?,
          updated_by = ?, updated_at = datetime('now')
        WHERE id = ?`,
        [
          payload.name.trim(),
          payload.company?.trim() || null,
          payload.phone.trim(),
          payload.alternate_phone?.trim() || null,
          payload.email?.trim() || null,
          payload.billing_address?.trim() || null,
          payload.delivery_address?.trim() || null,
          payload.gst_number?.trim() || null,
          payload.customer_type || "retail",
          payload.credit_limit || 0,
          payload.notes?.trim() || null,
          payload.callerUsername,
          payload.id,
        ]
      );

      const updatedCust = dbGet("SELECT * FROM customers WHERE id = ?", [payload.id]);
      recordAudit("customer", payload.id, "update", payload.callerUsername, oldCust, updatedCust);
      return updatedCust;
    })
  );

  /** Toggle customer active state (owner, admin, sales only). */
  ipcMain.handle(
    "customers:toggle-active",
    safe((payload: { id: number; active: boolean; callerRole: string; callerUsername: string }) => {
      const isAllowed = ["owner", "admin", "sales"].includes(payload.callerRole);
      if (!isAllowed) {
        throw new Error("Permission denied: Only owner, admin and sales roles can disable or enable customers.");
      }

      const oldCust = dbGet("SELECT * FROM customers WHERE id = ?", [payload.id]);
      if (!oldCust) throw new Error("Customer not found.");

      dbRun(
        "UPDATE customers SET active = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?",
        [payload.active ? 1 : 0, payload.callerUsername, payload.id]
      );

      recordAudit(
        "customer",
        payload.id,
        payload.active ? "enable" : "disable",
        payload.callerUsername,
        oldCust,
        { active: payload.active }
      );
      return true;
    })
  );

  // ── Products & Wholesale Slabs ────────────────────────────────────────────

  /** List all products with their wholesale slabs. */
  ipcMain.handle(
    "products:list",
    safe(() => {
      const products = dbAll("SELECT * FROM products ORDER BY id DESC");
      for (const p of products) {
        p.slabs = dbAll(
          "SELECT id, min_quantity, price FROM wholesale_slabs WHERE product_id = ? ORDER BY min_quantity ASC",
          [p.id]
        );
      }
      return products;
    })
  );

  /** Get single product by id with wholesale slabs. */
  ipcMain.handle(
    "products:get",
    safe((payload: { id: number }) => {
      const p = dbGet("SELECT * FROM products WHERE id = ?", [payload.id]);
      if (!p) throw new Error("Product not found.");
      p.slabs = dbAll(
        "SELECT id, min_quantity, price FROM wholesale_slabs WHERE product_id = ? ORDER BY min_quantity ASC",
        [p.id]
      );
      return p;
    })
  );

  /** Create a new product. If prices are provided, caller must be owner. */
  ipcMain.handle(
    "products:create",
    safe((payload: {
      name: string;
      category?: string;
      unit?: string;
      retail_price?: number;
      wholesale_price?: number;
      slabs?: { min_quantity: number; price: number }[];
      callerRole: string;
      callerUsername: string;
    }) => {
      const isOwner = payload.callerRole === "owner";
      const hasPrices =
        (payload.retail_price && payload.retail_price > 0) ||
        (payload.wholesale_price && payload.wholesale_price > 0) ||
        (payload.slabs && payload.slabs.length > 0);

      if (hasPrices && !isOwner) {
        throw new Error("Permission denied: Only the owner can set or edit prices.");
      }

      if (!payload.name || !payload.name.trim()) throw new Error("Product name is required.");

      dbRun(
        `INSERT INTO products (
          name, category, unit, retail_price, wholesale_price, active, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          payload.name.trim(),
          payload.category?.trim() || "General",
          payload.unit?.trim() || "pcs",
          isOwner ? (payload.retail_price || 0) : 0,
          isOwner ? (payload.wholesale_price || 0) : 0,
          payload.callerUsername,
          payload.callerUsername,
        ]
      );

      const inserted = dbGet("SELECT * FROM products WHERE id = last_insert_rowid()");
      if (inserted && isOwner && payload.slabs && Array.isArray(payload.slabs)) {
        for (const slab of payload.slabs) {
          if (slab.min_quantity > 0 && slab.price >= 0) {
            dbRun(
              "INSERT INTO wholesale_slabs (product_id, min_quantity, price) VALUES (?, ?, ?)",
              [inserted.id, slab.min_quantity, slab.price]
            );
          }
        }
      }

      const finalProduct = dbGet("SELECT * FROM products WHERE id = ?", [inserted.id]);
      if (finalProduct) {
        finalProduct.slabs = dbAll("SELECT id, min_quantity, price FROM wholesale_slabs WHERE product_id = ?", [inserted.id]);
        recordAudit("product", inserted.id, "create", payload.callerUsername, null, finalProduct);
      }
      return finalProduct;
    })
  );

  /** Update product. Only owner can modify retail_price, wholesale_price, or slabs. */
  ipcMain.handle(
    "products:update",
    safe((payload: {
      id: number;
      name: string;
      category?: string;
      unit?: string;
      retail_price: number;
      wholesale_price: number;
      slabs?: { min_quantity: number; price: number }[];
      callerRole: string;
      callerUsername: string;
    }) => {
      const oldProduct = dbGet("SELECT * FROM products WHERE id = ?", [payload.id]);
      if (!oldProduct) throw new Error("Product not found.");

      const isOwner = payload.callerRole === "owner";
      const oldSlabs = dbAll("SELECT id, min_quantity, price FROM wholesale_slabs WHERE product_id = ?", [payload.id]);

      // Check if prices or slabs are modified
      const priceModified =
        Number(payload.retail_price) !== Number(oldProduct.retail_price) ||
        Number(payload.wholesale_price) !== Number(oldProduct.wholesale_price);

      const oldSlabsClean = oldSlabs.map(s => ({ min_quantity: Number(s.min_quantity), price: Number(s.price) }));
      const newSlabsClean = (payload.slabs || []).map(s => ({ min_quantity: Number(s.min_quantity), price: Number(s.price) }));
      const slabsModified = JSON.stringify(oldSlabsClean) !== JSON.stringify(newSlabsClean);

      if ((priceModified || slabsModified) && !isOwner) {
        throw new Error("Permission denied: Only the owner can edit prices.");
      }

      if (!payload.name || !payload.name.trim()) throw new Error("Product name is required.");

      const retailPrice = isOwner ? Number(payload.retail_price || 0) : oldProduct.retail_price;
      const wholesalePrice = isOwner ? Number(payload.wholesale_price || 0) : oldProduct.wholesale_price;

      dbRun(
        `UPDATE products SET
          name = ?, category = ?, unit = ?, retail_price = ?, wholesale_price = ?,
          updated_by = ?, updated_at = datetime('now')
        WHERE id = ?`,
        [
          payload.name.trim(),
          payload.category?.trim() || "General",
          payload.unit?.trim() || "pcs",
          retailPrice,
          wholesalePrice,
          payload.callerUsername,
          payload.id,
        ]
      );

      // If owner updated slabs, replace them
      if (isOwner && payload.slabs) {
        dbRun("DELETE FROM wholesale_slabs WHERE product_id = ?", [payload.id]);
        for (const slab of payload.slabs) {
          if (slab.min_quantity > 0 && slab.price >= 0) {
            dbRun(
              "INSERT INTO wholesale_slabs (product_id, min_quantity, price) VALUES (?, ?, ?)",
              [payload.id, slab.min_quantity, slab.price]
            );
          }
        }
      }

      const updatedProduct = dbGet("SELECT * FROM products WHERE id = ?", [payload.id]);
      updatedProduct.slabs = dbAll("SELECT id, min_quantity, price FROM wholesale_slabs WHERE product_id = ?", [payload.id]);

      recordAudit(
        "product",
        payload.id,
        "update",
        payload.callerUsername,
        { ...oldProduct, slabs: oldSlabs },
        updatedProduct
      );

      return updatedProduct;
    })
  );

  /** Toggle product active state. */
  ipcMain.handle(
    "products:toggle-active",
    safe((payload: { id: number; active: boolean; callerRole: string; callerUsername: string }) => {
      const oldProduct = dbGet("SELECT * FROM products WHERE id = ?", [payload.id]);
      if (!oldProduct) throw new Error("Product not found.");

      dbRun(
        "UPDATE products SET active = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?",
        [payload.active ? 1 : 0, payload.callerUsername, payload.id]
      );

      recordAudit(
        "product",
        payload.id,
        payload.active ? "enable" : "disable",
        payload.callerUsername,
        oldProduct,
        { active: payload.active }
      );
      return true;
    })
  );

  // ── Quotations ────────────────────────────────────────────────────────────

  /** Roles that can create/edit quotations: owner, admin, sales */
  const CAN_MANAGE_QUOTES = ["owner", "admin", "sales"];

  /** Generate next quotation number: QT-0001, QT-0002 … */
  function nextQuotationNumber(): string {
    const row = dbGet("SELECT COUNT(*) AS cnt FROM quotations");
    const n = ((row?.cnt as number) ?? 0) + 1;
    return `QT-${String(n).padStart(4, "0")}`;
  }

  /** Generate next order number: OD-0001, OD-0002 … */
  function nextOrderNumber(): string {
    const row = dbGet("SELECT COUNT(*) AS cnt FROM orders");
    const n = ((row?.cnt as number) ?? 0) + 1;
    return `OD-${String(n).padStart(4, "0")}`;
  }

  /** Attach items array to a quotation row. */
  function attachQuotationItems(q: any) {
    q.items = dbAll(
      "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC",
      [q.id]
    );
    return q;
  }

  /** Calculate payment status and amounts for an order. */
  function enrichOrderPaymentInfo(o: any) {
    const paidRow = dbGet(
      "SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE order_id = ? AND is_cancelled = 0",
      [o.id]
    );
    const paid = Number(paidRow?.total_paid ?? 0);
    o.paid_amount = paid;
    o.balance_amount = Math.max(0, Number(o.total || 0) - paid);
    if (paid <= 0) {
      o.payment_status = "unpaid";
    } else if (paid >= Number(o.total || 0)) {
      o.payment_status = "paid";
    } else if (o.status === "confirmed") {
      o.payment_status = "advance_paid";
    } else {
      o.payment_status = "partially_paid";
    }
    return o;
  }

  /** Attach items array and payment/design stats to an order row. */
  function attachOrderItems(o: any) {
    o.items = dbAll(
      "SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order ASC",
      [o.id]
    );
    enrichOrderPaymentInfo(o);
    o.latest_design = dbGet(
      "SELECT * FROM designs WHERE order_id = ? ORDER BY version_number DESC, id DESC LIMIT 1",
      [o.id]
    );
    return o;
  }

  /** List all quotations (with customer name). */
  ipcMain.handle(
    "quotations:list",
    safe((payload?: { customer_id?: number }) => {
      let sql = `
        SELECT q.*, c.name AS customer_name, c.customer_type
        FROM quotations q
        JOIN customers c ON c.id = q.customer_id
      `;
      const params: any[] = [];
      if (payload?.customer_id) {
        sql += " WHERE q.customer_id = ?";
        params.push(payload.customer_id);
      }
      sql += " ORDER BY q.id DESC";
      return dbAll(sql, params);
    })
  );

  /** Get a single quotation with its items. */
  ipcMain.handle(
    "quotations:get",
    safe((payload: { id: number }) => {
      const q = dbGet(
        `SELECT q.*, c.name AS customer_name, c.customer_type, c.billing_address, c.gst_number
         FROM quotations q
         JOIN customers c ON c.id = q.customer_id
         WHERE q.id = ?`,
        [payload.id]
      );
      if (!q) throw new Error("Quotation not found.");
      return attachQuotationItems(q);
    })
  );

  /** Create a new quotation (draft). */
  ipcMain.handle(
    "quotations:create",
    safe((payload: {
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
    }) => {
      if (!CAN_MANAGE_QUOTES.includes(payload.callerRole)) {
        throw new Error("Permission denied: Only owner, admin or sales can create quotations.");
      }

      // Calculate totals
      const subtotal = payload.items.reduce((sum, it) => sum + it.line_total, 0);
      const discountAmt = (subtotal * (payload.discount || 0)) / 100;
      const taxAmt = ((subtotal - discountAmt) * (payload.tax_percent || 0)) / 100;
      const total = subtotal - discountAmt + taxAmt;

      const qNum = nextQuotationNumber();

      dbRun(
        `INSERT INTO quotations
          (quotation_number, customer_id, date, valid_until, status, discount, tax_percent,
           notes, terms, subtotal, total, created_by, updated_by)
         VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          qNum,
          payload.customer_id,
          payload.date || new Date().toISOString().split("T")[0],
          payload.valid_until || null,
          payload.discount || 0,
          payload.tax_percent || 0,
          payload.notes || null,
          payload.terms || null,
          subtotal,
          total,
          payload.callerUsername,
          payload.callerUsername,
        ]
      );

      const inserted = dbGet("SELECT * FROM quotations WHERE id = last_insert_rowid()");
      if (!inserted) throw new Error("Failed to create quotation.");

      // Insert items
      payload.items.forEach((item, idx) => {
        dbRun(
          `INSERT INTO quotation_items
            (quotation_id, product_id, description, specification, quantity, rate, line_total,
             price_override, override_reason, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            inserted.id,
            item.product_id || null,
            item.description,
            item.specification || null,
            item.quantity,
            item.rate,
            item.line_total,
            item.price_override ? 1 : 0,
            item.override_reason || null,
            idx,
          ]
        );
      });

      recordAudit("quotation", inserted.id, "create", payload.callerUsername, null, { quotation_number: qNum, customer_id: payload.customer_id, total });
      return attachQuotationItems(dbGet("SELECT * FROM quotations WHERE id = ?", [inserted.id]));
    })
  );

  /** Update a quotation (only allowed while in draft status). */
  ipcMain.handle(
    "quotations:update",
    safe((payload: {
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
    }) => {
      if (!CAN_MANAGE_QUOTES.includes(payload.callerRole)) {
        throw new Error("Permission denied: Only owner, admin or sales can edit quotations.");
      }

      const old = dbGet("SELECT * FROM quotations WHERE id = ?", [payload.id]);
      if (!old) throw new Error("Quotation not found.");
      if (old.status !== "draft") throw new Error("Only draft quotations can be edited.");

      // Recalculate totals
      const subtotal = payload.items.reduce((sum, it) => sum + it.line_total, 0);
      const discountAmt = (subtotal * (payload.discount || 0)) / 100;
      const taxAmt = ((subtotal - discountAmt) * (payload.tax_percent || 0)) / 100;
      const total = subtotal - discountAmt + taxAmt;

      dbRun(
        `UPDATE quotations SET
          customer_id = ?, date = ?, valid_until = ?, discount = ?, tax_percent = ?,
          notes = ?, terms = ?, subtotal = ?, total = ?,
          updated_by = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          payload.customer_id,
          payload.date || old.date,
          payload.valid_until || null,
          payload.discount || 0,
          payload.tax_percent || 0,
          payload.notes || null,
          payload.terms || null,
          subtotal,
          total,
          payload.callerUsername,
          payload.id,
        ]
      );

      // Replace items
      dbRun("DELETE FROM quotation_items WHERE quotation_id = ?", [payload.id]);
      payload.items.forEach((item, idx) => {
        dbRun(
          `INSERT INTO quotation_items
            (quotation_id, product_id, description, specification, quantity, rate, line_total,
             price_override, override_reason, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            payload.id,
            item.product_id || null,
            item.description,
            item.specification || null,
            item.quantity,
            item.rate,
            item.line_total,
            item.price_override ? 1 : 0,
            item.override_reason || null,
            idx,
          ]
        );
      });

      const updated = attachQuotationItems(dbGet("SELECT * FROM quotations WHERE id = ?", [payload.id]));
      recordAudit("quotation", payload.id, "update", payload.callerUsername, old, { total });
      return updated;
    })
  );

  /** Change quotation status (sent, accepted, rejected, expired). */
  ipcMain.handle(
    "quotations:update-status",
    safe((payload: { id: number; status: string; callerRole: string; callerUsername: string }) => {
      if (!CAN_MANAGE_QUOTES.includes(payload.callerRole)) {
        throw new Error("Permission denied.");
      }
      const old = dbGet("SELECT * FROM quotations WHERE id = ?", [payload.id]);
      if (!old) throw new Error("Quotation not found.");

      dbRun(
        "UPDATE quotations SET status = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?",
        [payload.status, payload.callerUsername, payload.id]
      );
      recordAudit("quotation", payload.id, `status_change:${payload.status}`, payload.callerUsername, { status: old.status }, { status: payload.status });
      return true;
    })
  );

  // ── Orders ─────────────────────────────────────────────────────────────────

  /** Roles that can create/edit orders: owner, admin, sales */
  const CAN_MANAGE_ORDERS = ["owner", "admin", "sales"];

  /** Roles that can VIEW orders: owner, admin, sales, supervisor, production, delivery, accountant */
  const CAN_VIEW_ORDERS = ["owner", "admin", "sales", "supervisor", "worker", "store", "delivery", "accountant", "designer"];

  /** List all orders with customer name. */
  ipcMain.handle(
    "orders:list",
    safe((payload?: { customer_id?: number; callerRole?: string }) => {
      // All roles who need orders can view them; others blocked
      if (payload?.callerRole && !CAN_VIEW_ORDERS.includes(payload.callerRole)) {
        throw new Error("Permission denied: Your role cannot view orders.");
      }

      let sql = `
        SELECT o.*, c.name AS customer_name
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
      `;
      const params: any[] = [];
      if (payload?.customer_id) {
        sql += " WHERE o.customer_id = ?";
        params.push(payload.customer_id);
      }
      sql += " ORDER BY o.id DESC";
      const orders = dbAll(sql, params);
      return orders.map(enrichOrderPaymentInfo);
    })
  );

  /** Get a single order with its items. */
  ipcMain.handle(
    "orders:get",
    safe((payload: { id: number }) => {
      const o = dbGet(
        `SELECT o.*, c.name AS customer_name, c.billing_address, c.gst_number
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         WHERE o.id = ?`,
        [payload.id]
      );
      if (!o) throw new Error("Order not found.");
      return attachOrderItems(o);
    })
  );

  /** Create a new order directly (not from quotation). */
  ipcMain.handle(
    "orders:create",
    safe((payload: {
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
    }) => {
      if (!CAN_MANAGE_ORDERS.includes(payload.callerRole)) {
        throw new Error("Permission denied: Only owner, admin or sales can create orders.");
      }

      const subtotal = payload.items.reduce((sum, it) => sum + it.line_total, 0);
      const oNum = nextOrderNumber();

      dbRun(
        `INSERT INTO orders
          (order_number, customer_id, quotation_id, order_date, due_date, priority, status,
           special_instructions, subtotal, total, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)`,
        [
          oNum,
          payload.customer_id,
          payload.quotation_id || null,
          payload.order_date || new Date().toISOString().split("T")[0],
          payload.due_date || null,
          payload.priority || "normal",
          payload.special_instructions || null,
          subtotal,
          subtotal,
          payload.callerUsername,
          payload.callerUsername,
        ]
      );

      const inserted = dbGet("SELECT * FROM orders WHERE id = last_insert_rowid()");
      if (!inserted) throw new Error("Failed to create order.");

      payload.items.forEach((item, idx) => {
        dbRun(
          `INSERT INTO order_items
            (order_id, product_id, description, specification, quantity, rate, line_total, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            inserted.id,
            item.product_id || null,
            item.description,
            item.specification || null,
            item.quantity,
            item.rate,
            item.line_total,
            idx,
          ]
        );
      });

      recordAudit("order", inserted.id, "create", payload.callerUsername, null, { order_number: oNum, customer_id: payload.customer_id, total: subtotal });
      return attachOrderItems(dbGet("SELECT * FROM orders WHERE id = ?", [inserted.id]));
    })
  );

  /** Convert an accepted quotation into an order. */
  ipcMain.handle(
    "orders:convert-from-quotation",
    safe((payload: { quotation_id: number; due_date?: string; priority?: string; callerRole: string; callerUsername: string }) => {
      if (!CAN_MANAGE_ORDERS.includes(payload.callerRole)) {
        throw new Error("Permission denied.");
      }

      const q = dbGet("SELECT * FROM quotations WHERE id = ?", [payload.quotation_id]);
      if (!q) throw new Error("Quotation not found.");
      if (q.status !== "accepted") throw new Error("Only accepted quotations can be converted to orders.");
      if (q.linked_order_id) throw new Error("This quotation already has a linked order.");

      const items = dbAll("SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order", [q.id]);
      const oNum = nextOrderNumber();

      dbRun(
        `INSERT INTO orders
          (order_number, customer_id, quotation_id, order_date, due_date, priority, status,
           subtotal, total, created_by, updated_by)
         VALUES (?, ?, ?, date('now'), ?, ?, 'confirmed', ?, ?, ?, ?)`,
        [
          oNum,
          q.customer_id,
          q.id,
          payload.due_date || null,
          payload.priority || "normal",
          q.total,
          q.total,
          payload.callerUsername,
          payload.callerUsername,
        ]
      );

      const inserted = dbGet("SELECT * FROM orders WHERE id = last_insert_rowid()");
      if (!inserted) throw new Error("Failed to create order.");

      // Copy items from quotation
      items.forEach((item: any, idx: number) => {
        dbRun(
          `INSERT INTO order_items
            (order_id, product_id, description, specification, quantity, rate, line_total, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [inserted.id, item.product_id, item.description, item.specification, item.quantity, item.rate, item.line_total, idx]
        );
      });

      // Link quotation → order
      dbRun(
        "UPDATE quotations SET linked_order_id = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?",
        [inserted.id, payload.callerUsername, q.id]
      );

      recordAudit("order", inserted.id, "converted_from_quotation", payload.callerUsername, null, { quotation_id: q.id, order_number: oNum });
      recordAudit("quotation", q.id, "converted_to_order", payload.callerUsername, { linked_order_id: null }, { linked_order_id: inserted.id });

      return attachOrderItems(dbGet("SELECT * FROM orders WHERE id = ?", [inserted.id]));
    })
  );

  /** Update order status. Cancellation requires a reason. */
  ipcMain.handle(
    "orders:update-status",
    safe((payload: { id: number; status: string; cancel_reason?: string; callerRole: string; callerUsername: string }) => {
      if (!CAN_MANAGE_ORDERS.includes(payload.callerRole)) {
        throw new Error("Permission denied.");
      }
      const old = dbGet("SELECT * FROM orders WHERE id = ?", [payload.id]);
      if (!old) throw new Error("Order not found.");

      if (payload.status === "cancelled" && !payload.cancel_reason?.trim()) {
        throw new Error("A cancellation reason is required.");
      }

      // Rule 4: An order cannot move to "in_production" unless its latest design is approved!
      if (payload.status === "in_production") {
        const latestDesign = dbGet(
          "SELECT * FROM designs WHERE order_id = ? ORDER BY version_number DESC, id DESC LIMIT 1",
          [payload.id]
        );
        if (!latestDesign) {
          throw new Error("Cannot move order to In Production: No design file has been uploaded for this order.");
        }
        if (latestDesign.approval_status !== "approved") {
          throw new Error(
            `Cannot move order to In Production: Latest design (version ${latestDesign.version_number}) is ${latestDesign.approval_status}. The design must be approved first.`
          );
        }
      }

      dbRun(
        `UPDATE orders SET
          status = ?, cancel_reason = ?,
          updated_by = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          payload.status,
          payload.status === "cancelled" ? (payload.cancel_reason || null) : (old.cancel_reason || null),
          payload.callerUsername,
          payload.id,
        ]
      );

      recordAudit("order", payload.id, `status_change:${payload.status}`, payload.callerUsername, { status: old.status }, { status: payload.status, cancel_reason: payload.cancel_reason });
      return true;
    })
  );

  // ── Designs (Design & Approval Workflow) ──────────────────────────────────

  function getDesignsDir(): string {
    const { getUserDataDir } = require("./database");
    const dir = path.join(getUserDataDir(), "designs");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /** List designs for an order. */
  ipcMain.handle(
    "designs:list",
    safe((payload: { order_id: number }) => {
      const rows = dbAll(
        "SELECT * FROM designs WHERE order_id = ? ORDER BY version_number DESC, id DESC",
        [payload.order_id]
      );
      // For images, provide base64 data preview if file exists
      return rows.map((d: any) => {
        const ext = path.extname(d.file_name).toLowerCase();
        let preview: string | null = null;
        if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) && fs.existsSync(d.file_path)) {
          try {
            const buf = fs.readFileSync(d.file_path);
            const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
            preview = `data:${mime};base64,${buf.toString("base64")}`;
          } catch (e) {
            console.error("[Design Preview Error]", e);
          }
        }
        return { ...d, preview };
      });
    })
  );

  /** Upload a design file. */
  ipcMain.handle(
    "designs:upload",
    safe(async (payload: { order_id: number; file_name: string; file_data: string; callerUsername: string }) => {
      const order = dbGet("SELECT id, order_number FROM orders WHERE id = ?", [payload.order_id]);
      if (!order) throw new Error("Order not found.");

      const maxRow = dbGet("SELECT MAX(version_number) AS max_v FROM designs WHERE order_id = ?", [payload.order_id]);
      const nextVersion = ((maxRow?.max_v as number) ?? 0) + 1;

      const designsDir = getDesignsDir();
      const cleanName = payload.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const savedFileName = `order_${payload.order_id}_v${nextVersion}_${Date.now()}_${cleanName}`;
      const targetPath = path.join(designsDir, savedFileName);

      // file_data is base64
      const base64Data = payload.file_data.replace(/^data:[^;]+;base64,/, "");
      fs.writeFileSync(targetPath, Buffer.from(base64Data, "base64"));

      dbRun(
        `INSERT INTO designs (order_id, version_number, file_path, file_name, uploaded_by, approval_status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [payload.order_id, nextVersion, targetPath, payload.file_name, payload.callerUsername]
      );

      const inserted = dbGet("SELECT * FROM designs WHERE id = last_insert_rowid()");
      recordAudit("design", inserted.id, "upload", payload.callerUsername, null, {
        order_id: payload.order_id,
        version: nextVersion,
        file_name: payload.file_name,
      });

      return inserted;
    })
  );

  /** Update design approval status (approved, rejected, revision_requested). */
  ipcMain.handle(
    "designs:update-approval",
    safe((payload: {
      id: number;
      approval_status: "approved" | "rejected" | "revision_requested";
      approved_by_name?: string;
      approved_on?: string;
      approval_method?: string;
      remarks: string;
      callerRole: string;
      callerUsername: string;
    }) => {
      if (!payload.remarks?.trim()) {
        throw new Error("A remark is required for any approval action.");
      }

      if (payload.approval_status === "approved") {
        if (!payload.approved_by_name?.trim()) {
          throw new Error("Customer / approver name is required for approval.");
        }
        if (!payload.approval_method?.trim()) {
          throw new Error("Approval method (phone, WhatsApp, in person, email) is required.");
        }
        if (!payload.approved_on?.trim()) {
          throw new Error("Approval date is required.");
        }
      }

      const oldDesign = dbGet("SELECT * FROM designs WHERE id = ?", [payload.id]);
      if (!oldDesign) throw new Error("Design not found.");

      dbRun(
        `UPDATE designs SET
          approval_status = ?,
          approved_by_name = ?,
          approved_on = ?,
          approval_method = ?,
          remarks = ?
         WHERE id = ?`,
        [
          payload.approval_status,
          payload.approval_status === "approved" ? payload.approved_by_name?.trim() : null,
          payload.approval_status === "approved" ? (payload.approved_on || new Date().toISOString().split("T")[0]) : null,
          payload.approval_status === "approved" ? payload.approval_method : null,
          payload.remarks.trim(),
          payload.id,
        ]
      );

      const updated = dbGet("SELECT * FROM designs WHERE id = ?", [payload.id]);
      recordAudit("design", payload.id, `approval_${payload.approval_status}`, payload.callerUsername, oldDesign, updated);
      return updated;
    })
  );

  /** Open design file in native OS viewer (PDF or high-res image). */
  ipcMain.handle(
    "designs:open-file",
    safe(async (payload: { id: number }) => {
      const design = dbGet("SELECT file_path FROM designs WHERE id = ?", [payload.id]);
      if (!design || !fs.existsSync(design.file_path)) {
        throw new Error("File not found on disk.");
      }
      await shell.openPath(design.file_path);
      return true;
    })
  );

  // ── Payments ──────────────────────────────────────────────────────────────

  const CAN_MANAGE_PAYMENTS = ["owner", "admin", "sales", "accountant"];

  /** List payments. */
  ipcMain.handle(
    "payments:list",
    safe((payload?: { order_id?: number; customer_id?: number }) => {
      let sql = `
        SELECT p.*, c.name AS customer_name, o.order_number, o.total AS order_total
        FROM payments p
        JOIN customers c ON c.id = p.customer_id
        JOIN orders o ON o.id = p.order_id
      `;
      const params: any[] = [];
      if (payload?.order_id) {
        sql += " WHERE p.order_id = ?";
        params.push(payload.order_id);
      } else if (payload?.customer_id) {
        sql += " WHERE p.customer_id = ?";
        params.push(payload.customer_id);
      }
      sql += " ORDER BY p.id DESC";
      return dbAll(sql, params);
    })
  );

  /** Record a payment. */
  ipcMain.handle(
    "payments:create",
    safe((payload: {
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
    }) => {
      if (!CAN_MANAGE_PAYMENTS.includes(payload.callerRole)) {
        throw new Error("Permission denied: You do not have permission to record payments.");
      }

      if (!payload.amount || payload.amount <= 0) {
        throw new Error("Payment amount must be greater than zero.");
      }

      const order = dbGet("SELECT id, order_number, total, customer_id FROM orders WHERE id = ?", [payload.order_id]);
      if (!order) throw new Error("Order not found.");

      const paidRow = dbGet(
        "SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE order_id = ? AND is_cancelled = 0",
        [payload.order_id]
      );
      const currentPaid = Number(paidRow?.total_paid ?? 0);
      const remainingBalance = Math.max(0, Number(order.total || 0) - currentPaid);

      if (payload.amount > remainingBalance + 0.01) {
        // Overpayment check
        if (payload.callerRole !== "owner") {
          throw new Error(
            `Payment amount (₹${payload.amount}) exceeds remaining balance (₹${remainingBalance.toFixed(2)}). Only the owner can approve an overpayment.`
          );
        }
        if (!payload.overpayment_reason?.trim()) {
          throw new Error("An approval reason is required when a payment exceeds the remaining order balance.");
        }
      }

      dbRun(
        `INSERT INTO payments (
          order_id, customer_id, amount, payment_date, mode, reference_number, notes, received_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.order_id,
          payload.customer_id || order.customer_id,
          payload.amount,
          payload.payment_date || new Date().toISOString().split("T")[0],
          payload.mode || "cash",
          payload.reference_number?.trim() || null,
          payload.notes?.trim() || (payload.overpayment_reason ? `Overpayment approval: ${payload.overpayment_reason.trim()}` : null),
          payload.callerUsername,
        ]
      );

      const inserted = dbGet("SELECT * FROM payments WHERE id = last_insert_rowid()");
      recordAudit("payment", inserted.id, "create", payload.callerUsername, null, {
        order_number: order.order_number,
        amount: payload.amount,
        mode: payload.mode,
      });

      return inserted;
    })
  );

  /** Cancel a payment (wrong entry). */
  ipcMain.handle(
    "payments:cancel",
    safe((payload: { id: number; cancel_reason: string; callerRole: string; callerUsername: string }) => {
      if (!CAN_MANAGE_PAYMENTS.includes(payload.callerRole)) {
        throw new Error("Permission denied: You do not have permission to cancel payments.");
      }

      if (!payload.cancel_reason?.trim()) {
        throw new Error("A cancellation reason is required.");
      }

      const oldPayment = dbGet("SELECT * FROM payments WHERE id = ?", [payload.id]);
      if (!oldPayment) throw new Error("Payment record not found.");
      if (oldPayment.is_cancelled === 1) throw new Error("This payment is already cancelled.");

      dbRun(
        `UPDATE payments SET
          is_cancelled = 1, cancel_reason = ?, cancelled_by = ?, cancelled_at = datetime('now')
         WHERE id = ?`,
        [payload.cancel_reason.trim(), payload.callerUsername, payload.id]
      );

      recordAudit("payment", payload.id, "cancel", payload.callerUsername, oldPayment, {
        is_cancelled: 1,
        cancel_reason: payload.cancel_reason,
      });

      return true;
    })
  );

  // ── Invoices ──────────────────────────────────────────────────────────────

  const CAN_MANAGE_INVOICES = ["owner", "admin", "sales", "accountant"];

  function nextInvoiceNumber(): string {
    const row = dbGet("SELECT COUNT(*) AS cnt FROM invoices");
    const n = ((row?.cnt as number) ?? 0) + 1;
    return `INV-${String(n).padStart(4, "0")}`;
  }

  /** List invoices. */
  ipcMain.handle(
    "invoices:list",
    safe((payload?: { order_id?: number; customer_id?: number }) => {
      let sql = `
        SELECT inv.*, c.name AS customer_name, o.order_number
        FROM invoices inv
        JOIN customers c ON c.id = inv.customer_id
        JOIN orders o ON o.id = inv.order_id
      `;
      const params: any[] = [];
      if (payload?.order_id) {
        sql += " WHERE inv.order_id = ?";
        params.push(payload.order_id);
      } else if (payload?.customer_id) {
        sql += " WHERE inv.customer_id = ?";
        params.push(payload.customer_id);
      }
      sql += " ORDER BY inv.id DESC";
      return dbAll(sql, params);
    })
  );

  /** Get single invoice with items, customer details, and payment summary. */
  ipcMain.handle(
    "invoices:get",
    safe((payload: { id: number }) => {
      const inv = dbGet(
        `SELECT inv.*, c.name AS customer_name, c.billing_address, c.gst_number, c.phone, o.order_number
         FROM invoices inv
         JOIN customers c ON c.id = inv.customer_id
         JOIN orders o ON o.id = inv.order_id
         WHERE inv.id = ?`,
        [payload.id]
      );
      if (!inv) throw new Error("Invoice not found.");

      inv.items = dbAll(
        "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC",
        [inv.id]
      );

      // Attach payments on this order
      const paidRow = dbGet(
        "SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE order_id = ? AND is_cancelled = 0",
        [inv.order_id]
      );
      const paid = Number(paidRow?.total_paid ?? 0);
      inv.amount_paid = paid;
      inv.balance_due = Math.max(0, Number(inv.total || 0) - paid);

      return inv;
    })
  );

  /** Generate an invoice from order. */
  ipcMain.handle(
    "invoices:create",
    safe((payload: {
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
    }) => {
      if (!CAN_MANAGE_INVOICES.includes(payload.callerRole)) {
        throw new Error("Permission denied: You do not have permission to generate invoices.");
      }

      if (!payload.items || payload.items.length === 0) {
        throw new Error("Invoice must contain at least one item.");
      }

      const subtotal = payload.subtotal ?? payload.items.reduce((s, it) => s + it.line_total, 0);
      const discount = payload.discount || 0;
      const discountAmt = (subtotal * discount) / 100;
      const taxPercent = payload.tax_percent || 0;
      const taxAmount = ((subtotal - discountAmt) * taxPercent) / 100;
      const total = subtotal - discountAmt + taxAmount;

      const invNum = nextInvoiceNumber();

      dbRun(
        `INSERT INTO invoices (
          invoice_number, order_id, customer_id, date, subtotal, discount,
          tax_percent, tax_amount, total, type, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?)`,
        [
          invNum,
          payload.order_id,
          payload.customer_id,
          payload.date || new Date().toISOString().split("T")[0],
          subtotal,
          discount,
          taxPercent,
          taxAmount,
          total,
          payload.type || "final",
          payload.notes?.trim() || null,
          payload.callerUsername,
        ]
      );

      const inserted = dbGet("SELECT * FROM invoices WHERE id = last_insert_rowid()");
      if (!inserted) throw new Error("Failed to insert invoice.");

      payload.items.forEach((item, idx) => {
        dbRun(
          `INSERT INTO invoice_items (
            invoice_id, description, specification, quantity, rate, line_total, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            inserted.id,
            item.description,
            item.specification || null,
            item.quantity,
            item.rate,
            item.line_total,
            idx,
          ]
        );
      });

      recordAudit("invoice", inserted.id, "create", payload.callerUsername, null, {
        invoice_number: invNum,
        order_id: payload.order_id,
        total,
      });

      inserted.items = dbAll("SELECT * FROM invoice_items WHERE invoice_id = ?", [inserted.id]);
      return inserted;
    })
  );

  /** Cancel an invoice. Only the owner can cancel invoices. */
  ipcMain.handle(
    "invoices:cancel",
    safe((payload: { id: number; cancel_reason: string; callerRole: string; callerUsername: string }) => {
      if (payload.callerRole !== "owner") {
        throw new Error("Permission denied: Only the owner can cancel an issued invoice.");
      }

      if (!payload.cancel_reason?.trim()) {
        throw new Error("A cancellation reason is required.");
      }

      const oldInv = dbGet("SELECT * FROM invoices WHERE id = ?", [payload.id]);
      if (!oldInv) throw new Error("Invoice not found.");
      if (oldInv.status === "cancelled") throw new Error("This invoice is already cancelled.");

      dbRun(
        `UPDATE invoices SET
          status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = datetime('now')
         WHERE id = ?`,
        [payload.cancel_reason.trim(), payload.callerUsername, payload.id]
      );

      recordAudit("invoice", payload.id, "cancel", payload.callerUsername, oldInv, {
        status: "cancelled",
        cancel_reason: payload.cancel_reason,
      });

      return true;
    })
  );

  // ── Dues & Accounts ───────────────────────────────────────────────────────

  /** Get customers with unpaid balances sorted by oldest unpaid first, with days overdue. */
  ipcMain.handle(
    "accounts:get-dues",
    safe(() => {
      // Find all customers who have orders
      const customers = dbAll("SELECT id, name, company, phone FROM customers WHERE active = 1");
      const duesList: any[] = [];
      let totalOutstandingAll = 0;
      let totalCollectedAll = 0;

      const today = new Date().toISOString().split("T")[0];
      const todayMs = new Date(today).getTime();

      for (const c of customers) {
        // Total orders value
        const orderRow = dbGet(
          "SELECT COALESCE(SUM(total), 0) AS total_orders FROM orders WHERE customer_id = ? AND status != 'cancelled'",
          [c.id]
        );
        const totalOrders = Number(orderRow?.total_orders ?? 0);

        // Total payments
        const payRow = dbGet(
          "SELECT COALESCE(SUM(amount), 0) AS total_payments FROM payments WHERE customer_id = ? AND is_cancelled = 0",
          [c.id]
        );
        const totalPaid = Number(payRow?.total_payments ?? 0);
        totalCollectedAll += totalPaid;

        const balance = Math.max(0, totalOrders - totalPaid);

        if (balance > 0.01) {
          totalOutstandingAll += balance;

          // Find oldest unpaid order date
          const oldestOrder = dbGet(
            `SELECT order_date, due_date FROM orders
             WHERE customer_id = ? AND status != 'cancelled' AND status != 'closed'
             ORDER BY order_date ASC LIMIT 1`,
            [c.id]
          );

          const oldestDate = oldestOrder?.due_date || oldestOrder?.order_date || today;
          const oldestMs = new Date(oldestDate).getTime();
          const daysOverdue = Math.max(0, Math.floor((todayMs - oldestMs) / (1000 * 60 * 60 * 24)));

          duesList.push({
            customer_id: c.id,
            name: c.name,
            company: c.company,
            phone: c.phone,
            total_orders: totalOrders,
            total_paid: totalPaid,
            balance,
            oldest_date: oldestDate,
            days_overdue: daysOverdue,
          });
        }
      }

      // Sort oldest first (highest days_overdue first, or oldest_date ASC)
      duesList.sort((a, b) => b.days_overdue - a.days_overdue);

      const invRow = dbGet("SELECT COUNT(*) AS total_invoices FROM invoices WHERE status != 'cancelled'");

      return {
        dues: duesList,
        summary: {
          total_outstanding: totalOutstandingAll,
          total_collected: totalCollectedAll,
          overdue_customers_count: duesList.length,
          total_invoices: Number(invRow?.total_invoices ?? 0),
        },
      };
    })
  );

  /** Get outstanding balance and ledger for a single customer. */
  ipcMain.handle(
    "customers:get-balance",
    safe((payload: { customer_id: number }) => {
      const orderRow = dbGet(
        "SELECT COALESCE(SUM(total), 0) AS total_orders FROM orders WHERE customer_id = ? AND status != 'cancelled'",
        [payload.customer_id]
      );
      const payRow = dbGet(
        "SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE customer_id = ? AND is_cancelled = 0",
        [payload.customer_id]
      );

      const totalOrders = Number(orderRow?.total_orders ?? 0);
      const totalPaid = Number(payRow?.total_payments ?? 0);
      const balance = Math.max(0, totalOrders - totalPaid);

      return {
        total_orders: totalOrders,
        total_paid: totalPaid,
        balance,
      };
    })
  );

  // ── Backup ────────────────────────────────────────────────────────────────
  ipcMain.handle(
    "backup:now",
    safe(() => {
      // Imported lazily to avoid circular deps
      const { runBackup } = require("./backup");
      return runBackup("manual");
    })
  );

  // ── App info ──────────────────────────────────────────────────────────────
  ipcMain.handle("app:get-version", safe(() => app.getVersion()));
}
