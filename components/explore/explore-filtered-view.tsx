"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, User } from "lucide-react";
import { JustifiedPhotoGrid } from "@/components/gallery/justified-photo-grid";
import {
  GridControls,
  type GallerySort,
  type GridSize,
} from "@/components/gallery/grid-controls";
import {
  LightboxModal,
  type GalleryPhoto,
} from "@/components/gallery/lightbox-modal";
import { AddToAlbumModal } from "@/components/gallery/add-to-album-modal";
import { AddTagModal } from "@/components/gallery/add-tag-modal";
import { AddPersonModal } from "@/components/gallery/add-person-modal";
import { ConfirmDialog } from "@/components/gallery/confirm-dialog";
import { FolderPickerModal } from "@/components/gallery/folder-picker-modal";
import { ExploreActionBar } from "./explore-action-bar";


interface FilteredPhotosResponse {
  filterLabel: string;
  items: (GalleryPhoto & { isFavorite?: boolean })[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface ExploreFilteredViewProps {
  libraryId: number;
  gridSize: GridSize;
  onGridSizeChange: (size: GridSize) => void;
  sort: GallerySort;
  onSortChange: (sort: GallerySort) => void;
  collectionParam: string | null;
  tagParam: string | null;
  personParam?: string | null;
  cameraParam: string | null;
  yearParam: string | null;
  onNotice: (msg: string) => void;
}

export function ExploreFilteredView({
  libraryId,
  gridSize,
  onGridSizeChange,
  sort,
  onSortChange,
  collectionParam,
  tagParam,
  personParam,
  cameraParam,
  yearParam,
  onNotice,
}: ExploreFilteredViewProps) {
  const router = useRouter();

  const [photosData, setPhotosData] = useState<FilteredPhotosResponse>({
    filterLabel: "Explore",
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 48,
  });
  const [photosLoading, setPhotosLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [photosError, setPhotosError] = useState("");

  // Selection & Actions
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [addToAlbumOpen, setAddToAlbumOpen] = useState(false);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [folderPickerAction, setFolderPickerAction] = useState<"copy" | "move" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch Filtered Photos
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setPhotosLoading(true);
        setSelectedPaths(new Set());
      }
    });

    const params = new URLSearchParams({
      libraryId: String(libraryId),
      page: "1",
      pageSize: "48",
    });

    if (collectionParam) params.set("collection", collectionParam);
    if (tagParam) params.set("tag", tagParam);
    if (personParam) params.set("person", personParam);
    if (cameraParam) params.set("camera", cameraParam);
    if (yearParam) params.set("year", yearParam);

    fetch(`/api/explore?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load photos.");
        return res.json();
      })
      .then((data: FilteredPhotosResponse) => {
        if (active) {
          setPhotosData(data);
          setHasMore(data.items.length < data.totalCount);
          setPhotosError("");
          setPhotosLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setPhotosError(err instanceof Error ? err.message : "Error loading photos");
          setPhotosLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [libraryId, collectionParam, tagParam, personParam, cameraParam, yearParam]);

  // Infinite scroll loader
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const nextPage = photosData.page + 1;
    const params = new URLSearchParams({
      libraryId: String(libraryId),
      page: String(nextPage),
      pageSize: "48",
    });

    if (collectionParam) params.set("collection", collectionParam);
    if (tagParam) params.set("tag", tagParam);
    if (personParam) params.set("person", personParam);
    if (cameraParam) params.set("camera", cameraParam);
    if (yearParam) params.set("year", yearParam);

    try {
      const res = await fetch(`/api/explore?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load more photos.");
      const data = (await res.json()) as FilteredPhotosResponse;

      setPhotosData((prev) => {
        const existing = new Set(prev.items.map((i) => i.path));
        const newItems = data.items.filter((i) => !existing.has(i.path));
        return {
          ...prev,
          page: nextPage,
          items: [...prev.items, ...newItems],
        };
      });
      setHasMore(
        data.items.length > 0 &&
          photosData.items.length + data.items.length < photosData.totalCount,
      );
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [
    libraryId,
    loadingMore,
    hasMore,
    photosData.page,
    photosData.items.length,
    photosData.totalCount,
    collectionParam,
    tagParam,
    personParam,
    cameraParam,
    yearParam,
  ]);

