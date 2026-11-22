"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

interface CreateFolderModalProps {
  open: boolean;
  libraryId: number;
  parentFolder: string;
  onClose: () => void;
  onSuccess: (folderName: string) => void;
  onError: (error: string) => void;
}

export function CreateFolderModal({
  open,
  libraryId,
  parentFolder,
  onClose,
  onSuccess,
  onError,
}: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = folderName.trim();
    if (!cleanName) return;

    setLoading(true);
    try {
      const res = await fetch("/api/gallery/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          parentFolder,
          folderName: cleanName,
        }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create folder.");
      }

      setFolderName("");
      onSuccess(cleanName);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create folder.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border-strong bg-bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <h3 className="text-base font-bold text-text-primary">Create New Folder</h3>
        <p className="mt-1.5 text-xs text-text-secondary">
          Enter a name for the new folder in{" "}
          <span className="font-semibold text-foreground">
            {parentFolder || "Root"}
          </span>
          .
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Folder name"
            autoFocus
            className="w-full rounded-xl border border-border-strong bg-bg-input px-3.5 py-2.5 text-xs font-medium text-text-primary placeholder:text-text-muted outline-none transition focus:border-accent focus:bg-bg-hover focus:ring-4 focus:ring-accent/15"
          />

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !folderName.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-md shadow-accent/20 transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 size={13} className="animate-spin text-accent-foreground" />}
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
