"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Folder, Search, X } from "lucide-react";
import { recordAlbumOpen } from "@/lib/album-recommendations";
import { galleryImageUrl } from "@/lib/gallery-image-url";

interface SearchPhoto {
  name: string;
  path: string;
  size: number | null;
  modifiedAt: string | null;
}

interface SearchAlbum {
  name: string;
  path: string;
  photoCount: number;
  coverPath: string;
  coverModifiedAt: string | null;
  coverSize: number | null;
}

interface SearchResults {
  photos: SearchPhoto[];
  albums: SearchAlbum[];
}

function popularAlbumCounts() {
  try {
    return JSON.parse(
      window.localStorage.getItem("gallery-album-opens") || "{}",
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

export function GallerySearch({
  libraryId,
  onSelectPhoto,
}: {
  libraryId: number | null;
  onSelectPhoto?: (photo: SearchPhoto) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResults>({
    photos: [],
    albums: [],
  });
  const [results, setResults] = useState<SearchResults>({
    photos: [],
    albums: [],
  });
  const [resultsQuery, setResultsQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut (⌘K or / to search)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      } else if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Suggestions when focused and no query
  useEffect(() => {
    if (!focused || libraryId === null || query.trim()) return;
    const controller = new AbortController();
    void Promise.all([
      fetch(
        `/api/photos?${new URLSearchParams({ libraryId: String(libraryId), page: "1" })}`,
        { signal: controller.signal, cache: "no-store" },
      ),
      fetch(
        `/api/albums?${new URLSearchParams({ libraryId: String(libraryId), page: "1" })}`,
        { signal: controller.signal, cache: "no-store" },
      ),
    ])
      .then(async ([photoResponse, albumResponse]) => {
        const [photoData, albumData] = await Promise.all([
          photoResponse.json() as Promise<{ items?: SearchPhoto[]; error?: string }>,
          albumResponse.json() as Promise<{ items?: SearchAlbum[]; error?: string }>,
        ]);
        if (!photoResponse.ok) throw new Error(photoData.error || "Suggestions failed");
        if (!albumResponse.ok) throw new Error(albumData.error || "Suggestions failed");

        const counts = popularAlbumCounts();
        const albums = (albumData.items ?? []).sort(
          (a, b) =>
            (counts[`${libraryId}:${b.path}`] ?? 0) -
            (counts[`${libraryId}:${a.path}`] ?? 0),
        );
        setSuggestions({
          photos: (photoData.items ?? []).slice(0, 4),
          albums: albums.slice(0, 4),
        });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Error loading suggestions");
      });

    return () => controller.abort();
  }, [focused, libraryId, query]);

  // Search when query typed
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || libraryId === null) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      fetch(
        `/api/search?${new URLSearchParams({
          libraryId: String(libraryId),
          q: trimmed,
        })}`,
        { signal: controller.signal, cache: "no-store" },
      )
        .then(async (response) => {
          const data = (await response.json()) as SearchResults & { error?: string };
          if (!response.ok) throw new Error(data.error || "Search failed");
          setResults({
            photos: data.photos ?? [],
            albums: data.albums ?? [],
          });
          setResultsQuery(trimmed);
          setError("");
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setError(cause instanceof Error ? cause.message : "Search error");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [libraryId, query]);

  // Click outside listener
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setFocused(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const open = focused && libraryId !== null;
  const isSearching = Boolean(query.trim());
  const activeData = isSearching ? results : suggestions;

  return (
    <div ref={rootRef} className="relative w-full max-w-2xl">
      <div className="relative flex items-center">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 text-text-secondary"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onFocus={() => setFocused(true)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your photos, albums, or dates..."
          className="h-11 w-full rounded-full border border-border-strong bg-bg-input pl-11 pr-16 text-sm text-text-primary placeholder:text-text-muted transition-all outline-none focus:border-accent focus:bg-bg-hover focus:ring-2 focus:ring-accent/20"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 rounded-full p-1 text-text-secondary hover:bg-border-strong hover:text-foreground"
          >
            <X size={15} />
          </button>
        ) : (
          <span className="pointer-events-none absolute right-3.5 hidden sm:flex items-center gap-0.5 rounded-md border border-border-strong bg-bg-input px-1.5 py-0.5 text-[10px] font-mono text-text-secondary">
            ⌘K
          </span>
        )}
      </div>

      {open && (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border-strong bg-bg-card-subtle/98 p-3 shadow-2xl backdrop-blur-2xl">
          {error && (
            <p className="px-3 py-2 text-xs text-rose-500">{error}</p>
          )}

          {loading && isSearching && (
            <div className="px-3 py-3 text-xs text-text-secondary">Searching...</div>
          )}

          {!loading && isSearching && activeData.albums.length === 0 && activeData.photos.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-text-secondary">
              No results for &ldquo;{resultsQuery}&rdquo;
            </div>
          )}

          {/* Albums Section */}
          {activeData.albums.length > 0 && (
            <div className="mb-3">
              <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-text-secondary uppercase dark:text-text-muted">
                Albums
              </p>
              <div className="space-y-1">
                {activeData.albums.map((album) => (
                  <Link
                    key={album.path}
                    href={`/albums?path=${encodeURIComponent(album.path)}`}
                    onClick={() => {
                      if (libraryId) recordAlbumOpen(libraryId, album.path);
                      setFocused(false);
                    }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition"
                  >
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-bg-hover">
                      {album.coverPath ? (
                        <Image
                          src={galleryImageUrl(album.coverPath, libraryId, null, null, 120)}
                          alt={album.name}
                          fill
                          unoptimized
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <Folder className="m-auto size-5 text-text-secondary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{album.name}</p>
                      <p className="text-xs text-text-secondary">
                        {album.photoCount} photos
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Photos Section */}
          {activeData.photos.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-text-secondary uppercase dark:text-text-muted">
                Photos
              </p>
              <div className="grid grid-cols-4 gap-2 px-1">
                {activeData.photos.map((photo) => (
                  <button
                    key={photo.path}
                    type="button"
                    onClick={() => {
                      if (onSelectPhoto) onSelectPhoto(photo);
                      setFocused(false);
                    }}
                    className="group relative aspect-square overflow-hidden rounded-xl bg-bg-input focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <Image
                      src={galleryImageUrl(photo.path, libraryId, photo.modifiedAt, photo.size, 160)}
                      alt={photo.name}
                      fill
                      unoptimized
                      sizes="100px"
                      className="object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="truncate text-left text-[10px] text-white">
                        {photo.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
