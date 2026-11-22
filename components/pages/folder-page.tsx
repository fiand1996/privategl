"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Upload, X } from "lucide-react";
import { GalleryHeader } from "@/components/layout/gallery-header";
import { useLibrary } from "@/components/layout/library-context";
import { useAppSettings } from "@/components/layout/settings-context";
import {
  getGridClasses,
  GridControls,
  type GallerySort,
  type GridSize,
} from "@/components/gallery/grid-controls";
import { PhotoCard } from "@/components/gallery/photo-card";
import {
  LightboxModal,
  type GalleryPhoto,
} from "@/components/gallery/lightbox-modal";
import {
  ContextMenu,
  type ContextMenuPosition,
} from "@/components/gallery/context-menu";
import { ConfirmDialog } from "@/components/gallery/confirm-dialog";
import { FolderPickerModal } from "@/components/gallery/folder-picker-modal";
import { AddToAlbumModal } from "@/components/gallery/add-to-album-modal";
import { AddTagModal } from "@/components/gallery/add-tag-modal";
import { AddPersonModal } from "@/components/gallery/add-person-modal";
import { FolderBreadcrumbs } from "@/components/folder/folder-breadcrumbs";
import { FolderGridItem } from "@/components/folder/folder-grid-item";
import { FolderActionBar } from "@/components/folder/folder-action-bar";
import { CreateFolderModal } from "@/components/folder/create-folder-modal";
import { RenameModal } from "@/components/folder/rename-modal";
import { useFolderUpload } from "@/components/folder/folder-upload";
import { useUpload } from "@/components/layout/upload-context";

interface GalleryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  coverPath?: string;
  coverUpdatedAt?: string;
  coverSize?: number;
  size?: number;
  updatedAt?: string;
  isFavorite?: boolean;
}

interface Breadcrumb {
  name: string;
  path: string;
}

interface GalleryResponse {
  currentPath: string;
  items: GalleryItem[];
  breadcrumbs: Breadcrumb[];
  totalCount: number;
  folderCount: number;
  imageCount: number;
  page: number;
  pageSize: number;
}


