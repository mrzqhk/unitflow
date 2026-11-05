# UnitFlow — Project Context & Architecture

**UnitFlow** is an offline-first Windows desktop manufacturing management application built for single-machine deployment in small-to-medium manufacturing environments (custom apparel, furniture, fabrication).

---

## 🛠 Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| **Platform** | Electron 36 (Windows .exe) | Pure desktop app running offline on one PC |
| **Frontend** | React 19 + TypeScript (Vite) | Fast modern UI, component modularity |
| **Styling** | Tailwind CSS + Lucide Icons | Clean, readable, light-themed desktop design |
| **Database** | SQLite via `sql.js` (WebAssembly) | Standalone local SQLite stored in `%APPDATA%\unitflow\unitflow.db` |
| **Packaging** | `electron-builder` | Generates standalone Windows setup (`.exe` NSIS installer) |
| **Internationalization** | Custom Context (`en` & `ml`) | English & Malayalam support switchable on the fly |

---

## 🔒 Security & Architecture Rules

1. **Context Isolation**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` in Electron BrowserWindow.
2. **Preload Whitelist**: Renderer accesses Node APIs *only* through `window.api.invoke` on strict allowlisted IPC channels (`auth:*`, `users:*`, `customers:*`, `products:*`, `backup:*`, `app:*`).
3. **No Direct DB in Renderer**: All database reads, writes, and bcrypt password hashing occur exclusively in the Electron main process.
4. **Server-Side Role Guarding**:
   - User creation/edit/disable: Only `owner`.
   - Customer creation/edit/disable: Only `owner`, `admin`, and `sales`.
   - Product price & tiered slab editing: Only `owner` (blocked in main process if non-owner attempts to alter prices).
5. **Audit Logging & Provenance**: `audit_log` records every create, edit, and status change across users, customers, and products (`entity_type`, `entity_id`, `action`, `performed_by`, `performed_at`, `old_value`, `new_value`). Every record stores `created_by` and `updated_by`.
6. **Offline & Local**: The app requires zero internet access. No remote assets or third-party web endpoints are queried.
7. **Data Integrity & Backups**: Every write persists immediately to disk. Daily automated backups are saved to `%APPDATA%\unitflow\backups\`, alongside on-demand "Backup Now" triggers.

---

## 👥 Roles & Permissions Matrix

The 8 roles configured in the database:
- `owner`: Full system access, user management, customer management, price controls, backup triggers, all modules
- `sales`: Customer management, Quotations, Orders, view products & pricing
- `designer`: Design uploads, CAD assets, specifications, view products
- `supervisor`: Production queues, approvals, job card allocation, view products
- `worker`: Shop-floor stage completion (touch-friendly simplified view)
- `store`: Inventory, raw material issue, stock tracking, view products
- `delivery`: Packaging verification, dispatch, customer delivery confirmation
- `accountant`: Payments, invoices, accounts ledger, view customers and products

---

## 📋 Progress Checklist

### ✅ Phase 1: Foundation, Auth & User Management (COMPLETED)
- [x] Project scaffolding with Electron, React, TypeScript, Vite & Tailwind CSS
- [x] Setup SQLite database in user data folder (`%APPDATA%\unitflow\unitflow.db`)
- [x] `users` table schema: `full_name`, `username`, `password_hash` (bcrypt), `role`, `active`, timestamps
- [x] `backup_log` table for backup tracking
- [x] First-run flow: "Create Owner Account" screen shown automatically if no owner exists
- [x] Authentication: Login screen with secure bcrypt verification (no public registration)
- [x] Session state management via React Context (`AppContext`)
- [x] Left navigation sidebar with role-filtered menu items
- [x] Empty Dashboard displaying "Welcome, <name>" and role badge
- [x] Owner-only Users screen with table, Add User modal, Edit User modal, and Active/Inactive toggle
- [x] Security bridge: `preload.ts` whitelist and IPC handlers in main process
- [x] Daily automated database backup + on-demand "Backup Now" button
- [x] English and Malayalam language toggle with localized labels in header
- [x] Successful Electron TypeScript compilation, Vite production build, and NSIS installer packaging

---

### ✅ Phase 2: Customers and Products (COMPLETED)
- [x] Database table `customers`: `name`, `company`, `phone`, `alternate_phone`, `email`, `billing_address`, `delivery_address`, `gst_number`, `customer_type`, `credit_limit`, `notes`, `active`, `created_by`, `updated_by`, timestamps
- [x] Database table `products`: `name`, `category`, `unit`, `retail_price`, `wholesale_price`, `active`, `created_by`, `updated_by`, timestamps
- [x] Database table `wholesale_slabs`: `product_id`, `min_quantity`, `price`, `created_at`
- [x] Database table `audit_log`: `entity_type`, `entity_id`, `action`, `performed_by`, `performed_at`, `old_value`, `new_value`
- [x] Audit log writing hooked on all create, edit, and disable/enable operations for customers and products
- [x] Customers Screen: searchable by name/company/phone, filterable by retail/wholesale and active/inactive
- [x] Add/Edit Customer modal: clear labels, name & phone validation, live duplicate phone warning banner, "Same as billing address" shortcut
- [x] Customer Detail View: Profile & Contact card, Addresses card, Notes card, Audit History card, and placeholder tabs for **Quotations**, **Orders**, and **Payments**
- [x] Products Screen: searchable by name/category, displays unit, retail price, wholesale price, and visual wholesale slab badges
- [x] Add/Edit Product modal: tiered quantity slabs editor (add/remove min qty and slab rate)
- [x] Main-process security enforcement: only `owner`, `admin`, and `sales` can add/edit customers; only `owner` can set or edit product prices (locked in UI and rejected in IPC)
- [x] English and Malayalam translations for all new screens, labels, and validation banners

---

### ⏳ Future Phases (Planned per PRD)
- [ ] **Phase 3: Sales, Quotation & Order Management** (Quotations, Orders, Custom Notes, linking to Customer Detail tabs)
- [ ] **Phase 4: Design & Approval Workflow** (Design asset uploads, versions, owner approval)
- [ ] **Phase 5: Production & Job Cards** (Job card auto-generation, 4 stages: Cutting, Stitching/Assembly, QC, Packing)
- [ ] **Phase 6: Worker Touch Screen** (Simplified touch UI with PIN login and barcode action)
- [ ] **Phase 7: Store & Inventory** (Raw materials, stock levels, issue-to-order deduction)
- [ ] **Phase 8: Delivery & Logistics** (Dispatch, delivery challans, customer sign-off)
- [ ] **Phase 9: Accounts & Invoicing** (GST/tax invoicing, customer ledgers, payment tracking)
- [ ] **Phase 10: Reports & Analytics** (Production throughput, revenue, export to PDF/Excel)

---

## 🧪 How to Test Customers and Products

1. **Launch the App**:
   ```bash
   npm run dev
   ```
   Or open **http://localhost:5173** in your web browser.

2. **Test Customers**:
   - In the left sidebar, click **Customers** (`ഉപഭോക്താക്കൾ`).
   - Click **"Add Customer"**:
     - Fill in Name (`Kiran Raj`) and Phone (`9876543210`).
     - Notice that if you enter a phone number that already exists, a warning banner appears informing you who owns that number.
     - Choose **Retail** or **Wholesale**, set a Credit Limit (e.g. `25000`), and check "Same as billing address".
     - Click **Save**.
   - Click on the customer row in the table to open the **Customer Detail View**.
     - Verify the **Profile & Details** tab displays all fields and audit metadata (`Created by`, timestamps).
     - Switch between **Quotations**, **Orders**, and **Payments** tabs to see the clean placeholder modules.
   - Click **Edit Customer** to modify details, or click **Disable/Enable** to toggle status without hard-deleting.

3. **Test Products & Tiered Wholesale Slabs**:
   - In the left sidebar, click **Products** (`ഉൽപ്പന്നങ്ങൾ`).
   - Click **"Add Product"**:
     - As the `owner`, you can enter **Retail Price** (e.g. `1200`) and **Wholesale Price** (e.g. `850`).
     - Click **"Add Quantity Slab"** to define tiered discounts:
       - Min Quantity: `20` → Slab Price: `800`
       - Min Quantity: `50` → Slab Price: `750`
     - Save and verify the table displays the product with its category and slab badges (`≥20: ₹800`, `≥50: ₹750`).
   - Log in as a non-owner user (e.g. `sales` or `designer`):
     - Go to Products and click Edit: notice the price fields and slab inputs are locked with a lock badge. The main Electron process independently rejects any price modifications from non-owners.

4. **Test Language Switch**:
   - Click the language toggle button in the top right header (`EN` / `മല`) to verify all titles, tabs, table headers, and forms seamlessly switch between English and Malayalam.
