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
const { getDb, dbAll, dbGet, dbRun, recordAudit } = require("./database");
const { app } = require("electron");

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

  /** Attach items array to an order row. */
  function attachOrderItems(o: any) {
    o.items = dbAll(
      "SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order ASC",
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
      return dbAll(sql, params);
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