function FolderContent({
  libraryId,
  folderPath,
  sort,
  gridSize,
  externalSelectedPhoto,
  onClearExternalPhoto,
}: {
  libraryId: number;
  folderPath: string;
  sort: GallerySort;
  gridSize: GridSize;
  externalSelectedPhoto: GalleryPhoto | null;
  onClearExternalPhoto: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [data, setData] = useState<GalleryResponse>({
    currentPath: "",
    items: [],
    breadcrumbs: [],
    totalCount: 0,
    folderCount: 0,
    imageCount: 0,
    page: 1,
    pageSize: 48,
  });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    isFetchingRef.current = loading || loadingMore;
  }, [loading, loadingMore]);

  // Selection state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Lightbox state
  const [localSelectedPhoto, setLocalSelectedPhoto] =
    useState<GalleryPhoto | null>(null);

  // Context Menu state
  const [contextMenuPos, setContextMenuPos] =
    useState<ContextMenuPosition | null>(null);

  // Modals state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [folderPickerAction, setFolderPickerAction] = useState<
    "move" | "copy" | null
  >(null);
  const [addToAlbumOpen, setAddToAlbumOpen] = useState(false);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    path: string;
    name: string;
    isDirectory: boolean;
  } | null>(null);

  // Global Upload Listener: auto-refresh when files complete uploading in this folder
  const { lastCompletedFolder } = useUpload();
  const folderUploadTimestamp =
    lastCompletedFolder &&
    lastCompletedFolder.libraryId === libraryId &&
    lastCompletedFolder.folderPath === folderPath
      ? lastCompletedFolder.timestamp
      : 0;

  // Upload Hook
  const {
    isDragging,
    setIsDragging,
    handleDrop,
    UploadMenu,
  } = useFolderUpload({
    libraryId,
    folderPath,
    onSuccess: (msg) => {
      setNotice(msg);
      setRefreshKey((k) => k + 1);
    },
    onError: (err) => setError(err),
  });

  // Fetch directory contents
  useEffect(() => {
    const controller = new AbortController();

    fetch(
      `/api/gallery?${new URLSearchParams({
        libraryId: String(libraryId),
        path: folderPath,
        page: String(page),
        sort,
      })}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (res) => {
        const json = (await res.json()) as GalleryResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to open directory.");
        setError("");
        if (page > 1 && json.items.length === 0) {
          setData((current) => ({
            ...current,
            totalCount: current.items.length,
          }));
          return;
        }
        setData((current) => {
          if (page === 1) return json;
          const existing = new Set(current.items.map((i) => i.path));
          const newItems = json.items.filter((i) => !existing.has(i.path));
          return {
            ...json,
            items: [...current.items, ...newItems],
          };
        });
        if (page === 1) {
          setSelectedPaths(new Set());
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to open directory.",
        );
      })
      .finally(() => {
        isFetchingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => controller.abort();
  }, [folderPath, libraryId, page, refreshKey, sort, folderUploadTimestamp]);

  const hasMore = data.totalCount > 0 && data.items.length < data.totalCount;

  const triggerNextPage = useCallback(() => {
    if (isFetchingRef.current || loading || loadingMore || !hasMore) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    setPage((current) => current + 1);
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
  }, [error, hasMore, loading, loadingMore, triggerNextPage]);

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
  }, [hasMore, loading, loadingMore, data.items.length, triggerNextPage]);

  const folders = data.items.filter((item) => item.isDirectory);
  const photos: GalleryPhoto[] = data.items
    .filter((item) => !item.isDirectory)
    .map((item) => ({
      name: item.name,
      path: item.path,
      size: item.size ?? null,
      modifiedAt: item.updatedAt ?? null,
      isFavorite: item.isFavorite,
    }));

  const allItemPaths = data.items.map((i) => i.path);
  const isAllSelected =
    data.items.length > 0 && selectedPaths.size === data.items.length;
  const singleSelectedPath =
    selectedPaths.size === 1 ? Array.from(selectedPaths)[0] : null;
  const singleSelectedItem = singleSelectedPath
    ? data.items.find((i) => i.path === singleSelectedPath)
    : null;

  // Toggle selection for a single path
  const toggleSelect = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Select all or deselect all
  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(allItemPaths));
    }
  }, [allItemPaths, isAllSelected]);

  // Keyboard shortcut Ctrl+A / Cmd+A, Escape, and F2 (Rename)
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
      } else if (e.key === "F2") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        if (isAdmin && singleSelectedItem) {
          e.preventDefault();
          setRenameTarget({
            path: singleSelectedItem.path,
            name: singleSelectedItem.name,
            isDirectory: singleSelectedItem.isDirectory,
          });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allItemPaths, isAdmin, selectedPaths.size, singleSelectedItem]);

  // Context Menu handler
  const handleItemContextMenu = (e: React.MouseEvent, itemPath: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedPaths.has(itemPath)) {
      setSelectedPaths(new Set([itemPath]));
    }

    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  // Execute Action API
  const executeAction = async (
    action: "delete" | "move" | "copy",
    destinationFolder?: string,
  ) => {
    if (selectedPaths.size === 0) return;
    setActionLoading(true);
    setError("");
    setNotice("");

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

      const json = (await res.json()) as {
        success?: boolean;
        count?: number;
        error?: string;
      };

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to perform action: ${action}.`);
      }

      const count = json.count ?? selectedPaths.size;
      const actionPast =
        action === "delete"
          ? "deleted"
          : action === "move"
            ? "moved"
            : "copied";

      setNotice(`Successfully ${actionPast} ${count} item(s).`);
      setSelectedPaths(new Set());
      setConfirmDeleteOpen(false);
      setFolderPickerAction(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const activePhoto = externalSelectedPhoto ?? localSelectedPhoto;

  const handleRenameSuccess = (
    oldPath: string,
    newPath: string,
    newName: string,
  ) => {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.path === oldPath) {
          return {
            ...item,
            path: newPath,
            name: newName,
          };
        }
        if (item.path.startsWith(oldPath + "/")) {
          const suffix = item.path.slice(oldPath.length);
          return {
            ...item,
            path: newPath + suffix,
          };
        }
        return item;
      }),
    }));
    setSelectedPaths((prev) => {
      if (prev.has(oldPath)) {
        const next = new Set(prev);
        next.delete(oldPath);
        next.add(newPath);
        return next;
      }
      return prev;
    });
    setNotice(`Renamed to "${newName}" successfully.`);
  };

  const selectedItems = data.items.filter((item) => selectedPaths.has(item.path));
  const selectedHasDirectories = selectedItems.some((item) => item.isDirectory);
  const selectedPhotos = selectedItems.filter((item) => !item.isDirectory);
  const onlyPhotosSelected = selectedPhotos.length > 0 && !selectedHasDirectories;

  const handleBatchFavorite = async () => {
    if (selectedPhotos.length === 0) return;
    const paths = selectedPhotos.map((p) => p.path);
    const allFav = selectedPhotos.every((p) => p.isFavorite);
    const nextFav = !allFav;

    try {
      await fetch("/api/gallery/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          entryPaths: paths,
          isFavorite: nextFav,
        }),
      });
      setData((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          paths.includes(item.path) ? { ...item, isFavorite: nextFav } : item,
        ),
      }));
      setNotice(
        nextFav
          ? `Added ${paths.length} photo(s) to Favorites.`
          : `Removed ${paths.length} photo(s) from Favorites.`,
      );
      setSelectedPaths(new Set());
    } catch {
      // ignore
    }
  };

  const handleToggleFavorite = (photo: GalleryPhoto, isFav: boolean) => {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.path === photo.path ? { ...item, isFavorite: isFav } : item,
      ),
    }));
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
      className="relative min-h-[70vh]"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-4 z-50 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-accent bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="flex size-20 items-center justify-center rounded-3xl bg-accent/15 text-accent shadow-2xl animate-bounce">
            <Upload size={40} />
          </div>
          <p className="mt-4 text-base font-bold text-text-primary">
            Drop files or folders here
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Upload directly into{" "}
            <span className="font-semibold text-accent">
              {folderPath ? folderPath : "Root"}
            </span>
          </p>
        </div>
      )}

      {/* Breadcrumb & Toolbar */}
      <FolderBreadcrumbs
        breadcrumbs={data.breadcrumbs}
        folderCount={data.folderCount}
        imageCount={data.imageCount}
        isAdmin={isAdmin}
        isAllSelected={isAllSelected}
        hasItems={data.items.length > 0}
        uploadMenuNode={UploadMenu}
        onToggleSelectAll={toggleSelectAll}
        onOpenCreateFolder={() => setCreateFolderOpen(true)}
      />

      {notice && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-400">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-accent" />
        </div>
      ) : (
        <div>
          {/* Unified Explorer Grid (Folders & Photos together) */}
          {data.items.length > 0 ? (
            <div>
              <div className={getGridClasses(gridSize)}>
                {/* 1. Folders first */}
                {folders.map((folder) => (
                  <FolderGridItem
                    key={folder.path}
                    folder={folder}
                    libraryId={libraryId}
                    isSelected={selectedPaths.has(folder.path)}
                    hasSelection={selectedPaths.size > 0}
                    onToggleSelect={() => toggleSelect(folder.path)}
                    onContextMenu={(e) => handleItemContextMenu(e, folder.path)}
                  />
                ))}

                {/* 2. Photos next in the same unified grid */}
                {photos.map((photo) => (
                  <PhotoCard
                    key={photo.path}
                    photo={photo}
                    libraryId={libraryId}
                    selectable
                    selected={selectedPaths.has(photo.path)}
                    onToggleSelect={() => toggleSelect(photo.path)}
                    onToggleFavorite={handleToggleFavorite}
                    onSelect={(p) => {
                      if (selectedPaths.size > 0) {
                        toggleSelect(p.path);
                      } else {
                        setLocalSelectedPhoto(p);
                      }
                    }}
                    onContextMenu={(e) => handleItemContextMenu(e, photo.path)}
                  />
                ))}
              </div>

              <div
                ref={sentinelRef}
                className="h-10 flex items-center justify-center mt-6"
              >
                {loadingMore && (
                  <Loader2 className="size-6 animate-spin text-accent" />
                )}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-text-secondary">
              <Upload size={36} className="mx-auto mb-3 text-text-muted" />
              <p className="font-semibold text-foreground">This directory is empty</p>
              <p className="mt-1 text-xs text-text-muted">
                Click &ldquo;Upload&rdquo; or drag and drop images and folders here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Floating Action Bar (When items are selected) */}
      <FolderActionBar
        selectedCount={selectedPaths.size}
        isAdmin={isAdmin}
        hasDirectories={selectedHasDirectories}
        isAllSelected={isAllSelected}
        onToggleSelectAll={toggleSelectAll}
        onRename={
          isAdmin && singleSelectedItem
            ? () =>
                setRenameTarget({
                  path: singleSelectedItem.path,
                  name: singleSelectedItem.name,
                  isDirectory: singleSelectedItem.isDirectory,
                })
            : undefined
        }
        onCopy={() => setFolderPickerAction("copy")}
        onMove={() => setFolderPickerAction("move")}
        onFavorite={handleBatchFavorite}
        onAddToAlbum={() => setAddToAlbumOpen(true)}
        onTag={() => setAddTagOpen(true)}
        onPerson={() => setAddPersonOpen(true)}
        onDelete={() => setConfirmDeleteOpen(true)}
        onClear={() => setSelectedPaths(new Set())}
      />

      {/* Right Click Context Menu */}
      <ContextMenu
        position={contextMenuPos}
        selectedCount={selectedPaths.size}
        canOpen={selectedPaths.size === 1}
        canDownload={
          selectedPaths.size === 1 &&
          Boolean(singleSelectedItem && !singleSelectedItem.isDirectory)
        }
        canRename={isAdmin && Boolean(singleSelectedItem)}
        onRename={() => {
          if (singleSelectedItem) {
            setRenameTarget({
              path: singleSelectedItem.path,
              name: singleSelectedItem.name,
              isDirectory: singleSelectedItem.isDirectory,
            });
          }
        }}
        onOpen={() => {
          if (singleSelectedItem) {
            if (singleSelectedItem.isDirectory) {
              router.push(
                `/folder?path=${encodeURIComponent(singleSelectedItem.path)}`,
              );
            } else {
              setLocalSelectedPhoto({
                name: singleSelectedItem.name,
                path: singleSelectedItem.path,
                size: singleSelectedItem.size ?? null,
                modifiedAt: singleSelectedItem.updatedAt ?? null,
                isFavorite: singleSelectedItem.isFavorite,
              });
            }
          }
        }}
        onDownload={() => {
          if (singleSelectedItem && !singleSelectedItem.isDirectory) {
            window.open(
              `/api/gallery/image?path=${encodeURIComponent(singleSelectedItem.path)}&libraryId=${libraryId}`,
              "_blank",
            );
          }
        }}
        onFavorite={
          onlyPhotosSelected
            ? async () => {
                const paths = selectedPhotos.map((p) => p.path);
                const allFav = selectedPhotos.every((p) => p.isFavorite);
                const nextFav = !allFav;
                try {
                  await fetch("/api/gallery/metadata", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      libraryId,
                      entryPaths: paths,
                      isFavorite: nextFav,
                    }),
                  });
                  setData((prev) => ({
                    ...prev,
                    items: prev.items.map((item) =>
                      paths.includes(item.path)
                        ? { ...item, isFavorite: nextFav }
                        : item,
                    ),
                  }));
                  setNotice(
                    nextFav
                      ? `Added ${paths.length} photo(s) to Favorites.`
                      : `Removed ${paths.length} photo(s) from Favorites.`,
                  );
                } catch {
                  // ignore
                }
              }
            : undefined
        }
        onCopy={() => setFolderPickerAction("copy")}
        onMove={() => setFolderPickerAction("move")}
        onDelete={() => setConfirmDeleteOpen(true)}
        onClose={() => setContextMenuPos(null)}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete ${selectedPaths.size} Item(s)?`}
        description="The selected items will be permanently removed from your computer disk. This action cannot be undone."
        confirmLabel="Delete Permanently"
        isDestructive
        loading={actionLoading}
        onConfirm={() => executeAction("delete")}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Folder Picker for Move & Copy */}
      <FolderPickerModal
        open={folderPickerAction !== null}
        libraryId={libraryId}
        action={folderPickerAction ?? "move"}
        selectedCount={selectedPaths.size}
        currentFolder={folderPath}
        loading={actionLoading}
        onConfirm={(target) => executeAction(folderPickerAction!, target)}
        onCancel={() => setFolderPickerAction(null)}
      />

      {/* Add to Album Modal */}
      <AddToAlbumModal
        open={addToAlbumOpen}
        libraryId={libraryId}
        photoPaths={selectedPhotos.map((p) => p.path)}
        onClose={() => setAddToAlbumOpen(false)}
        onSuccess={(albumName) => {
          setNotice(`Added ${selectedPhotos.length} photo(s) to "${albumName}".`);
          setSelectedPaths(new Set());
        }}
      />

      {/* Add Tag Modal */}
      <AddTagModal
        isOpen={addTagOpen}
        libraryId={libraryId}
        entryPaths={selectedPhotos.map((p) => p.path)}
        onClose={() => setAddTagOpen(false)}
        onSuccess={(tagName, count) => {
          setNotice(`Added tag #${tagName} to ${count} photo(s).`);
          setSelectedPaths(new Set());
        }}
      />

      {/* Add Person Modal */}
      <AddPersonModal
        isOpen={addPersonOpen}
        libraryId={libraryId}
        entryPaths={selectedPhotos.map((p) => p.path)}
        onClose={() => setAddPersonOpen(false)}
        onSuccess={(personName, count) => {
          setNotice(`Tagged ${personName} in ${count} photo(s).`);
          setSelectedPaths(new Set());
        }}
      />

      {/* Create Folder Modal */}
      <CreateFolderModal
        open={createFolderOpen}
        libraryId={libraryId}
        parentFolder={folderPath}
        onClose={() => setCreateFolderOpen(false)}
        onSuccess={(folderName) => {
          setNotice(`Successfully created folder "${folderName}".`);
          setRefreshKey((k) => k + 1);
        }}
        onError={(err) => setError(err)}
      />

      {/* Rename Item Modal */}
      <RenameModal
        key={renameTarget ? renameTarget.path : "closed"}
        open={renameTarget !== null}
        libraryId={libraryId}
        item={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSuccess={handleRenameSuccess}
        onError={(err) => setError(err)}
      />

      {/* Lightbox Modal */}
      <LightboxModal
        photo={activePhoto}
        items={photos}
        libraryId={libraryId}
        onClose={() => {
          setLocalSelectedPhoto(null);
          onClearExternalPhoto();
        }}
        onNavigate={setLocalSelectedPhoto}
      />
    </div>
  );
}

export function FolderView() {
  const { selectedLibraryId } = useLibrary();
  const { settings } = useAppSettings();
  const searchParams = useSearchParams();
  const folderPath = searchParams.get("path") || "";

  const [sort, setSort] = useState<GallerySort>(() => settings.defaultSort);
  const [gridSize, setGridSize] = useState<GridSize>(() => settings.defaultGridSize);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);

  return (
    <div>
      <GalleryHeader
        onSelectPhoto={setSelectedPhoto}
        actions={
          <GridControls
            sort={sort}
            gridSize={gridSize}
            onSortChange={setSort}
            onGridSizeChange={setGridSize}
          />
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        {selectedLibraryId !== null && (
          <FolderContent
            key={`${selectedLibraryId}:${folderPath}:${sort}`}
            libraryId={selectedLibraryId}
            folderPath={folderPath}
            sort={sort}
            gridSize={gridSize}
            externalSelectedPhoto={selectedPhoto}
            onClearExternalPhoto={() => setSelectedPhoto(null)}
          />
        )}
      </div>
    </div>
  );
}

// Re-export as ExploreView for backward compatibility
export { FolderView as ExploreView };
