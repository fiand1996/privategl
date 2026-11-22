import fs from "node:fs";
import path from "node:path";
import { closeDatabase, DATABASE_PATH, getDatabase, getRawDatabase } from "./client";

const BACKUP_DIR = path.join(process.cwd(), "data", "backups");

export interface BackupInfo {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function sanitizeBackupFilename(filename: string): string {
  const base = path.basename(filename);
  if (!base || !base.endsWith(".sqlite") || base.includes("..")) {
    throw new Error("Invalid backup filename.");
  }
  return base;
}

export function getBackupPath(filename: string): string {
  const safeName = sanitizeBackupFilename(filename);
  const fullPath = path.join(BACKUP_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Backup file "${safeName}" not found.`);
  }
  return fullPath;
}

export async function listBackups(): Promise<BackupInfo[]> {
  ensureBackupDir();
  const entries = await fs.promises.readdir(BACKUP_DIR);
  const backups: BackupInfo[] = [];

  for (const file of entries) {
    if (!file.endsWith(".sqlite")) continue;
    try {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = await fs.promises.stat(filePath);
      if (stat.isFile()) {
        backups.push({
          id: file,
          filename: file,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        });
      }
    } catch {
      // Ignore unreadable or transient files
    }
  }

  // Sort descending by creation date (newest first)
  backups.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return backups;
}

export async function createBackup(): Promise<BackupInfo> {
  ensureBackupDir();

  // Format: gallery-backup-YYYY-MM-DD_HH-mm-ss.sqlite
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const filename = `gallery-backup-${dateStr}.sqlite`;
  const destinationPath = path.join(BACKUP_DIR, filename);

  const rawDb = getRawDatabase();

  // Safely trigger SQLite online backup
  await rawDb.backup(destinationPath);

  const stat = await fs.promises.stat(destinationPath);

  return {
    id: filename,
    filename,
    sizeBytes: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
}

export async function deleteBackup(filename: string): Promise<boolean> {
  const fullPath = getBackupPath(filename);
  await fs.promises.unlink(fullPath);
  return true;
}

export async function restoreBackup(filename: string): Promise<void> {
  const sourceBackupPath = getBackupPath(filename);

  // Take an automatic safety snapshot of current database state before restoring
  try {
    ensureBackupDir();
    const safetyName = `pre-restore-safety-${Date.now()}.sqlite`;
    const safetyPath = path.join(BACKUP_DIR, safetyName);
    const rawDb = getRawDatabase();
    await rawDb.backup(safetyPath);
  } catch (err) {
    console.warn("[Restore] Could not create pre-restore safety snapshot:", err);
  }

  // Close active connection
  closeDatabase();

  // Remove WAL and SHM files if they exist
  try {
    if (fs.existsSync(DATABASE_PATH + "-wal")) {
      fs.unlinkSync(DATABASE_PATH + "-wal");
    }
    if (fs.existsSync(DATABASE_PATH + "-shm")) {
      fs.unlinkSync(DATABASE_PATH + "-shm");
    }
  } catch (err) {
    console.warn("[Restore] Error cleaning wal/shm files:", err);
  }

  // Copy backup to database path
  fs.copyFileSync(sourceBackupPath, DATABASE_PATH);

  // Reconnect database and run pragmas / migrations
  getDatabase();
}
