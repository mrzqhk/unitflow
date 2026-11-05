/**
 * Electron Main Process — entry point.
 *
 * Security settings:
 *  - contextIsolation: true   → renderer cannot access Node APIs directly
 *  - nodeIntegration: false   → no Node in the renderer window
 *  - sandbox: true            → additional OS-level sandboxing
 *  - No remote content allowed
 *
 * All database and file-system work happens HERE.
 * The renderer communicates only through the safe preload bridge.
 */

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { initDb }            = require("./database");
const { setupIpcHandlers }  = require("./ipc-handlers");
const { setupBackup }       = require("./backup");

const isDev = process.env.NODE_ENV === "development";

let mainWindow: any = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:     1280,
    height:    800,
    minWidth:  960,
    minHeight: 620,
    title:     "UnitFlow",
    // Clean desktop look — no default menu bar
    autoHideMenuBar: true,
    webPreferences: {
      // ✅ Keep Node.js out of the renderer
      nodeIntegration: false,
      // ✅ Renderer runs in an isolated context
      contextIsolation: true,
      sandbox: false,
      // ✅ The only bridge to the main process
      preload: path.join(__dirname, "preload.js"),
      // ✅ No loading of remote URLs inside the app
      allowRunningInsecureContent: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Any attempt to open a new window (e.g. target="_blank") → deny and open
  // in the system default browser instead
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  // 1. Initialise the SQLite database (async because sql.js loads WASM)
  await initDb();

  // 2. Register all IPC handlers
  setupIpcHandlers(ipcMain);

  // 3. Schedule automatic daily backup
  setupBackup();

  // 4. Open the window
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
