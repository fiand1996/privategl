"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useLibrary } from "@/components/layout/library-context";

interface ScanTask {
  id: string;
  libraryId: number;
  libraryName?: string;
  status: "queued" | "running" | "completed" | "failed";
  scannedEntries: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

interface LibrarySetting {
  id: number;
  name: string;
  rootPath: string;
  createdAt: string;
  lastScanAt: string | null;
  imageCount: number;
  folderCount: number;
  totalSizeBytes: number;
  activeTask: ScanTask | null;
  isDefault?: boolean;
}

function formatDate(value: string | null) {
  if (!value) return "Never scanned";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value)} ${units[unitIndex]}`;
}

export function LibrariesView() {
  const { refreshLibraries: refreshGlobalLibraries } = useLibrary();

  const [libraries, setLibraries] = useState<LibrarySetting[]>([]);
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Edit Library state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<LibrarySetting | null>(null);
  const [editName, setEditName] = useState("");
  const [editRootPath, setEditRootPath] = useState("");

  // Delete Library state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingLibrary, setDeletingLibrary] = useState<LibrarySetting | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/libraries", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as { libraries?: LibrarySetting[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load libraries.");
        setLibraries(data.libraries ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load libraries.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  const hasActiveTasks = libraries.some(
    (lib) =>
      lib.activeTask?.status === "queued" || lib.activeTask?.status === "running",
  );

  useEffect(() => {
    if (!hasActiveTasks) return;
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
      void refreshGlobalLibraries();
    }, 1500);
    return () => clearInterval(interval);
  }, [hasActiveTasks, refreshGlobalLibraries]);

  const totalStats = libraries.reduce(
    (acc, lib) => ({
      images: acc.images + lib.imageCount,
      folders: acc.folders + lib.folderCount,
      bytes: acc.bytes + lib.totalSizeBytes,
    }),
    { images: 0, folders: 0, bytes: 0 },
  );

  async function addLibrary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rootPath }),
      });
      const data = (await response.json()) as { id?: number; error?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.error || "Failed to add library.");
      }

      setName("");
      setRootPath("");
      setAddModalOpen(false);
      setNotice("Library added successfully! Click 'Scan Now' to index its contents.");
      setRefreshKey((k) => k + 1);
      void refreshGlobalLibraries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add library.");
    } finally {
      setSubmitting(false);
    }
  }

  async function scanLibrary(library: LibrarySetting) {
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryId: library.id }),
      });
      const data = (await response.json()) as { task?: ScanTask; error?: string };
      if (!response.ok || !data.task) {
        throw new Error(data.error || "Failed to start scan.");
      }

      setNotice(`Scan for “${library.name}” has been scheduled.`);
      setRefreshKey((k) => k + 1);
      void refreshGlobalLibraries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scan.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(lib: LibrarySetting) {
    setEditingLibrary(lib);
    setEditName(lib.name);
    setEditRootPath(lib.rootPath);
    setEditModalOpen(true);
  }

  async function handleUpdateLibrary(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingLibrary) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/libraries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingLibrary.id,
          name: editName,
          rootPath: editRootPath,
        }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        pathChanged?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update library.");
      }

      setEditModalOpen(false);
      setEditingLibrary(null);
      setNotice(
        data.pathChanged
          ? `Library updated! Folder path changed, new scan scheduled.`
          : `Library “${editName}” updated successfully.`,
      );
      setRefreshKey((k) => k + 1);
      void refreshGlobalLibraries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update library.");
    } finally {
      setSubmitting(false);
    }
  }

  function openDeleteModal(lib: LibrarySetting) {
    setDeletingLibrary(lib);
    setDeleteModalOpen(true);
  }

  async function handleDeleteLibrary() {
    if (!deletingLibrary) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/libraries?id=${deletingLibrary.id}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete library.");
      }

      setDeleteModalOpen(false);
      const deletedName = deletingLibrary.name;
      setDeletingLibrary(null);
      setNotice(`Library “${deletedName}” removed from Private Gallery.`);
      setRefreshKey((k) => k + 1);
      void refreshGlobalLibraries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete library.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Global Alerts */}
      {notice && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-400">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-emerald-400/80 hover:text-emerald-300 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-medium text-rose-400">
          <div className="flex items-center gap-2.5">
            <XCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-rose-400/80 hover:text-rose-300 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <ImageIcon size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Total Photos
              </p>
              <p className="text-xl font-bold text-text-primary">
                {totalStats.images.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <FolderOpen size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Total Folders
              </p>
              <p className="text-xl font-bold text-text-primary">
                {totalStats.folders.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <HardDrive size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Total Size
              </p>
              <p className="text-xl font-bold text-text-primary">
                {formatBytes(totalStats.bytes)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Configured Libraries List */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">
              Configured Media Directories
            </h2>
            <p className="text-xs text-text-secondary">
              Root folders indexed by Private Gallery.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-bg-input px-3 py-2 text-xs font-medium text-foreground hover:bg-border-subtle transition cursor-pointer"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover transition cursor-pointer shadow-sm"
            >
              <FolderPlus size={14} />
              Add Library
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-border-subtle bg-bg-card">
            <Loader2 className="size-6 animate-spin text-accent" />
          </div>
        ) : libraries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-subtle p-8 text-center text-sm text-text-secondary">
            <p>No libraries registered yet.</p>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover transition cursor-pointer shadow-sm"
            >
              <FolderPlus size={14} />
              Add Your First Library
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {libraries.map((lib) => {
              const isScanning =
                lib.activeTask?.status === "queued" ||
                lib.activeTask?.status === "running";
              const isFailed = lib.activeTask?.status === "failed";

              return (
                <div
                  key={lib.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-border-subtle bg-bg-card p-5 transition sm:flex-row sm:items-center shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="truncate text-base font-bold text-text-primary">
                        {lib.name}
                      </h3>
                      {lib.isDefault && (
                        <span className="rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-semibold text-accent">
                          Default
                        </span>
                      )}
                      {isScanning ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                          <Loader2 size={12} className="animate-spin" />
                          Scanning ({lib.activeTask?.scannedEntries} items)...
                        </span>
                      ) : isFailed ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-400">
                          <XCircle size={12} />
                          Scan Failed
                        </span>
                      ) : (
                        <span className="rounded-full bg-bg-input px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                          Ready
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-text-secondary truncate">
                      {lib.rootPath}
                    </p>
                    {isFailed && lib.activeTask?.error && (
                      <p className="mt-1 text-xs text-rose-400">
                        {lib.activeTask.error}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-4 text-xs text-text-secondary">
                      <span>{lib.imageCount.toLocaleString()} photos</span>
                      <span>·</span>
                      <span>{lib.folderCount.toLocaleString()} folders</span>
                      <span>·</span>
                      <span>{formatBytes(lib.totalSizeBytes)}</span>
                      <span>·</span>
                      <span>Last scan: {formatDate(lib.lastScanAt)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => openEditModal(lib)}
                      title="Edit library name and path"
                      className="inline-flex size-9 items-center justify-center rounded-xl border border-border-strong bg-bg-input text-text-secondary hover:bg-border-subtle hover:text-text-primary transition cursor-pointer disabled:opacity-50"
                    >
                      <Pencil size={14} />
                    </button>
                    {!lib.isDefault && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => openDeleteModal(lib)}
                        title="Delete library"
                        className="inline-flex size-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={submitting || isScanning}
                      onClick={() => scanLibrary(lib)}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Scanning...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} />
                          <span>Scan Now</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add New Library Modal */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setAddModalOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-library-title"
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <FolderPlus size={18} />
                </div>
                <div>
                  <h2
                    id="add-library-title"
                    className="text-base font-bold text-text-primary"
                  >
                    Add New Media Library
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Point to a local folder on your computer.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg p-1 text-text-secondary hover:bg-border-subtle hover:text-foreground transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={addLibrary} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Library Display Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vacation Photos, Main Camera, etc."
                  className="h-10 w-full rounded-xl border border-border-strong bg-bg-input px-3.5 text-xs text-text-primary placeholder:text-text-muted outline-none transition focus:border-accent focus:bg-bg-input focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Absolute Root Directory Path
                </label>
                <input
                  type="text"
                  required
                  value={rootPath}
                  onChange={(e) => setRootPath(e.target.value)}
                  placeholder="e.g. /Users/vian/Pictures/Gallery or /Volumes/Storage/Photos"
                  className="h-10 w-full rounded-xl border border-border-strong bg-bg-input px-3.5 font-mono text-xs text-text-primary placeholder:text-text-muted outline-none transition focus:border-accent focus:bg-bg-input focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-xl border border-border-strong bg-bg-input px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-border-subtle hover:text-text-primary transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FolderPlus size={14} />
                  )}
                  Save Library
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Library Modal */}
      {editModalOpen && editingLibrary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setEditModalOpen(false);
              setEditingLibrary(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-library-title"
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Pencil size={18} />
                </div>
                <div>
                  <h2
                    id="edit-library-title"
                    className="text-base font-bold text-text-primary"
                  >
                    Edit Library
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Update the display name or underlying directory.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingLibrary(null);
                }}
                className="rounded-lg p-1 text-text-secondary hover:bg-border-subtle hover:text-foreground transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateLibrary} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Library Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Vacation Photos"
                  className="h-10 w-full rounded-xl border border-border-strong bg-bg-input px-3.5 text-xs text-text-primary placeholder:text-text-muted outline-none transition focus:border-accent focus:bg-bg-input focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Absolute Root Directory Path
                </label>
                <input
                  type="text"
                  required
                  value={editRootPath}
                  onChange={(e) => setEditRootPath(e.target.value)}
                  placeholder="/Volumes/Storage/Photos"
                  className="h-10 w-full rounded-xl border border-border-strong bg-bg-input px-3.5 font-mono text-xs text-text-primary placeholder:text-text-muted outline-none transition focus:border-accent focus:bg-bg-input focus:ring-2 focus:ring-accent/20"
                />
              </div>

              {/* Warning if path is being changed */}
              {editRootPath.trim() !== editingLibrary.rootPath && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Changing the root path will clear existing indexed photos for this library and trigger a new scan on the new folder.
                  </span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditingLibrary(null);
                  }}
                  className="rounded-xl border border-border-strong bg-bg-input px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-border-subtle hover:text-text-primary transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Pencil size={14} />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Library Confirmation Modal */}
      {deleteModalOpen && deletingLibrary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setDeleteModalOpen(false);
              setDeletingLibrary(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-library-title"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                <Trash2 size={20} />
              </div>
              <div>
                <h2
                  id="delete-library-title"
                  className="text-base font-bold text-text-primary"
                >
                  Delete Library?
                </h2>
                <p className="text-xs text-text-secondary">
                  {deletingLibrary.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to remove <strong className="text-text-primary">“{deletingLibrary.name}”</strong> from Private Gallery?
            </p>
            <div className="mt-3 rounded-xl border border-border-strong bg-bg-hover p-3 text-xs text-text-secondary">
              <span className="font-semibold text-emerald-400">Note: </span>
              Your physical photo files on disk will <strong className="text-text-primary">NOT</strong> be deleted. Only the gallery index entries, albums, and tags within this library will be cleared.
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeletingLibrary(null);
                }}
                className="rounded-xl border border-border-strong bg-bg-input px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-border-subtle hover:text-text-primary transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteLibrary}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Delete Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
