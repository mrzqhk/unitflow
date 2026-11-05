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
