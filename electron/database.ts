/**
 * database.ts — Initialise SQLite via sql.js (pure WebAssembly, no native build needed).
 *
 * The database file lives in the OS user-data folder:
 *   Windows: %APPDATA%\unitflow\unitflow.db
 *
 * sql.js works in-memory and we persist by writing the DB buffer to disk
 * after every write operation.
 */

const initSqlJs = require("sql.js");
const { app }   = require("electron");
const path      = require("path");
const fs        = require("fs");

// Paths exported so the backup module can reuse them
let dbPath: string;
let userDataDir: string;

export function getDbPath(): string { return dbPath; }
export function getUserDataDir(): string { return userDataDir; }

// The live sql.js Database instance
let _db: any = null;

export function getDb(): any { return _db; }

/**
 * Persist the in-memory database to disk.
 * Call this after every INSERT / UPDATE / DELETE.
 */
export function saveDb() {
  if (!_db || !dbPath) return;
  const data: Uint8Array = _db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export async function initDb() {
  userDataDir = app.getPath("userData");
  dbPath = path.join(userDataDir, "unitflow.db");

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // sql.js needs the wasm file
  const wasmPath = app.isPackaged
    ? path.join(process.resourcesPath, "sql-wasm.wasm")
    : path.join(__dirname, "../node_modules/sql.js/dist/sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  if (fs.existsSync(dbPath)) {
    // Load existing database from disk
    const fileBuffer = fs.readFileSync(dbPath);
    _db = new SQL.Database(fileBuffer);
  } else {
    // Fresh database
    _db = new SQL.Database();
  }

  // Enable foreign keys
  _db.run("PRAGMA foreign_keys = ON;");

  // Create tables
  createTables();

  // Persist (in case it was a fresh db)
  saveDb();

  console.log(`[DB] Opened: ${dbPath}`);
}

function createTables() {
  // ── Users table ──────────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name     TEXT    NOT NULL,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'worker',
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Backup log table ─────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS backup_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      backed_up_at TEXT    NOT NULL DEFAULT (datetime('now')),
      file_path    TEXT    NOT NULL,
      triggered_by TEXT    NOT NULL DEFAULT 'auto'
    );
  `);

  // ── Audit Log table ───────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type  TEXT    NOT NULL,
      entity_id    INTEGER NOT NULL,
      action       TEXT    NOT NULL,
      performed_by TEXT    NOT NULL,
      performed_at TEXT    NOT NULL DEFAULT (datetime('now')),
      old_value    TEXT,
      new_value    TEXT
    );
  `);

  // ── Customers table ───────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      company          TEXT,
      phone            TEXT    NOT NULL,
      alternate_phone  TEXT,
      email            TEXT,
      billing_address  TEXT,
      delivery_address TEXT,
      gst_number       TEXT,
      customer_type    TEXT    NOT NULL DEFAULT 'retail',
      credit_limit     REAL    DEFAULT 0,
      notes            TEXT,
      active           INTEGER NOT NULL DEFAULT 1,
      created_by       TEXT    NOT NULL DEFAULT 'system',
      updated_by       TEXT    NOT NULL DEFAULT 'system',
      created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Products table ────────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      category        TEXT    NOT NULL DEFAULT 'General',
      unit            TEXT    NOT NULL DEFAULT 'pcs',
      retail_price    REAL    NOT NULL DEFAULT 0,
      wholesale_price REAL    NOT NULL DEFAULT 0,
      active          INTEGER NOT NULL DEFAULT 1,
      created_by      TEXT    NOT NULL DEFAULT 'system',
      updated_by      TEXT    NOT NULL DEFAULT 'system',
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Wholesale Slabs table ─────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS wholesale_slabs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      min_quantity REAL    NOT NULL,
      price        REAL    NOT NULL,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Quotations table ─────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS quotations (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT    NOT NULL UNIQUE,       -- e.g. QT-0001
      customer_id      INTEGER NOT NULL REFERENCES customers(id),
      date             TEXT    NOT NULL DEFAULT (date('now')),
      valid_until      TEXT,
      status           TEXT    NOT NULL DEFAULT 'draft', -- draft | sent | accepted | rejected | expired
      discount         REAL    NOT NULL DEFAULT 0,
      tax_percent      REAL    NOT NULL DEFAULT 0,
      notes            TEXT,
      terms            TEXT,
      subtotal         REAL    NOT NULL DEFAULT 0,
      total            REAL    NOT NULL DEFAULT 0,
      linked_order_id  INTEGER,                       -- filled when converted to order
      created_by       TEXT    NOT NULL DEFAULT 'system',
      updated_by       TEXT    NOT NULL DEFAULT 'system',
      created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Quotation Items table ────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS quotation_items (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id     INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      product_id       INTEGER REFERENCES products(id), -- NULL for free-text items
      description      TEXT    NOT NULL,
      specification    TEXT,                            -- size, colour, notes per item
      quantity         REAL    NOT NULL DEFAULT 1,
      rate             REAL    NOT NULL DEFAULT 0,
      line_total       REAL    NOT NULL DEFAULT 0,
      price_override   INTEGER NOT NULL DEFAULT 0,     -- 1 if rate was manually overridden below standard
      override_reason  TEXT,                           -- required when price_override = 1
      sort_order       INTEGER NOT NULL DEFAULT 0
    );
  `);

  // ── Orders table ──────────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number         TEXT    NOT NULL UNIQUE,       -- e.g. OD-0001
      customer_id          INTEGER NOT NULL REFERENCES customers(id),
      quotation_id         INTEGER REFERENCES quotations(id), -- optional source quotation
      order_date           TEXT    NOT NULL DEFAULT (date('now')),
      due_date             TEXT,
      priority             TEXT    NOT NULL DEFAULT 'normal',  -- normal | urgent
      status               TEXT    NOT NULL DEFAULT 'confirmed', -- confirmed | in_production | ready | delivered | closed | cancelled
      special_instructions TEXT,
      cancel_reason        TEXT,                          -- required when cancelled
      subtotal             REAL    NOT NULL DEFAULT 0,
      total                REAL    NOT NULL DEFAULT 0,
      created_by           TEXT    NOT NULL DEFAULT 'system',
      updated_by           TEXT    NOT NULL DEFAULT 'system',
      created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Order Items table ─────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id   INTEGER REFERENCES products(id),
      description  TEXT    NOT NULL,
      specification TEXT,
      quantity     REAL    NOT NULL DEFAULT 1,
      rate         REAL    NOT NULL DEFAULT 0,
      line_total   REAL    NOT NULL DEFAULT 0,
      sort_order   INTEGER NOT NULL DEFAULT 0
    );
  `);

  console.log("[DB] Tables verified / created.");
}

