"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Info,
  X,
} from "lucide-react";
import { galleryImageUrl } from "@/lib/gallery-image-url";
import { PhotoInfoPanel } from "./photo-info-panel";

export interface GalleryPhoto {
  name: string;
  path: string;
  size: number | null;
  modifiedAt: string | null;
  width?: number | null;
  height?: number | null;
  isFavorite?: boolean;
}

interface LightboxModalProps {
  photo: GalleryPhoto | null;
  items: GalleryPhoto[];
  libraryId: number;
  onClose: () => void;
  onNavigate?: (photo: GalleryPhoto) => void;
}

export function LightboxModal({
  photo,
  items,
  libraryId,
  onClose,
  onNavigate,
}: LightboxModalProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (!photo) return;
    let active = true;
    fetch(`/api/gallery/metadata?libraryId=${libraryId}&path=${encodeURIComponent(photo.path)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { userMetadata?: { isFavorite: boolean } }) => {
        if (active && data.userMetadata) {
          setIsFavorite(data.userMetadata.isFavorite);
        }
      })
      .catch(() => {
        // ignore
      });
    return () => {
      active = false;
    };
  }, [libraryId, photo]);

  const currentIndex = photo
    ? items.findIndex((item) => item.path === photo.path)
    : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1;

  const handlePrevious = useCallback(() => {
    if (hasPrevious && onNavigate) {
      onNavigate(items[currentIndex - 1]);
    }
  }, [currentIndex, hasPrevious, items, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext && onNavigate) {
      onNavigate(items[currentIndex + 1]);
    }
  }, [currentIndex, hasNext, items, onNavigate]);

  const handleToggleFavorite = useCallback(async () => {
    if (!photo) return;
    const nextFav = !isFavorite;
    setIsFavorite(nextFav);
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
      setIsFavorite(!nextFav);
    }
  }, [isFavorite, libraryId, photo]);

  useEffect(() => {
    if (!photo) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        handlePrevious();
      } else if (event.key === "ArrowRight") {
        handleNext();
      } else if (event.key === "i" || event.key === "I") {
        setShowInfo((prev) => !prev);
      } else if (event.key === "f" || event.key === "F") {
        void handleToggleFavorite();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, handlePrevious, handleToggleFavorite, onClose, photo]);

  if (!photo) return null;

  const rawUrl = `/api/gallery/image?path=${encodeURIComponent(photo.path)}&libraryId=${libraryId}`;
  const displayUrl = galleryImageUrl(photo.path, libraryId, photo.modifiedAt, photo.size);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.name}
      className="fixed inset-0 z-50 flex flex-col bg-bg-app/95 text-text-primary backdrop-blur-2xl transition-opacity animate-in fade-in duration-200"
    >
      {/* Top action bar */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 truncate pr-4">
          <span className="truncate text-sm font-medium text-text-primary sm:text-base">
            {photo.name}
          </span>
          {currentIndex >= 0 && items.length > 0 && (
            <span className="rounded-full border border-border-subtle bg-bg-card px-2.5 py-0.5 text-xs text-text-secondary">
              {currentIndex + 1} / {items.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleToggleFavorite}
            title={isFavorite ? "Remove from Favorites (F)" : "Add to Favorites (F)"}
            className={`rounded-full p-2 transition cursor-pointer ${
              isFavorite
                ? "text-rose-500 hover:bg-rose-500/20"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            <Heart size={19} className={isFavorite ? "fill-rose-500" : ""} />
          </button>
          <a
            href={rawUrl}
            target="_blank"
            rel="noreferrer"
            download={photo.name}
            title="Download photo"
            className="rounded-full p-2 text-text-secondary transition hover:bg-bg-hover hover:text-text-primary cursor-pointer"
          >
            <Download size={19} />
          </a>
          <button
            type="button"
            onClick={() => setShowInfo((prev) => !prev)}
            title="Info & Details (I)"
            className={`rounded-full p-2 transition cursor-pointer ${
              showInfo
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            <Info size={19} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="rounded-full p-2 text-text-secondary transition hover:bg-bg-hover hover:text-text-primary cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4">
        {hasPrevious && (
          <button
            type="button"
            onClick={handlePrevious}
            title="Previous (Left Arrow)"
            className="absolute left-4 z-20 rounded-full border border-border-subtle bg-bg-card/80 p-3 text-text-primary backdrop-blur-md transition hover:bg-bg-card hover:scale-105 cursor-pointer shadow-lg"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        <div className="relative flex h-full w-full items-center justify-center">
          <Image
            src={displayUrl}
            alt={photo.name}
            fill
            unoptimized
            sizes="100vw"
            quality={85}
            priority
            className="object-contain"
          />
        </div>

        {hasNext && (
          <button
            type="button"
            onClick={handleNext}
            title="Next (Right Arrow)"
            className="absolute right-4 z-20 rounded-full border border-border-subtle bg-bg-card/80 p-3 text-text-primary backdrop-blur-md transition hover:bg-bg-card hover:scale-105 cursor-pointer shadow-lg"
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* Slide-over Info Panel */}
        {showInfo && (
          <PhotoInfoPanel
            key={photo.path}
            libraryId={libraryId}
            photo={photo}
            onClose={() => setShowInfo(false)}
            onFavoriteChange={setIsFavorite}
          />
        )}
      </div>
    </div>
  );
}
