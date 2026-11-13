/**
 * Electron Preload Script — the ONLY bridge between renderer and main process.
 *
 * Rules:
 *  - contextBridge.exposeInMainWorld exposes a safe, named API.
 *  - Only specific named channels are allowed — no wildcard IPC.
 *  - The renderer CANNOT require() Node modules or call ipcRenderer directly.
 */

const { contextBridge, ipcRenderer } = require("electron");

// The channels the renderer is allowed to call (invoke = request/response)
const ALLOWED_INVOKE_CHANNELS = [
  // Auth
  "auth:check-owner-exists",
  "auth:create-owner",
  "auth:login",
  // Users
  "users:list",
  "users:create",
  "users:update",
  "users:toggle-active",
  // Customers
  "customers:list",
  "customers:get",
  "customers:check-phone",
  "customers:create",
  "customers:update",
  "customers:toggle-active",
  // Products
  "products:list",
  "products:get",
  "products:create",
  "products:update",
  "products:toggle-active",
  // Quotations
  "quotations:list",
  "quotations:get",
  "quotations:create",
  "quotations:update",
  "quotations:update-status",
  // Orders
  "orders:list",
  "orders:get",
  "orders:create",
  "orders:convert-from-quotation",
  "orders:update-status",
  // Designs
  "designs:list",
  "designs:upload",
  "designs:update-approval",
  "designs:open-file",
  // Payments
  "payments:list",
  "payments:create",
  "payments:cancel",
  // Invoices
  "invoices:list",
  "invoices:get",
  "invoices:create",
  "invoices:cancel",
  // Accounts & Dues
  "accounts:get-dues",
  "customers:get-balance",
  // Backup
  "backup:now",
  // App info
  "app:get-version",
];

// Channels the renderer is allowed to listen on (events pushed from main)
const ALLOWED_ON_CHANNELS = [
  "backup:status",
];

contextBridge.exposeInMainWorld("api", {
  /**
   * Send a message to the main process and wait for a response.
   * Only channels in the allowlist above are permitted.
   */
  invoke: (channel: string, ...args: unknown[]) => {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      throw new Error(`IPC channel not allowed: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Listen for events pushed from the main process.
   * Only channels in the allowlist above are permitted.
   * Returns an unsubscribe function.
   */
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!ALLOWED_ON_CHANNELS.includes(channel)) {
      throw new Error(`IPC listen channel not allowed: ${channel}`);
    }
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      listener(...args);
    ipcRenderer.on(channel, handler);
    // Return a cleanup function so React can unsubscribe in useEffect
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
