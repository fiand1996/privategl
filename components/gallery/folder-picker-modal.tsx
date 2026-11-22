"use client";

import { useEffect, useState } from "react";
import { Folder, FolderTree, Loader2, X } from "lucide-react";

interface FolderItem {
  path: string;
  name: string;
}

interface FolderPickerModalProps {
  open: boolean;
  libraryId: number;
  action: "move" | "copy";
  selectedCount: number;
  currentFolder: string;
  loading?: boolean;
  onConfirm: (destinationFolder: string) => void;
  onCancel: () => void;
}

export function FolderPickerModal({
  open,
  libraryId,
  action,
  selectedCount,
  currentFolder,
  loading = false,
  onConfirm,
  onCancel,
}: FolderPickerModalProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;

    fetch(`/api/gallery/folders?libraryId=${libraryId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        const data = (await res.json()) as {
          folders?: FolderItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Failed to load folders.");
        setFolders(data.folders ?? []);
        setTargetFolder("");
        setError("");
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load folders.");
        }
      })
      .finally(() => {
        if (active) {
          setFetching(false);
        }
      });

    return () => {
      active = false;
    };
  }, [libraryId, open]);

  if (!open) return null;

  const actionName = action === "move" ? "Move" : "Copy";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-card shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <FolderTree size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                {actionName} {selectedCount} Item(s)
              </h3>
              <p className="text-[11px] text-text-secondary">
                Select a destination folder in this library
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-text-secondary hover:bg-bg-hover hover:text-foreground cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Folder List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {error && (
            <p className="p-3 text-xs text-rose-500">{error}</p>
          )}

          {fetching ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-accent" />
            </div>
          ) : (
            folders.map((folder) => {
              const isSelected = targetFolder === folder.path;
              const isCurrent = currentFolder === folder.path;

              return (
                <button
                  key={folder.path}
                  type="button"
                  onClick={() => setTargetFolder(folder.path)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs transition cursor-pointer ${
                    isSelected
                      ? "bg-accent font-semibold text-accent-foreground shadow-sm"
                      : "text-text-primary hover:bg-bg-hover"
                  }`}
                >
                  <Folder
                    size={16}
                    className={isSelected ? "text-accent-foreground" : "text-accent"}
                  />
                  <div className="min-w-0 flex-1 truncate">
                    <span className="truncate">{folder.name}</span>
                    {folder.path && (
                      <span
                        className={`ml-1.5 text-[10px] ${
                          isSelected ? "text-accent-foreground/80" : "text-text-secondary"
                        }`}
                      >
                        ({folder.path})
                      </span>
                    )}
                  </div>
                  {isCurrent && (
                    <span
                      className={`text-[10px] rounded px-1.5 py-0.5 ${
                        isSelected
                          ? "bg-accent-hover text-accent-foreground font-semibold"
                          : "bg-bg-input text-text-secondary"
                      }`}
                    >
                      Current folder
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border-subtle bg-bg-app px-5 py-3">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || fetching}
            onClick={() => onConfirm(targetFolder)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            {actionName} Here
          </button>
        </div>
      </div>
    </div>
  );
}
