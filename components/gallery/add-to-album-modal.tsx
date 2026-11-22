"use client";

import { useEffect, useState } from "react";
import { FolderArchive, Loader2, Plus, X } from "lucide-react";
import type { GalleryAlbum } from "./album-card";

interface AddToAlbumModalProps {
  open: boolean;
  libraryId: number;
  photoPaths: string[];
  onClose: () => void;
  onSuccess: (albumName: string) => void;
}

function AddToAlbumDialogContent({
  libraryId,
  photoPaths,
  onClose,
  onSuccess,
}: Omit<AddToAlbumModalProps, "open">) {
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/albums?libraryId=${libraryId}&kind=custom&page=1`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load albums.");
        setAlbums(json.items || []);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load albums.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [libraryId]);

  const handleAddToExisting = async (album: GalleryAlbum) => {
    if (!album.id) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-photos",
          albumId: album.id,
          libraryId,
          paths: photoPaths,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add photos to album.");

      onSuccess(album.name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add photos.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          libraryId,
          name: newAlbumName.trim(),
          paths: photoPaths,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create album.");

      onSuccess(newAlbumName.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create album.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border-strong bg-bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <FolderArchive size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Add to Album</h3>
              <p className="text-xs text-text-secondary">
                {photoPaths.length} photo(s) selected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-text-secondary transition hover:bg-bg-hover hover:text-text-primary cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        {creatingNew ? (
          <form onSubmit={handleCreateAndAdd} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary">
                New Album Name
              </label>
              <input
                type="text"
                autoFocus
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="e.g. Summer Vacation, Highlights"
                className="mt-1.5 w-full rounded-xl border border-border-strong bg-bg-input px-3.5 py-2.5 text-xs text-text-primary outline-none transition focus:border-accent focus:bg-bg-hover"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setCreatingNew(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting || !newAlbumName.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-md shadow-accent/20 transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                Create & Add
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border-strong p-3 text-left transition hover:border-accent hover:bg-accent-muted cursor-pointer group"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-bg-input text-accent transition group-hover:bg-accent group-hover:text-accent-foreground">
                <Plus size={16} />
              </div>
              <span className="text-xs font-semibold text-text-primary group-hover:text-accent">
                Create New Virtual Album
              </span>
            </button>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {loading && (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-accent" />
                </div>
              )}

              {!loading && albums.length === 0 && (
                <p className="py-6 text-center text-xs text-text-muted">
                  No albums found yet.
                </p>
              )}

              {!loading &&
                albums.map((album) => (
                  <button
                    key={album.path || album.id}
                    type="button"
                    disabled={submitting || !album.id}
                    onClick={() => handleAddToExisting(album)}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-left transition hover:bg-bg-hover cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FolderArchive size={15} className="text-accent shrink-0" />
                      <span className="truncate text-xs font-medium text-text-primary">
                        {album.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted shrink-0">
                      {album.photoCount} photos
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AddToAlbumModal({
  open,
  libraryId,
  photoPaths,
  onClose,
  onSuccess,
}: AddToAlbumModalProps) {
  if (!open) return null;

  return (
    <AddToAlbumDialogContent
      key={`${libraryId}:${photoPaths.length}`}
      libraryId={libraryId}
      photoPaths={photoPaths}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
