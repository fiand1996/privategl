"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderArchive, Loader2, Plus } from "lucide-react";
import {
  AlbumCard,
  type GalleryAlbum,
} from "@/components/gallery/album-card";
import {
  getGridClasses,
  type GallerySort,
  type GridSize,
} from "@/components/gallery/grid-controls";
import { ConfirmDialog } from "@/components/gallery/confirm-dialog";
import { CreateAlbumModal } from "./create-album-modal";

interface AlbumsResponse {
  items: GalleryAlbum[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface AlbumsListViewProps {
  libraryId: number;
  sort: GallerySort;
  gridSize: GridSize;
}

export function AlbumsListView({
  libraryId,
  sort,
  gridSize,
}: AlbumsListViewProps) {
  const [albums, setAlbums] = useState<AlbumsResponse>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 48,
  });
  const [page, setPage] = useState(1);
  const [kindFilter, setKindFilter] = useState<"all" | "folder" | "custom">("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<GalleryAlbum | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GalleryAlbum | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(
      `/api/albums?${new URLSearchParams({
        libraryId: String(libraryId),
        page: String(page),
        sort,
        kind: kindFilter,
      })}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (res) => {
        const data = (await res.json()) as AlbumsResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load albums.");
        setAlbums((current) => {
          if (page === 1) return data;
          const existingKeys = new Set(
            current.items.map((item) => item.path || String(item.id)),
          );
          const newItems = data.items.filter(
            (item) => !existingKeys.has(item.path || String(item.id)),
          );
          return {
            ...data,
            items: [...current.items, ...newItems],
          };
        });
        setError("");
        if (page > 1 && data.items.length === 0) {
          setAlbums((current) => ({
            ...current,
            totalCount: current.items.length,
          }));
          return;
        }
        setAlbums((current) => {
          if (page === 1) return data;
          const existingKeys = new Set(
            current.items.map((item) => item.path || String(item.id)),
          );
          const newItems = data.items.filter(
            (item) => !existingKeys.has(item.path || String(item.id)),
          );
          return {
            ...data,
            items: [...current.items, ...newItems],
          };
        });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load albums.");
      })
      .finally(() => {
        isFetchingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => controller.abort();
  }, [libraryId, sort, kindFilter, page, refreshKey]);

  const hasMore = albums.totalCount > 0 && albums.items.length < albums.totalCount;

  const triggerNextPage = useCallback(() => {
    if (isFetchingRef.current || loading || loadingMore || !hasMore) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    setPage((p) => p + 1);
  }, [hasMore, loading, loadingMore]);

  // Infinite Scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore || error) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          triggerNextPage();
        }
      },
      { rootMargin: "800px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, error, triggerNextPage]);

  // Window scroll fallback
  useEffect(() => {
    if (!hasMore || loading || loadingMore || error) return;

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollY + windowHeight >= docHeight - 800) {
        triggerNextPage();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [error, hasMore, loading, loadingMore, triggerNextPage]);

  // Initial fill check for large screens
  useEffect(() => {
    if (!loading && !loadingMore && hasMore) {
      const timer = setTimeout(() => {
        if (document.documentElement.scrollHeight <= window.innerHeight + 100) {
          triggerNextPage();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [hasMore, loading, loadingMore, albums.items.length, triggerNextPage]);

  const handleKindFilterChange = (filter: "all" | "folder" | "custom") => {
    if (filter === kindFilter) return;
    setKindFilter(filter);
    setPage(1);
    setLoading(true);
  };

  const handleRenameAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget?.id || !renameInput.trim()) return;
    setRenaming(true);

    try {
      const res = await fetch("/api/albums", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId: renameTarget.id,
          name: renameInput.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to rename album.");

      setRenameTarget(null);
      setPage(1);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename album.");
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteAlbum = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/albums?albumId=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete album.");
      setDeleteTarget(null);
      setPage(1);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete album.");
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
        {error}
      </div>
    );
  }

  return (
    <div>
      {/* Top Header & Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
            Albums
          </h1>
          <p className="text-xs text-text-secondary">
            {albums.totalCount} albums in library
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Pills */}
          <div className="flex items-center rounded-xl border border-border-subtle bg-bg-card p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleKindFilterChange("all")}
              className={`rounded-lg px-3 py-1 transition cursor-pointer ${
                kindFilter === "all"
                  ? "bg-accent text-accent-foreground font-bold"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleKindFilterChange("folder")}
              className={`rounded-lg px-3 py-1 transition cursor-pointer ${
                kindFilter === "folder"
                  ? "bg-accent text-accent-foreground font-bold"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              Folders
            </button>
            <button
              type="button"
              onClick={() => handleKindFilterChange("custom")}
              className={`rounded-lg px-3 py-1 transition cursor-pointer ${
                kindFilter === "custom"
                  ? "bg-accent text-accent-foreground font-bold"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              Virtual
            </button>
          </div>

          {/* Create Album Button */}
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover cursor-pointer"
          >
            <Plus size={14} />
            <span>Create Album</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-accent" />
        </div>
      ) : albums.items.length === 0 ? (
        <div className="mx-auto mt-16 max-w-md text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-bg-input text-text-muted">
            <FolderArchive size={32} />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-text-primary">
            No Albums Found
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Create a new virtual album or scan directories in your library.
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover cursor-pointer"
          >
            <Plus size={15} />
            <span>Create New Album</span>
          </button>
        </div>
      ) : (
        <>
          <div className={getGridClasses(gridSize)}>
            {albums.items.map((album) => (
              <AlbumCard
                key={album.path || album.id}
                album={album}
                libraryId={libraryId}
                onRename={(alb) => {
                  setRenameTarget(alb);
                  setRenameInput(alb.name);
                }}
                onDelete={album.kind === "custom" ? (alb) => setDeleteTarget(alb) : undefined}
              />
            ))}
          </div>

          {/* Infinite Scroll Sentinel */}
          <div ref={sentinelRef} className="h-10 w-full" />

          {loadingMore && (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-accent" />
            </div>
          )}
        </>
      )}

      {/* Create Album Modal */}
      <CreateAlbumModal
        open={createModalOpen}
        libraryId={libraryId}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setPage(1);
          setRefreshKey((k) => k + 1);
        }}
        onError={(err) => setError(err)}
      />

      {/* Rename Album Modal */}
      {renameTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border-strong bg-bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-text-primary">Rename Album</h3>
            <p className="mt-1 text-xs text-text-secondary">
              Change the display title of this album.
            </p>

            <form onSubmit={handleRenameAlbum} className="mt-4">
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="Album title"
                className="w-full rounded-xl border border-border-strong bg-bg-input px-3.5 py-2.5 text-xs font-medium text-text-primary outline-none transition focus:border-accent focus:bg-bg-hover"
              />

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={renaming}
                  onClick={() => setRenameTarget(null)}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renaming || !renameInput.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
                >
                  {renaming && <Loader2 size={13} className="animate-spin text-accent-foreground" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Album Confirm Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This will remove this virtual album. Your original photo files will NOT be deleted from your disk."
        confirmLabel="Delete Album"
        isDestructive
        loading={deleting}
        onConfirm={handleDeleteAlbum}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
