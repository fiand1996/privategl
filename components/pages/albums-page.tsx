"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLibrary } from "@/components/layout/library-context";
import { useAppSettings } from "@/components/layout/settings-context";
import { GalleryHeader } from "@/components/layout/gallery-header";
import {
  GridControls,
  type GallerySort,
  type GridSize,
} from "@/components/gallery/grid-controls";
import { type GalleryPhoto } from "@/components/gallery/lightbox-modal";
import { AlbumDetailView } from "@/components/albums/album-detail-view";
import { AlbumsListView } from "@/components/albums/albums-list-view";

export function AlbumsView() {
  const { selectedLibraryId } = useLibrary();
  const { settings } = useAppSettings();
  const searchParams = useSearchParams();
  const albumPath = searchParams.get("path") || searchParams.get("album");

  const [sort, setSort] = useState<GallerySort>(() => settings.defaultSort);
  const [gridSize, setGridSize] = useState<GridSize>(() => settings.defaultGridSize);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);

  // Track and restore scroll position when navigating between album list and album detail
  const savedScrollPosRef = useRef<number>(0);
  const prevAlbumPathRef = useRef<string | null>(albumPath);

  // Continuously record scroll position while user is browsing albums list
  useEffect(() => {
    if (albumPath) return; // Do not overwrite while inside an album detail
    const handleScroll = () => {
      savedScrollPosRef.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [albumPath]);

  // Handle scroll transitions
  useEffect(() => {
    const prev = prevAlbumPathRef.current;
    if (albumPath && !prev) {
      // Transitioning into album detail view -> scroll to top
      window.scrollTo({ top: 0, behavior: "instant" });
    } else if (!albumPath && prev && savedScrollPosRef.current > 0) {
      // Transitioning back to album list -> restore saved scroll position
      const restoreY = savedScrollPosRef.current;
      const restore = () => window.scrollTo({ top: restoreY, behavior: "instant" });
      restore();
      requestAnimationFrame(restore);
      const timer = setTimeout(restore, 50);
      return () => clearTimeout(timer);
    }
    prevAlbumPathRef.current = albumPath;
  }, [albumPath]);

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
          <>
            {/* Always keep AlbumsListView mounted so loaded pages and scroll state are preserved */}
            <div className={albumPath ? "hidden" : "block"}>
              <AlbumsListView
                key={`${selectedLibraryId}:${sort}`}
                libraryId={selectedLibraryId}
                sort={sort}
                gridSize={gridSize}
              />
            </div>

            {/* Mount AlbumDetailView only when viewing an album */}
            {albumPath && (
              <AlbumDetailView
                key={`${selectedLibraryId}:${albumPath}:${sort}`}
                albumPath={albumPath}
                libraryId={selectedLibraryId}
                gridSize={gridSize}
                sort={sort}
                externalSelectedPhoto={selectedPhoto}
                onClearExternalPhoto={() => setSelectedPhoto(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
