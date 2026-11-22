"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
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
        {selectedLibraryId !== null &&
          (albumPath ? (
            <AlbumDetailView
              key={`${selectedLibraryId}:${albumPath}:${sort}`}
              albumPath={albumPath}
              libraryId={selectedLibraryId}
              gridSize={gridSize}
              sort={sort}
              externalSelectedPhoto={selectedPhoto}
              onClearExternalPhoto={() => setSelectedPhoto(null)}
            />
          ) : (
            <AlbumsListView
              key={`${selectedLibraryId}:${sort}`}
              libraryId={selectedLibraryId}
              sort={sort}
              gridSize={gridSize}
            />
          ))}
      </div>
    </div>
  );
}
