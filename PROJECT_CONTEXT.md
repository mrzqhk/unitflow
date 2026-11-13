# UnitFlow — Project Context & Architecture

**UnitFlow** is an offline-first Windows desktop manufacturing management application built for single-machine deployment in small-to-medium manufacturing environments (custom apparel, furniture, fabrication).

---

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

---

## 🛠 Tech Stack

| Component | Technology | Rationale |
|---

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

---|---

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

---|---

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

---|
| **Platform** | Electron 36 (Windows .exe) | Pure desktop app running offline on one PC |
| **Frontend** | React 19 + TypeScript (Vite) | Fast modern UI, component modularity |
| **Styling** | Tailwind CSS + Lucide Icons | Clean, readable, light-themed desktop design |
| **Database** | SQLite via `sql.js` (WebAssembly) | Standalone local SQLite stored in `%APPDATA%\unitflow\unitflow.db` |
| **Packaging** | `electron-builder` | Generates standalone Windows setup (`.exe` NSIS installer) |
| **Internationalization** | Custom Context (`en` & `ml`) | English & Malayalam support switchable on the fly |

---

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

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

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

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

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

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

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

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

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

---

### ✅ Phase 3: Quotations and Orders (COMPLETED)
- [x] Database tables `quotations`, `quotation_items`, `orders`, and `order_items` with strict foreign keys
- [x] Auto-generation of numbers: Quotations (`QT-0001`, `QT-0002`...) and Orders (`OD-0001`, `OD-0002`...)
- [x] Quotations Screen: searchable table, filter by status (`draft`, `sent`, `accepted`, `rejected`, `expired`)
- [x] Add/Edit Quotation modal: customer picker, multi-item row editor (product dropdown or free-text item, description, specification, quantity, rate, line total)
- [x] Pricing intelligence: automatically pre-fills retail price for retail clients and wholesale price for wholesale clients, applying wholesale tiered quantity slabs dynamically
- [x] Role-enforced price overrides: rates below standard can only be altered by `owner` and `admin`, and require a mandatory reason; enforced in UI and SQLite IPC handler
- [x] Automatic calculation: subtotal, discount %, tax %, and grand total
- [x] Draft restriction: only draft quotations can be modified
- [x] Printable PDF export: clean print document with company header, client details, items table, tax/discount breakdown, terms and conditions; bundled font stack with full Malayalam support (`Nirmala UI`, `Kartika`, `Noto Sans Malayalam`)
- [x] Quotation status workflow: `draft` → `sent` → `accepted` / `rejected` / `expired`
- [x] One-click conversion: "Convert to Order" on accepted quotations transfers all line items, rates, and customer details, with bidirectional linkage
- [x] Orders Screen: searchable table, filter by status (`confirmed`, `in_production`, `ready`, `delivered`, `closed`, `cancelled`), priority badge (`normal`, `urgent`)
- [x] Overdue order highlighting: automated visual alert when order due date has passed
- [x] Order Detail View: multi-tab interface with **Details**, **Items**, and placeholder tabs for **Design**, **Production**, and **Payments**
- [x] Customer Detail View integration: populated "Quotations" and "Orders" tabs showing records filtered for that specific customer
- [x] Safe cancellation policy: cancelling an order requires a mandatory reason; zero hard-deletion in the database
- [x] Permission & audit enforcement: `owner`, `admin`, and `sales` can create/manage quotations & orders; other roles restricted to view-only; every creation, edit, conversion, and status change is logged to `audit_log` with `created_by` and `updated_by`
- [x] Bilingual support: 100% English & Malayalam localized labels across all new screens and forms

---

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

---

### ✅ Phase 4: Design Approval, Payments & Invoices (COMPLETED)

