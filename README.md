# UnitFlow — Manufacturing Management System

UnitFlow is an offline-first Windows desktop application for small-to-medium manufacturing businesses.

## 🚀 How to Run in Development

To start the Vite dev server with Hot Module Replacement and launch the Electron application:

```bash
npm run dev
```

This concurrently starts:
1. Vite dev server on `http://localhost:5173`
2. Electron TypeScript compiler in watch mode (`electron/` -> `dist-electron/`)
3. Electron desktop window connecting to the local server with DevTools enabled

---

## 📦 How to Build the Windows Installer (.exe)

To compile all code and package the full Windows standalone installer:

```bash
npm run build
```

This will:
1. Compile Electron main and preload scripts via TypeScript (`dist-electron/`)
2. Build the optimized React frontend bundle via Vite (`dist/`)
3. Package the Windows installer using `electron-builder`

The generated files will be located in the `release/` directory:
- `release/UnitFlow Setup 1.0.0.exe` (NSIS interactive installer)
- `release/win-unpacked/UnitFlow.exe` (portable unpacked directory)

---

## 💾 Database & Backups Location

UnitFlow stores its SQLite database completely offline on the local machine:
- **Database file**: `%APPDATA%\unitflow\unitflow.db`
- **Daily & manual backups**: `%APPDATA%\unitflow\backups\unitflow-YYYY-MM-DD_HH-MM-SS.db`

The last 30 backups are automatically retained to conserve disk space.
