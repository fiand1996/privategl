"use client";

import { Folder, ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

interface RenameModalProps {
  open: boolean;
  libraryId: number;
  item: {
    path: string;
    name: string;
    isDirectory: boolean;
  } | null;
  onClose: () => void;
  onSuccess: (oldPath: string, newPath: string, newName: string) => void;
  onError: (error: string) => void;
}

export function RenameModal({
  open,
  libraryId,
  item,
  onClose,
  onSuccess,
  onError,
}: RenameModalProps) {
  const isDirectory = item?.isDirectory ?? false;
  const fullName = item?.name ?? "";

  // Split name and extension for file items
  const extIndex = !isDirectory ? fullName.lastIndexOf(".") : -1;
  const fileExt = extIndex > 0 ? fullName.slice(extIndex) : "";
  const baseName = extIndex > 0 ? fullName.slice(0, extIndex) : fullName;

  const [name, setName] = useState(() =>
    !isDirectory && fileExt ? baseName : fullName,
  );
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  if (!open || !item) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    // Build the final full name with extension preserved if it was a file
    const finalNewName =
      !isDirectory && fileExt && !cleanName.endsWith(fileExt)
        ? `${cleanName}${fileExt}`
        : cleanName;

    if (finalNewName === item.name) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/gallery/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          action: "rename",
          path: item.path,
          newName: finalNewName,
        }),
      });

      const json = (await res.json()) as {
        success?: boolean;
        oldPath?: string;
        newPath?: string;
        newName?: string;
        error?: string;
      };

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to rename item.");
      }

      onSuccess(
        json.oldPath || item.path,
        json.newPath || item.path,
        json.newName || finalNewName,
      );
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to rename item.");
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
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
            {isDirectory ? <Folder size={20} /> : <ImageIcon size={20} />}
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">
              Rename {isDirectory ? "Folder" : "File"}
            </h3>
            <p className="text-xs text-text-secondary truncate max-w-[280px]">
              {item.name}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isDirectory ? "Folder name" : "File name"}
                disabled={loading}
                className="w-full rounded-xl border border-border-strong bg-bg-input px-3.5 py-2.5 text-xs font-medium text-text-primary placeholder:text-text-muted outline-none transition focus:border-accent focus:bg-bg-hover focus:ring-4 focus:ring-accent/15"
              />
            </div>
            {!isDirectory && fileExt && (
              <span className="shrink-0 rounded-xl border border-border-subtle bg-bg-input px-3 py-2.5 font-mono text-xs font-semibold text-text-secondary">
                {fileExt}
              </span>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover hover:text-text-primary disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-md shadow-accent/20 transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
              {loading && (
                <Loader2 size={13} className="animate-spin text-accent-foreground" />
              )}
              <span>Rename</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