#### Design & Approval
- [x] Database table `designs`: `order_id`, `version_number`, `file_path`, `file_name`, `thumbnail_data`, `uploaded_by`, `uploaded_at`, `approval_status` (pending/approved/revision_requested/rejected), `approved_by_name`, `approved_on`, `approval_method` (phone/WhatsApp/in person/email), `remarks`
- [x] **Design Tab** on Order Detail: upload image or PDF files (copied to `%APPDATA%\unitflow\designs\`), thumbnail previews, full version history with "Latest" badge
- [x] Approval actions: **Mark Approved** (captures approver name, date, method, remarks), **Request Revision**, **Reject** — each requires a remark
- [x] **RULE 4 enforced in both main process AND UI**: an order cannot advance to `in_production` unless its latest design is `approved`; a red banner explains the block
- [x] Design status badges shown on Order list tab strip for quick visibility

#### Payments
- [x] Database table `payments`: `order_id`, `customer_id`, `amount`, `payment_date`, `mode` (cash/UPI/bank transfer/cheque), `reference_number`, `notes`, `received_by`, `cancelled`, `cancel_reason`, `owner_approval_reason`
- [x] **Payments Tab** on Order Detail: order total, paid amount, balance summary cards with payment status badge (Unpaid / Advance Paid / Partially Paid / Paid)
- [x] Payment status auto-computed from actual payment records — never manually typed
- [x] Payment status badge shown in Orders list table for instant overview
- [x] **Overpayment protection**: only owner can exceed the balance; must provide a reason; non-owners see a clear block message
- [x] **Payment cancellation** with mandatory reason — entry kept struck-through in records, never hard-deleted
- [x] **Customer Detail Page** — Payments tab now shows all payments for that customer with balance summary (Total Billed, Total Paid, Outstanding Due); outstanding balance also shown in hero metric card

#### Invoices
- [x] Database tables `invoices` and `invoice_items`: `invoice_number` (auto `INV-0001`), `order_id`, `customer_id`, `date`, `subtotal`, `discount`, `tax_percent`, `tax_amount`, `total`, `type` (advance/partial/final), `status` (issued/cancelled), `cancel_reason`, `created_by`
- [x] **Generate Invoice** button on Payments tab — copies order items and prices, allows choosing type, discount %, GST tax slab (0/5/12/18/28%)
- [x] **Bilingual PDF Print**: pressing Print opens a formatted print-preview page (English or Malayalam) using bundled font stack (`Noto Sans Malayalam`, `Nirmala UI`, `Kartika`) with company header, customer details, items table, tax breakup, grand total, computer-generated footer
- [x] **Invoice cancellation**: only owner can cancel an issued invoice; must provide reason; shown with cancelled status and reason note; create a new one to correct
- [x] Invoice print buttons (English + `മലയാളം`) visible on each row in the Payments tab and in Accounts screen

#### Accounts / Dues Screen
- [x] New **Accounts** screen accessible via sidebar (owner, accountant, sales)
- [x] **Overview metrics**: Total Outstanding (₹), Total Collected (₹), Total Invoiced (₹), Customers with Dues count
- [x] **Customer Dues table**: customers with unpaid balances, sorted oldest-first, showing orders count, billed, paid, balance, and days overdue badge (red pill)
- [x] **Quick Pay shortcut**: record a payment directly from the Dues table without navigating to the Order
- [x] **Invoices Registry tab**: all invoices searchable by customer/invoice number/order, with English and Malayalam print buttons and owner cancel button

#### Rules & Permissions (Phase 4)
- [x] `sales` role now also has access to `accounts` screen (can record payments)
- [x] All permissions enforced in main process (IPC handlers), not just UI
- [x] Every design upload, approval action, payment, cancellation, and invoice write logged to `audit_log`
- [x] English & Malayalam strings added for all new screens, modals, and badges

---

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

---

### ⏳ Future Phases (Planned per PRD)
- [ ] **Phase 5: Production & Job Cards** (Job card auto-generation, 4 stages: Cutting, Stitching/Assembly, QC, Packing)
- [ ] **Phase 6: Worker Touch Screen** (Simplified touch UI with PIN login and barcode action)
- [ ] **Phase 7: Store & Inventory** (Raw materials, stock levels, issue-to-order deduction)
- [ ] **Phase 8: Delivery & Logistics** (Dispatch, delivery challans, customer sign-off)
- [ ] **Phase 9: Reports & Analytics** (Production throughput, revenue, export to PDF/Excel)

---

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

---

## 🧪 How to Test

### 1. Launch the App
```bash
npm run dev
```
Or view in browser at **http://localhost:5173**.

### 2. Test Quotations
1. In the sidebar, click **Quotations** (`കൊട്ടേഷനുകൾ`).
2. Click **"New Quotation"**:
   - Pick a Customer (e.g. `Apex Apparels Ltd` - wholesale).
   - Select a Product (e.g. `Premium Cotton Shirt`): notice how wholesale pricing (`₹850`) applies automatically.
   - Increase Quantity to `20`: notice how the slab rate (`₹800`) kicks in automatically.
   - Try lowering the rate below standard: notice the amber override warning and reason requirement (permitted only for `owner`/`admin`).
   - Add discount % or tax % to verify live grand total recalculation.
   - Click **Save**.
3. In the Quotations table, click on the newly created quotation to open the **Quotation Detail View**:
   - Click **"Export PDF"** to preview the clean printable invoice layout with Malayalam font support.
   - Click **"Mark as Sent"**, then **"Mark as Accepted"**.
   - Notice the green **"Convert to Order"** button appears.

### 3. Test Converting Quotation to Order & Order Management
1. In the accepted quotation view, click **"Convert to Order"**:
   - Set an optional due date and priority (`Urgent` or `Normal`).
   - Click confirm: an order (e.g. `OD-0001`) is generated instantly with all line items copied and linked.
2. In the sidebar, click **Orders** (`ഓർഡറുകൾ`):
   - Locate the order in the searchable table.
   - Verify overdue highlight if due date is set in the past.
   - Click on the order to open the **Order Detail View**: explore the **Details**, **Items**, **Design**, **Production**, and **Payments** tabs.
   - Test advancing the status (`Update Status → In Production`).
   - Test **"Cancel Order"**: notice the prompt enforces entering a reason.

### 4. Test Customer Detail View Integration
1. In the sidebar, click **Customers** (`ഉപഭോക്താക്കൾ`).
2. Click on the customer for whom quotations/orders were created.
3. Switch to the **Quotations** and **Orders** tabs: notice the real-time list of quotations and orders for that customer.

### 5. Test Language Switch
- Toggle between **EN** and **മല** in the top navigation bar to test Malayalam and English localization across all quotation and order screens.

---

## 🧪 How to Test Phase 4: Design, Payments & Invoices

### 1. Test Design Upload & Approval

1. Launch the app: `npm run dev`
2. Log in as **owner**.
3. Go to **Orders** → open any order (e.g. `OD-0001`).
4. Click the **Design** tab.
5. Click **Upload Design** → pick any image (JPG/PNG) or PDF file from your computer.
6. After upload, you'll see it listed as **v1** with "Latest" badge and status "Pending".
7. Try clicking **Update Status → In Production**: a red banner appears blocking it — **Rule 4 in action**.
8. Now click **Mark Approved** on the design → enter:
   - Approved By Name: `Rajan K`
   - Method: `WhatsApp`
   - Remarks: `Customer confirmed via WhatsApp`
9. Try advancing to In Production again — it should succeed now.
10. Upload another file → it becomes **v2** (Latest), and the old approval still shows in history.

### 2. Test Payments

1. Open an order that is in `confirmed` status.
2. Click the **Payments** tab.
3. Notice the summary cards: Total, Paid (₹0.00), Balance (full amount).
4. Click **Record Payment**:
   - Enter an amount *less than* the balance (e.g. ₹500 for a ₹2000 order).
   - Mode: UPI, Reference: `TXN123`.
   - Save — payment status badge changes to **Advance Paid**.
5. Record another payment for the remaining balance → status becomes **Paid**.
6. Test overpayment: enter an amount *greater* than balance.
   - As a non-owner: you'll see a block message.
   - As owner: you'll see a reason field — enter a reason and save.
7. Cancel a payment: click the ⊗ icon next to a payment row → provide reason. It appears struck-through.

### 3. Test Invoice Generation & PDF Print

1. On the same order, Payments tab → click **Generate Invoice**.
2. Select Type: `Final`, Tax: `18%` (GST), adjust discount if needed → preview the calculated totals.
3. Click Generate → the invoice (`INV-0001`) appears in the Invoices list.
4. Click the 🖨 button → opens a formatted print-preview window in English. Click Print.
5. Click **`മലയാളം`** button → opens the same invoice in Malayalam with the bundled Malayalam font. Click Print.
6. Test Cancel Invoice (owner only): click ⊗ on the invoice → enter reason → it shows as Cancelled.

### 4. Test Accounts / Dues Screen

1. In the sidebar, click **Accounts** (`അക്കൗണ്ടുകൾ`).
2. The overview cards show Total Outstanding, Total Collected, Total Invoiced, and Overdue customer count.
3. The **Customer Dues** tab lists every customer with pending balances, oldest-first.
4. Click **Record Payment** next to a customer → a Quick Pay modal opens to pick the specific order and record payment.
5. Switch to the **Invoices** tab → see all invoices searchable by customer or invoice number.
6. Use the print buttons to test English and Malayalam invoice printing.

### 5. Test Customer Payments Tab

1. Go to **Customers** → click on a customer who has orders with payments.
2. Click the **Payments** tab.
3. You'll see the balance summary (Total Billed, Total Paid, Outstanding Due) and a table of all payments for that customer across all orders.
4. The Outstanding Due also shows in the hero metric card at the top of the customer profile.

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
