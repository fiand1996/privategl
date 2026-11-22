"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

interface CreateAlbumModalProps {
  open: boolean;
  libraryId: number;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function CreateAlbumModal({
  open,
  libraryId,
  onClose,
  onSuccess,
  onError,
}: CreateAlbumModalProps) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          libraryId,
          name: name.trim(),
          description: desc.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create album.");

      setName("");
      setDesc("");
      onSuccess();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create album.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md rounded-2xl border border-border-strong bg-bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <h3 className="text-base font-bold text-text-primary">Create Virtual Album</h3>
        <p className="mt-1 text-xs text-text-secondary">
          Virtual albums let you curate photos without duplicating files on your disk.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground">
              Album Title
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Best of 2024, Family Trip"
              className="mt-1.5 w-full rounded-xl border border-border-strong bg-bg-input px-3.5 py-2.5 text-xs text-text-primary outline-none transition focus:border-accent focus:bg-bg-hover"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground">
              Description (optional)
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Add a brief description..."
              className="mt-1.5 w-full rounded-xl border border-border-strong bg-bg-input px-3.5 py-2.5 text-xs text-text-primary outline-none transition focus:border-accent focus:bg-bg-hover"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={creating}
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-md shadow-accent/20 transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
              {creating && <Loader2 size={13} className="animate-spin text-accent-foreground" />}
              Create Album
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