  useEffect(() => {
    if (!hasMore || photosLoading || loadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "800px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, photosLoading, loadingMore, loadMore]);

  // Window scroll fallback
  useEffect(() => {
    if (!hasMore || photosLoading || loadingMore) return;

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollY + windowHeight >= docHeight - 800) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, photosLoading, loadingMore, loadMore]);

  const allItemPaths = useMemo(
    () => photosData.items.map((i) => i.path),
    [photosData.items],
  );
  const isAllSelected =
    allItemPaths.length > 0 && selectedPaths.size === allItemPaths.length;

  // Selection toggle
  const toggleSelect = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(allItemPaths));
    }
  }, [allItemPaths, isAllSelected]);

  // Keyboard shortcut Ctrl+A / Cmd+A
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        setSelectedPaths(new Set(allItemPaths));
      } else if (e.key === "Escape") {
        if (selectedPaths.size > 0) {
          setSelectedPaths(new Set());
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allItemPaths, selectedPaths.size]);

  // Batch Favorite handler
  const handleBatchFavorite = async () => {
    if (selectedPaths.size === 0) return;
    const paths = Array.from(selectedPaths);
    try {
      await fetch("/api/gallery/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          entryPaths: paths,
          isFavorite: true,
        }),
      });
      setPhotosData((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          paths.includes(item.path) ? { ...item, isFavorite: true } : item,
        ),
      }));
      onNotice(`Added ${paths.length} photo(s) to Favorites.`);
      setSelectedPaths(new Set());
    } catch {
      // ignore
    }
  };

  // Execute Copy, Move, Delete actions
  const executeAction = async (action: "delete" | "move" | "copy", destinationFolder?: string) => {
    if (selectedPaths.size === 0) return;
    setActionLoading(true);

    try {
      const res = await fetch("/api/gallery/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          action,
          paths: Array.from(selectedPaths),
          destinationFolder,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to ${action} items.`);
      }

      onNotice(`Successfully ${action}d ${selectedPaths.size} photo(s).`);
      setSelectedPaths(new Set());
      setConfirmDeleteOpen(false);
      setFolderPickerAction(null);

      // Refresh filtered photos
      setPhotosData((prev) => ({
        ...prev,
        items: prev.items.filter((item) => !selectedPaths.has(item.path)),
        totalCount: Math.max(0, prev.totalCount - selectedPaths.size),
      }));
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar with Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-bg-card/80 p-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/explore")}
            className="flex items-center gap-1.5 rounded-xl border border-border-strong bg-bg-input px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-bg-hover hover:text-text-primary cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>All Explore</span>
          </button>

          <div className="h-4 w-px bg-border-strong" />

          <div className="flex items-center gap-2">
            {photosData.filterLabel.startsWith("People:") && (
              <User size={15} className="text-accent" />
            )}
            <span className="text-sm font-bold text-text-primary">
              {photosData.filterLabel}
            </span>
            <span className="rounded-full bg-border-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary">
              {photosData.totalCount} photo
              {photosData.totalCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <GridControls
          gridSize={gridSize}
          onGridSizeChange={onGridSizeChange}
          sort={sort}
          onSortChange={onSortChange}
        />
      </div>

      {/* Photos Grid */}
      {photosLoading ? (
        <div className="py-24 text-center">
          <Loader2 className="size-8 animate-spin text-accent mx-auto mb-3" />
          <p className="text-xs text-text-secondary">Loading photos...</p>
        </div>
      ) : photosError ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-400">
          {photosError}
        </div>
      ) : photosData.items.length > 0 ? (
        <>
          <JustifiedPhotoGrid
            photos={photosData.items}
            libraryId={libraryId}
            gridSize={gridSize}
            selectable
            selectedPaths={selectedPaths}
            onToggleSelect={toggleSelect}
            onToggleFavorite={(p, isFav) => {
              setPhotosData((prev) => ({
                ...prev,
                items: prev.items.map((item) =>
                  item.path === p.path ? { ...item, isFavorite: isFav } : item,
                ),
              }));
            }}
            onSelect={(p) => {
              if (selectedPaths.size > 0) {
                toggleSelect(p.path);
              } else {
                setSelectedPhoto(p);
              }
            }}
          />

          <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-6">
            {loadingMore && <Loader2 className="size-6 animate-spin text-accent" />}
          </div>
        </>
      ) : (
        <div className="py-24 text-center text-sm text-text-muted">
          No photos found in this collection.
        </div>
      )}

      {/* Floating Action Bar (Multi-Select) */}
      <ExploreActionBar
        selectedCount={selectedPaths.size}
        isAllSelected={isAllSelected}
        onToggleSelectAll={toggleSelectAll}
        onFavorite={handleBatchFavorite}
        onCopy={() => setFolderPickerAction("copy")}
        onMove={() => setFolderPickerAction("move")}
        onAddToAlbum={() => setAddToAlbumOpen(true)}
        onTag={() => setAddTagOpen(true)}
        onPerson={() => setAddPersonOpen(true)}
        onDelete={() => setConfirmDeleteOpen(true)}
        onClear={() => setSelectedPaths(new Set())}
      />

      {/* Lightbox Modal */}
      <LightboxModal
        photo={selectedPhoto}
        items={photosData.items}
        libraryId={libraryId}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={setSelectedPhoto}
      />

      {/* Add To Album Dialog */}
      <AddToAlbumModal
        open={addToAlbumOpen}
        libraryId={libraryId}
        photoPaths={Array.from(selectedPaths)}
        onClose={() => setAddToAlbumOpen(false)}
        onSuccess={(albumName) => {
          onNotice(`Added ${selectedPaths.size} photo(s) to "${albumName}".`);
          setSelectedPaths(new Set());
        }}
      />

      {/* Add Tag Dialog */}
      <AddTagModal
        isOpen={addTagOpen}
        libraryId={libraryId}
        entryPaths={Array.from(selectedPaths)}
        onClose={() => setAddTagOpen(false)}
        onSuccess={(tagName) => {
          onNotice(`Tagged ${selectedPaths.size} photo(s) with #${tagName}.`);
          setSelectedPaths(new Set());
        }}
      />

      {/* Add Person Dialog */}
      <AddPersonModal
        isOpen={addPersonOpen}
        libraryId={libraryId}
        entryPaths={Array.from(selectedPaths)}
        onClose={() => setAddPersonOpen(false)}
        onSuccess={(personName) => {
          onNotice(`Tagged ${selectedPaths.size} photo(s) with ${personName}.`);
          setSelectedPaths(new Set());
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete ${selectedPaths.size} Photo(s)?`}
        description="The selected photos will be permanently removed from disk. This cannot be undone."
        confirmLabel="Delete Permanently"
        isDestructive
        loading={actionLoading}
        onConfirm={() => executeAction("delete")}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Folder Picker Modal (Move / Copy) */}
      <FolderPickerModal
        open={folderPickerAction !== null}
        libraryId={libraryId}
        action={folderPickerAction ?? "move"}
        selectedCount={selectedPaths.size}
        currentFolder=""
        loading={actionLoading}
        onConfirm={(target) => executeAction(folderPickerAction!, target)}
        onCancel={() => setFolderPickerAction(null)}
      />
    </div>
  );
}
