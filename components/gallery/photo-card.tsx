"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Heart } from "lucide-react";
import { galleryImageUrl } from "@/lib/gallery-image-url";
import type { GalleryPhoto } from "./lightbox-modal";

interface PhotoCardProps {
  photo: GalleryPhoto;
  libraryId: number;
  aspectRatio?: "square" | "natural" | "justified";
  width?: number;
  height?: number;
  eager?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onToggleFavorite?: (photo: GalleryPhoto, isFav: boolean) => void;
  onSelect: (photo: GalleryPhoto) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMeasureAspectRatio?: (path: string, ar: number) => void;
}

function timeLabel(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function PhotoCard({
  photo,
  libraryId,
  aspectRatio = "square",
  width,
  height,
  eager = false,
  selectable = false,
  selected = false,
  onToggleSelect,
  onToggleFavorite,
  onSelect,
  onContextMenu,
  onMeasureAspectRatio,
}: PhotoCardProps) {
  const [favoritedOverride, setFavoritedOverride] = useState<{
    path: string;
    isFav: boolean;
  } | null>(null);

  const isFavorite =
    favoritedOverride && favoritedOverride.path === photo.path
      ? favoritedOverride.isFav
      : Boolean(photo.isFavorite);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const nextFav = !isFavorite;
    setFavoritedOverride({ path: photo.path, isFav: nextFav });
    onToggleFavorite?.(photo, nextFav);

    try {
      await fetch("/api/gallery/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          path: photo.path,
          isFavorite: nextFav,
        }),
      });
    } catch {
      setFavoritedOverride({ path: photo.path, isFav: !nextFav });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (selectable && onToggleSelect && (selected || e.shiftKey)) {
      e.preventDefault();
      onToggleSelect();
      return;
    }
    onSelect(photo);
  };

  const handleImageLoad = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
  ) => {
    if (!onMeasureAspectRatio) return;
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      onMeasureAspectRatio(photo.path, img.naturalWidth / img.naturalHeight);
    }
  };

  const isSquare = aspectRatio === "square";
  const isJustified = aspectRatio === "justified";

  return (
    <div
      onContextMenu={onContextMenu}
      style={{
        contentVisibility: "auto",
        width: isJustified && width ? `${width}px` : undefined,
        height: isJustified && height ? `${height}px` : undefined,
        containIntrinsicSize:
          isJustified && width && height
            ? `${width}px ${height}px`
            : isSquare
              ? "200px 200px"
              : "240px",
        flexShrink: isJustified ? 0 : undefined,
      }}
      className={`group relative overflow-hidden rounded-xl bg-bg-input transition-all select-none ${
        isJustified
          ? ""
          : isSquare
            ? "aspect-square w-full"
            : "mb-2.5 block w-full break-inside-avoid"
      } ${
        selected
          ? "ring-4 ring-accent ring-offset-2 ring-offset-black"
          : "hover:shadow-lg hover:shadow-black/50"
      }`}
    >
      <button
        type="button"
        onClick={handleClick}
        title={`${photo.name}${photo.modifiedAt ? ` · ${timeLabel(photo.modifiedAt)}` : ""}`}
        aria-label={`View photo ${photo.name}`}
        className={`relative block w-full cursor-pointer focus-visible:outline-none ${
          isSquare || isJustified ? "h-full" : ""
        }`}
      >
        {isSquare || isJustified ? (
          <Image
            src={galleryImageUrl(
              photo.path,
              libraryId,
              photo.modifiedAt,
              photo.size,
              width ? Math.max(400, Math.round(width * 1.5)) : 640,
            )}
            alt={photo.name}
            fill
            unoptimized
            sizes={
              width
                ? `${width}px`
                : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            }
            quality={80}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            onLoad={handleImageLoad}
            className={`object-cover transition-transform duration-300 ${
              selected ? "scale-[0.98]" : "group-hover:scale-105"
            }`}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={galleryImageUrl(
              photo.path,
              libraryId,
              photo.modifiedAt,
              photo.size,
              600,
            )}
            alt={photo.name}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onLoad={handleImageLoad}
            className={`block h-auto w-full object-cover transition-transform duration-300 ${
              selected ? "scale-[0.98]" : "group-hover:scale-105"
            }`}
          />
        )}

        {/* Hover gradient vignette for top checkmark and bottom info */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/50 via-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {photo.modifiedAt && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur opacity-0 transition-opacity group-hover:opacity-100">
            {timeLabel(photo.modifiedAt)}
          </span>
        )}
      </button>
      {/* Select Checkbox Button */}
      {selectable && onToggleSelect && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          title={selected ? "Deselect photo" : "Select photo"}
          className={`absolute top-2.5 left-2.5 z-10 flex size-6 items-center justify-center rounded-full transition-all cursor-pointer ${
            selected
              ? "bg-accent text-accent-foreground shadow-md shadow-accent/30 scale-100 opacity-100 ring-2 ring-black"
              : "border-2 border-white/70 bg-black/30 text-transparent backdrop-blur hover:scale-110 hover:border-white opacity-0 group-hover:opacity-100"
          }`}
        >
          <Check
            size={13}
            strokeWidth={3}
            className={selected ? "text-accent-foreground" : "text-transparent"}
          />
        </button>
      )}

      {/* Favorite Heart Button */}
      <button
        type="button"
        onClick={handleToggleFavorite}
        title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        className={`absolute top-2.5 right-2.5 z-10 flex size-6 items-center justify-center rounded-full backdrop-blur transition-all hover:scale-110 cursor-pointer ${
          isFavorite
            ? "bg-black/50 text-rose-500 opacity-100 shadow-sm"
            : "border-2 border-white/70 bg-black/30 text-white/80 hover:border-white hover:text-rose-400 opacity-0 group-hover:opacity-100"
        }`}
      >
        <Heart
          size={13}
          className={isFavorite ? "fill-rose-500 text-rose-500" : ""}
        />
      </button>
    </div>
  );
}
