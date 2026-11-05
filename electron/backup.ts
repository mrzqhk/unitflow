/**
 * backup.ts — Automatic daily backup + on-demand backup.
 *
 * Copies the current database file to:
 *   <userDataDir>/backups/unitflow-YYYY-MM-DD_HH-MM-SS.db
 *
 * - `setupBackup()` is called once on app start; it schedules a timer
 *   that fires every 24 hours.
 * - `runBackup(triggeredBy)` does the actual file copy and logs it.
 */

const path = require("path");
const fs   = require("fs");
const { getDbPath, getUserDataDir, saveDb, dbRun } = require("./database");

/** Perform one backup. Returns the path of the created backup file. */
export function runBackup(triggeredBy: "auto" | "manual" = "auto"): string {
  const dbPath      = getDbPath();
  const userDataDir = getUserDataDir();

  // Make sure the backups folder exists
  const backupsDir = path.join(userDataDir, "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Timestamp-stamped filename, safe for Windows (no colons)
  const now       = new Date();
  const stamp     = now
    .toISOString()
    .replace(/:/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const destPath  = path.join(backupsDir, `unitflow-${stamp}.db`);

  // Flush in-memory DB to disk first, then copy
  saveDb();
  fs.copyFileSync(dbPath, destPath);

  // Log to backup_log table
  try {
    dbRun(
      "INSERT INTO backup_log (file_path, triggered_by) VALUES (?, ?)",
      [destPath, triggeredBy]
    );
  } catch (e) {
    // Non-fatal — backup was still created
    console.warn("[Backup] Could not write to backup_log:", e);
  }

  console.log(`[Backup] ${triggeredBy} backup created: ${destPath}`);

  // Keep only the last 30 backups to avoid filling the disk
  pruneOldBackups(backupsDir, 30);

  return destPath;
}

/**
 * Schedule an automatic backup every 24 hours after the app starts.
 * Uses setInterval — simple and reliable for a single-machine app.
 */
export function setupBackup() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  setInterval(() => {
    try {
      runBackup("auto");
    } catch (err) {
      console.error("[Backup] Auto-backup failed:", err);
    }
  }, TWENTY_FOUR_HOURS);

  console.log("[Backup] Daily auto-backup scheduled.");
}

/** Delete oldest backups, keeping only `keepCount` most recent files. */
function pruneOldBackups(backupsDir: string, keepCount: number) {
  try {
    const files = fs
      .readdirSync(backupsDir)
      .filter((f: string) => f.endsWith(".db"))
      .map((f: string) => ({
        name: f,
        time: fs.statSync(path.join(backupsDir, f)).mtimeMs,
      }))
      .sort((a: any, b: any) => b.time - a.time); // newest first

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      toDelete.forEach(({ name }: { name: string }) => {
        fs.unlinkSync(path.join(backupsDir, name));
        console.log(`[Backup] Pruned old backup: ${name}`);
      });
    }
  } catch (e) {
    console.warn("[Backup] Prune failed:", e);
  }
}
