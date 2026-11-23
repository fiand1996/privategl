"use client";

import Link from "next/link";
import { FolderPlus, HardDrive } from "lucide-react";
import { useLibrary } from "./library-context";
import { GallerySearch } from "@/components/search/gallery-search";
import type { GalleryPhoto } from "@/components/gallery/lightbox-modal";

interface GalleryHeaderProps {
  onSelectPhoto?: (photo: GalleryPhoto) => void;
  actions?: React.ReactNode;
}

export function GalleryHeader({ onSelectPhoto, actions }: GalleryHeaderProps) {
  const { libraries, selectedLibraryId, selectLibrary } = useLibrary();

  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg-surface/90 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-2.5 px-3 sm:gap-4 sm:px-8">
        {/* Search bar */}
        <div className="flex-1 min-w-0 max-w-2xl">
          <GallerySearch
            libraryId={selectedLibraryId}
            onSelectPhoto={onSelectPhoto}
          />
        </div>

        {/* Right tools: Library selector & extra actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {actions}

          {libraries.length > 0 ? (
            <label className="flex h-9 sm:h-10 items-center gap-1.5 sm:gap-2 rounded-full border border-border-subtle bg-bg-input px-2.5 sm:px-3.5 text-xs text-text-primary transition hover:bg-bg-hover shadow-sm">
              <HardDrive size={14} className="text-accent shrink-0 sm:size-[15px]" />
              <select
                aria-label="Select library"
                value={selectedLibraryId ?? ""}
                onChange={(e) => selectLibrary(Number(e.target.value))}
                className="bg-transparent font-medium outline-none cursor-pointer max-w-[85px] sm:max-w-[200px] truncate"
              >
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id} className="bg-bg-surface text-text-primary">
                    {lib.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Link
              href="/settings"
              className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-accent px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover"
            >
              <FolderPlus size={14} />
              <span className="hidden sm:inline">Add Library</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