/** Record an entry in the audit log table. */
export function recordAudit(
  entityType: string,
  entityId: number,
  action: string,
  performedBy: string,
  oldVal: any = null,
  newVal: any = null
) {
  try {
    dbRun(
      "INSERT INTO audit_log (entity_type, entity_id, action, performed_by, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)",
      [
        entityType,
        entityId,
        action,
        performedBy,
        oldVal ? JSON.stringify(oldVal) : null,
        newVal ? JSON.stringify(newVal) : null,
      ]
    );
  } catch (err) {
    console.error("[AuditLog Error]", err);
  }
}

// ── Helper wrappers around sql.js API ────────────────────────────────────────
// sql.js returns results differently from better-sqlite3, so we normalise here.

/** Execute a SELECT and return all rows as plain objects. */
export function dbAll(sql: string, params: any[] = []): Record<string, any>[] {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows: Record<string, any>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/** Execute a SELECT and return the first row or undefined. */
export function dbGet(sql: string, params: any[] = []): Record<string, any> | undefined {
  const rows = dbAll(sql, params);
  return rows[0];
}

/** Execute an INSERT / UPDATE / DELETE statement. Saves DB to disk automatically. */
export function dbRun(sql: string, params: any[] = []): void {
  _db.run(sql, params);
  saveDb();
}
