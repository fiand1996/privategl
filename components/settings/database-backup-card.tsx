"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

interface BackupItem {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

interface DatabaseBackupCardProps {
  isAdmin?: boolean;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function DatabaseBackupCard({ isAdmin = false }: DatabaseBackupCardProps) {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/backup", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load backups");
        const data = (await res.json()) as { backups?: BackupItem[] };
        if (active) setBackups(data.backups || []);
      })
      .catch((err) => {
        console.warn("Failed to load backups:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  async function handleCreateBackup() {
    setCreating(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        backup?: BackupItem;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create database snapshot.");
      }

      setNotice({
        message: `Backup snapshot created successfully: ${data.backup?.filename}`,
        type: "success",
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setNotice({
        message: err instanceof Error ? err.message : "Failed to create backup.",
        type: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleRestoreBackup(filename: string) {
    setRestoring(filename);
    setNotice(null);
    setConfirmRestore(null);

    try {
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", filename }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to restore database.");
      }

      setNotice({
        message: data.message || `Database successfully restored from ${filename}.`,
        type: "success",
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setNotice({
        message: err instanceof Error ? err.message : "Failed to restore database.",
        type: "error",
      });
    } finally {
      setRestoring(null);
    }
  }

  async function handleDeleteBackup(filename: string) {
    setDeleting(filename);
    setNotice(null);
    setConfirmDelete(null);

    try {
      const res = await fetch(
        `/api/settings/backup?filename=${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete backup.");
      }

      setNotice({
        message: `Deleted snapshot "${filename}".`,
        type: "success",
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setNotice({
        message: err instanceof Error ? err.message : "Failed to delete backup.",
        type: "error",
      });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border-subtle bg-bg-card p-6 shadow-sm space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent-muted text-accent">
            <Archive size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">
              Database Backups & Snapshots
            </h2>
            <p className="text-xs text-text-secondary">
              Create consistent WAL-checkpointed SQLite snapshots, download to your PC, or restore.
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            disabled={creating || restoring !== null}
            onClick={handleCreateBackup}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer sm:self-auto"
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin text-accent-foreground" />
            ) : (
              <Plus size={14} />
            )}
            <span>Create Backup Now</span>
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3 text-xs font-medium ${
            notice.type === "success"
              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border border-rose-500/20 bg-rose-500/10 text-rose-400"
          }`}
        >
          {notice.type === "success" && <CheckCircle2 size={14} className="shrink-0" />}
          <span>{notice.message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-accent" />
        </div>
      ) : backups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-xs text-text-muted">
          No database snapshots found in <code className="font-mono text-text-secondary">data/backups/</code>.
          {isAdmin && ' Click "Create Backup Now" to generate your first backup.'}
        </div>
      ) : (
        <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle overflow-hidden">
          {backups.map((b) => {
            const isThisRestoring = restoring === b.filename;
            const isThisDeleting = deleting === b.filename;

            return (
              <div
                key={b.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between bg-bg-card hover:bg-bg-hover/50 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Database size={15} className="text-accent shrink-0" />
                    <span className="font-mono text-xs font-semibold text-text-primary truncate">
                      {b.filename}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
                    <span>{formatDate(b.createdAt)}</span>
                    <span>·</span>
                    <span>{formatBytes(b.sizeBytes)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Direct Download Button */}
                  <a
                    href={`/api/settings/backup?download=${encodeURIComponent(b.filename)}`}
                    download={b.filename}
                    title="Download snapshot to computer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-bg-input px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-border-subtle transition cursor-pointer"
                  >
                    <Download size={13} className="text-accent" />
                    <span>Download</span>
                  </a>

                  {isAdmin && (
                    <>
                      {/* Restore Button */}
                      <button
                        type="button"
                        disabled={restoring !== null || creating}
                        onClick={() => setConfirmRestore(b.filename)}
                        title="Restore database from this snapshot"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition cursor-pointer disabled:opacity-50"
                      >
                        {isThisRestoring ? (
                          <Loader2 size={13} className="animate-spin text-amber-400" />
                        ) : (
                          <RotateCcw size={13} />
                        )}
                        <span>Restore</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        disabled={deleting !== null || creating}
                        onClick={() => setConfirmDelete(b.filename)}
                        title="Delete snapshot from server"
                        className="inline-flex items-center justify-center rounded-xl p-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition cursor-pointer disabled:opacity-50"
                      >
                        {isThisDeleting ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Restore */}
      {confirmRestore && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-500/30 bg-bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Restore Database Snapshot?
                </h3>
                <p className="font-mono text-xs text-text-secondary truncate max-w-[280px]">
                  {confirmRestore}
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Restoring this snapshot will replace your current SQLite database with the selected backup.
              An automatic pre-restore safety copy will be saved in <code className="font-mono text-text-primary">data/backups/</code>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRestore(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-bg-hover hover:text-text-primary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRestoreBackup(confirmRestore)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition shadow-sm cursor-pointer"
              >
                <span>Yes, Restore Database</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-500/30 bg-bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Delete Backup Snapshot?
                </h3>
                <p className="font-mono text-xs text-text-secondary truncate max-w-[280px]">
                  {confirmDelete}
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              This will permanently delete this backup file from your server storage.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-bg-hover hover:text-text-primary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteBackup(confirmDelete)}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-600 transition shadow-sm cursor-pointer"
              >
                <span>Delete File</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
