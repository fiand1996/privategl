"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Folder, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { galleryImageUrl } from "@/lib/gallery-image-url";
import { recordAlbumOpen } from "@/lib/album-recommendations";

export interface GalleryAlbum {
  id?: number;
  kind?: "folder" | "custom";
  name: string;
  path: string;
  description?: string | null;
  photoCount: number;
  coverPath: string;
  coverModifiedAt: string | null;
  coverSize: number | null;
  updatedAt: string | null;
}

interface AlbumCardProps {
  album: GalleryAlbum;
  libraryId: number;
  onRename?: (album: GalleryAlbum) => void;
  onDelete?: (album: GalleryAlbum) => void;
}

export function AlbumCard({
  album,
  libraryId,
  onRename,
  onDelete,
}: AlbumCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-2xl hover:shadow-black/80">
      <Link
        href={`/albums?path=${encodeURIComponent(album.path)}`}
        onClick={() => recordAlbumOpen(libraryId, album.path)}
        className="block relative aspect-square w-full overflow-hidden bg-bg-input"
      >
        {/* Background Cover Image */}
        {album.coverPath ? (
          <Image
            src={galleryImageUrl(
              album.coverPath,
              libraryId,
              album.coverModifiedAt,
              album.coverSize,
              1200,
            )}
            alt={album.name}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted bg-gradient-to-br from-bg-card to-bg-surface">
            <Folder size={48} />
          </div>
        )}

        {/* Top-Left: Badge for Virtual Album */}
        {album.kind === "custom" && (
          <span className="absolute top-2.5 left-2.5 z-20 rounded-full border border-accent/40 bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-accent backdrop-blur-md shadow-md">
            Virtual
          </span>
        )}

        {/* Crisp Bottom Gradient Overlay without blur */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/45 to-transparent pt-14 pb-3.5 px-3.5 pointer-events-none">
          <h3 className="text-sm sm:text-base font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] line-clamp-1 group-hover:text-accent transition-colors">
            {album.name}
          </h3>
          <p className="mt-0.5 text-xs font-medium text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
            {album.photoCount} {album.photoCount === 1 ? "photo" : "photos"}
          </p>
          {album.description && (
            <p className="mt-0.5 text-[11px] text-white/80 line-clamp-1 drop-shadow">
              {album.description}
            </p>
          )}
        </div>
      </Link>

      {/* Top-Right: 3-dots Menu Button */}
      {(onRename || onDelete) && (
        <div className="absolute top-2.5 right-2.5 z-30" ref={menuRef}>
          <button
            type="button"
            title="Album options"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className="flex size-7 items-center justify-center rounded-xl bg-black/60 text-foreground backdrop-blur-md transition hover:bg-black/90 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100"
          >
            <MoreVertical size={14} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-40 w-36 overflow-hidden rounded-2xl border border-border-strong bg-bg-card-subtle/98 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              {onRename && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    onRename(album);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-foreground transition hover:bg-bg-hover cursor-pointer"
                >
                  <Pencil size={13} className="text-accent" />
                  <span>Rename</span>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete(album);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
