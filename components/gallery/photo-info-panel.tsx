"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import {
  Aperture,
  Calendar,
  Camera,
  Check,
  ExternalLink,
  HardDrive,
  Heart,
  Info,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Star,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";
import type { FormattedPhotoMetadata } from "@/lib/gallery-metadata";
import type { GalleryPhoto } from "./lightbox-modal";

interface PhotoInfoPanelProps {
  libraryId: number;
  photo: GalleryPhoto;
  onClose: () => void;
  onFavoriteChange?: (isFav: boolean) => void;
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let unitIndex = -1;
  let current = bytes;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex++;
  }
  return `${current.toFixed(1)} ${units[unitIndex]}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return null;
  }
}

export function PhotoInfoPanel({
  libraryId,
  photo,
  onClose,
  onFavoriteChange,
}: PhotoInfoPanelProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [metadata, setMetadata] = useState<FormattedPhotoMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User metadata state
  const [isFavorite, setIsFavorite] = useState(false);
  const [caption, setCaption] = useState("");
  const [initialCaption, setInitialCaption] = useState("");
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [allSuggestions, setAllSuggestions] = useState<{ id: number; name: string }[]>([]);
  const [people, setPeople] = useState<{ id: number; name: string }[]>([]);
  const [personInput, setPersonInput] = useState("");
  const [allPersonSuggestions, setAllPersonSuggestions] = useState<{ id: number; name: string }[]>([]);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(
      `/api/gallery/metadata?${new URLSearchParams({
        libraryId: String(libraryId),
        path: photo.path,
      })}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load metadata.");
        }
        return res.json();
      })
      .then((data: FormattedPhotoMetadata) => {
        setMetadata(data);
        if (data.userMetadata) {
          setIsFavorite(data.userMetadata.isFavorite);
          const currentCaption = data.userMetadata.caption ?? "";
          setCaption(currentCaption);
          setInitialCaption(currentCaption);
          setRating(data.userMetadata.rating ?? 0);
          setTags(data.userMetadata.tags ?? []);
          setPeople(data.userMetadata.people ?? []);
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load metadata.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    // Also fetch all available tags for autocomplete suggestions
    fetch(`/api/gallery/tags?libraryId=${libraryId}`, { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { tags?: { id: number; name: string }[] }) => {
        setAllSuggestions(data.tags ?? []);
      })
      .catch(() => {
        // ignore suggestions error
      });

    // Fetch all available people for autocomplete suggestions
    fetch(`/api/gallery/people?libraryId=${libraryId}`, { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { people?: { id: number; name: string }[] }) => {
        setAllPersonSuggestions(data.people ?? []);
      })
      .catch(() => {
        // ignore suggestions error
      });

    return () => controller.abort();
  }, [libraryId, photo.path]);

  async function handleToggleFavorite() {
    const nextFav = !isFavorite;
    setIsFavorite(nextFav);
    onFavoriteChange?.(nextFav);

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
      // rollback on error
      setIsFavorite(!nextFav);
      onFavoriteChange?.(!nextFav);
    }
  }

  async function handleRatingChange(newRating: number) {
    const finalRating = rating === newRating ? 0 : newRating;
    setRating(finalRating);

    try {
      await fetch("/api/gallery/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          path: photo.path,
          rating: finalRating,
        }),
      });
    } catch {
      setRating(rating);
    }
  }

  async function handleSaveCaption() {
    if (caption === initialCaption) return;
    setSavingMeta(true);
    try {
      const trimmed = caption.trim();
      const res = await fetch("/api/gallery/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          path: photo.path,
          caption: trimmed || null,
        }),
      });
      if (res.ok) {
        setInitialCaption(caption);
        setSavedNotice("Saved");
        setTimeout(() => setSavedNotice(""), 2000);
      }
    } catch {
      // ignore
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleAddTag(e?: FormEvent, customTag?: string) {
    if (e) e.preventDefault();
    const raw = customTag || tagInput;
    const clean = raw.trim().replace(/^#+/, "");
    if (!clean) return;

    // Check if tag already attached
    if (tags.some((t) => t.name.toLowerCase() === clean.toLowerCase())) {
      setTagInput("");
      return;
    }

    try {
      const response = await fetch("/api/gallery/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          entryPaths: [photo.path],
          tag: clean,
        }),
      });
      const data = (await response.json()) as { tag?: { id: number; name: string } };
      if (data.tag) {
        setTags((prev) => [...prev, data.tag!]);
        // Also add to autocomplete suggestions if new
        setAllSuggestions((prev) =>
          prev.some((s) => s.id === data.tag!.id) ? prev : [...prev, data.tag!],
        );
      }
      setTagInput("");
    } catch {
      // ignore
    }
  }

  async function handleRemoveTag(tagId: number) {
    setTags((prev) => prev.filter((t) => t.id !== tagId));

    try {
      await fetch("/api/gallery/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          entryPath: photo.path,
          tagId,
        }),
      });
    } catch {
      // ignore rollback for simplicity
    }
  }

  async function handleAddPerson(e?: FormEvent, customName?: string) {
    if (e) e.preventDefault();
    const raw = customName || personInput;
    const clean = raw.trim();
    if (!clean) return;

    if (people.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
      setPersonInput("");
      return;
    }

    try {
      const response = await fetch("/api/gallery/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          path: photo.path,
          personName: clean,
          action: "add",
        }),
      });
      const data = (await response.json()) as {
        person?: { id: number; name: string };
        people?: { id: number; name: string }[];
      };
      if (data.people) {
        setPeople(data.people);
      } else if (data.person) {
        setPeople((prev) => [...prev, data.person!]);
      }
      if (data.person) {
        setAllPersonSuggestions((prev) =>
          prev.some((s) => s.id === data.person!.id) ? prev : [...prev, data.person!],
        );
      }
      setPersonInput("");
    } catch {
      // ignore
    }
  }

  async function handleRemovePerson(personId: number) {
    setPeople((prev) => prev.filter((p) => p.id !== personId));

    try {
      await fetch("/api/gallery/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          path: photo.path,
          personId,
          action: "remove",
        }),
      });
    } catch {
      // ignore rollback
    }
  }

  const hasCameraData =
    metadata &&
    Boolean(
      metadata.cameraModel ||
        metadata.lensModel ||
        metadata.aperture ||
        metadata.shutterSpeed ||
        metadata.focalLength ||
        metadata.iso,
    );

  const hasGpsData =
    metadata &&
    metadata.latitude !== null &&
    metadata.longitude !== null;

  const displayDate =
    metadata?.capturedAt || photo.modifiedAt || metadata?.modifiedAt;

  // Unselected suggestions
  const unusedSuggestions = allSuggestions
    .filter((s) => !tags.some((t) => t.name.toLowerCase() === s.name.toLowerCase()))
    .slice(0, 5);

  const unusedPersonSuggestions = allPersonSuggestions
    .filter((s) => !people.some((p) => p.name.toLowerCase() === s.name.toLowerCase()))
    .slice(0, 5);

  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-96 max-w-[90vw] flex-col border-l border-border-subtle bg-bg-card/95 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle px-5">
        <div className="flex items-center gap-2 text-text-primary font-semibold text-sm">
          <Info size={16} className="text-accent" />
          <span>Info & Details</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close details (Esc / I)"
          className="rounded-full p-1.5 text-text-secondary transition hover:bg-bg-hover hover:text-text-primary cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content scroll area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-text-primary scrollbar-thin">
        {loading && !metadata && (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-accent" />
          </div>
        )}

        {error && !metadata && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-400">
            {error}
          </div>
        )}

        {/* Favorite & Rating Quick Bar */}
        <section className="flex items-center justify-between rounded-2xl border border-border-subtle bg-bg-hover/80 p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={handleToggleFavorite}
              title={
                !isAdmin
                  ? "Read-only access"
                  : isFavorite
                  ? "Remove from Favorites"
                  : "Add to Favorites"
              }
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition ${
                !isAdmin ? "cursor-default opacity-80" : "cursor-pointer"
              } ${
                isFavorite
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  : "bg-border-subtle text-text-secondary hover:text-text-primary"
              }`}
            >
              <Heart
                size={14}
                className={isFavorite ? "fill-rose-500 text-rose-500" : ""}
              />
              <span>{isFavorite ? "Favorited" : "Favorite"}</span>
            </button>
          </div>

          {/* Star Rating */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((starVal) => (
              <button
                key={starVal}
                type="button"
                disabled={!isAdmin}
                onClick={() => handleRatingChange(starVal)}
                title={!isAdmin ? `${rating} Stars` : `Rate ${starVal} Star${starVal > 1 ? "s" : ""}`}
                className={`p-1 transition ${
                  !isAdmin
                    ? "cursor-default"
                    : "text-text-muted hover:text-amber-400 cursor-pointer"
                }`}
              >
                <Star
                  size={15}
                  className={
                    starVal <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-text-muted hover:text-text-secondary"
                  }
                />
              </button>
            ))}
          </div>
        </section>

        {/* User Notes / Caption Section */}
        <section className="rounded-2xl border border-border-subtle bg-bg-hover/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Notes / Caption
            </span>
            <div className="flex items-center gap-2">
              {savedNotice ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <Check size={12} />
                  {savedNotice}
                </span>
              ) : savingMeta ? (
                <Loader2 size={12} className="animate-spin text-text-secondary" />
              ) : null}
              {isAdmin && caption !== initialCaption && (
                <button
                  type="button"
                  disabled={savingMeta}
                  onClick={handleSaveCaption}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground hover:bg-accent-hover transition cursor-pointer"
                >
                  Save
                </button>
              )}
            </div>
          </div>
          <textarea
            rows={2}
            value={caption}
            disabled={!isAdmin}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={isAdmin ? handleSaveCaption : undefined}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (isAdmin) handleSaveCaption();
              }
            }}
            placeholder={
              isAdmin
                ? "Add a description or note about this photo... (Ctrl+Enter to save)"
                : "No description provided."
            }
            className={`w-full resize-none rounded-xl border border-border-strong bg-bg-input p-2.5 text-xs text-text-primary placeholder:text-text-muted outline-none transition ${
              isAdmin
                ? "focus:border-accent focus:ring-1 focus:ring-accent-border"
                : "opacity-80 cursor-default"
            }`}
          />
        </section>

        {/* Interactive Tags Section */}
        <section className="rounded-2xl border border-border-subtle bg-bg-hover/60 p-3.5 space-y-3">
          <div className="flex items-center gap-2 text-text-primary font-semibold text-xs border-b border-border-subtle pb-2">
            <Tag size={15} className="text-accent" />
            <span>Tags & Labels</span>
          </div>

          {/* Current tags chips */}
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-muted border border-accent-border px-2.5 py-1 text-xs font-medium text-accent"
              >
                <span>#{t.name}</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t.id)}
                    title={`Remove #${t.name}`}
                    className="rounded hover:bg-accent-border p-0.5 text-accent hover:text-text-primary cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
            {tags.length === 0 && (
              <span className="text-xs text-text-muted italic">No tags added yet.</span>
            )}
          </div>

          {/* Add Tag Form (Admin Only) */}
          {isAdmin && (
            <form onSubmit={handleAddTag} className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                  #
                </span>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add a tag..."
                  className="h-8 w-full rounded-xl border border-border-strong bg-bg-input pl-6 pr-2.5 text-xs text-text-primary placeholder:text-text-muted outline-none transition focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={!tagInput.trim()}
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-accent-muted border border-accent-border px-3 text-xs font-semibold text-accent hover:bg-accent-border transition cursor-pointer disabled:opacity-40"
              >
                <Plus size={13} />
                Add
              </button>
            </form>
          )}

          {/* Quick Suggestions (Admin Only) */}
          {isAdmin && unusedSuggestions.length > 0 && (
            <div className="pt-1">
              <span className="block text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
                Suggested
              </span>
              <div className="flex flex-wrap gap-1">
                {unusedSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleAddTag(undefined, s.name)}
                    className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-bg-input px-2 py-0.5 text-[11px] text-text-secondary hover:text-accent hover:border-accent-border transition cursor-pointer"
                  >
                    <span>+{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Interactive People Section */}
        <section className="rounded-2xl border border-border-subtle bg-bg-hover/60 p-3.5 space-y-3">
          <div className="flex items-center gap-2 text-text-primary font-semibold text-xs border-b border-border-subtle pb-2">
            <Users size={15} className="text-accent" />
            <span>People in Photo</span>
          </div>

          {/* Current people chips */}
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400"
              >
                <User size={11} />
                <span>{p.name}</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleRemovePerson(p.id)}
                    title={`Remove ${p.name}`}
                    className="rounded hover:bg-emerald-500/20 p-0.5 text-emerald-400 hover:text-text-primary cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
            {people.length === 0 && (
              <span className="text-xs text-text-muted italic">No people tagged yet.</span>
            )}
          </div>

          {/* Add Person Form (Admin Only) */}
          {isAdmin && (
            <form onSubmit={handleAddPerson} className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={personInput}
                  onChange={(e) => setPersonInput(e.target.value)}
                  placeholder="Add person name..."
                  className="h-8 w-full rounded-xl border border-border-strong bg-bg-input pl-7 pr-2.5 text-xs text-text-primary placeholder:text-text-muted outline-none transition focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={!personInput.trim()}
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-accent-muted border border-accent-border px-3 text-xs font-semibold text-accent hover:bg-accent-border transition cursor-pointer disabled:opacity-40"
              >
                <Plus size={13} />
                Add
              </button>
            </form>
          )}

          {/* Quick Suggestions (Admin Only) */}
          {isAdmin && unusedPersonSuggestions.length > 0 && (
            <div className="pt-1">
              <span className="block text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
                Suggested
              </span>
              <div className="flex flex-wrap gap-1">
                {unusedPersonSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleAddPerson(undefined, s.name)}
                    className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-bg-input px-2 py-0.5 text-[11px] text-text-secondary hover:text-emerald-300 hover:border-emerald-500/40 transition cursor-pointer"
                  >
                    <span>+{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Basic File Details */}
        <section className="space-y-3">
          <div>
            <span className="block text-[11px] font-medium text-text-muted uppercase tracking-wider">
              File Name
            </span>
            <span className="mt-0.5 block break-all font-mono text-xs text-text-primary">
              {photo.name}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-medium text-text-muted uppercase tracking-wider">
              Folder Path
            </span>
            <span className="mt-0.5 block break-all font-mono text-[11px] text-text-secondary">
              {photo.path}
            </span>
          </div>

          {displayDate && (
            <div className="flex items-start gap-2.5 pt-1">
              <Calendar size={15} className="mt-0.5 text-text-secondary shrink-0" />
              <div>
                <span className="text-text-primary font-medium block">
                  {formatDateTime(displayDate)}
                </span>
                <span className="text-[10px] text-text-muted">
                  {metadata?.capturedAt ? "Date Captured (EXIF)" : "Date Modified"}
                </span>
              </div>
            </div>
          )}

          {/* Dimension & File Specs */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="rounded-xl bg-bg-input p-2.5 border border-border-subtle">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Layers size={13} />
                <span className="text-[10px] font-medium uppercase">Resolution</span>
              </div>
              <p className="mt-1 font-semibold text-text-primary">
                {metadata?.width && metadata?.height
                  ? `${metadata.width} × ${metadata.height}`
                  : "-"}
              </p>
              {metadata?.megapixels && (
                <p className="text-[10px] text-text-secondary">
                  {metadata.megapixels} {metadata.aspectRatio ? `· ${metadata.aspectRatio}` : ""}
                </p>
              )}
            </div>

            <div className="rounded-xl bg-bg-input p-2.5 border border-border-subtle">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <HardDrive size={13} />
                <span className="text-[10px] font-medium uppercase">Size & Format</span>
              </div>
              <p className="mt-1 font-semibold text-text-primary">
                {formatBytes(metadata?.fileSizeBytes ?? photo.size)}
              </p>
              <p className="text-[10px] text-text-secondary uppercase">
                {metadata?.mimeType ? metadata.mimeType.replace("image/", "") : "Image"}
                {metadata?.colorSpace ? ` · ${metadata.colorSpace}` : ""}
              </p>
            </div>
          </div>
        </section>

        {/* Camera & Lens Section */}
        {hasCameraData && (
          <section className="rounded-2xl border border-border-subtle bg-bg-hover/60 p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-text-primary font-semibold text-xs border-b border-border-subtle pb-2">
              <Camera size={15} className="text-accent" />
              <span>Camera & Lens</span>
            </div>

            {/* Camera Model */}
            {metadata.cameraModel && (
              <div>
                <p className="text-text-primary font-medium">
                  {metadata.cameraMake ? `${metadata.cameraMake} ` : ""}
                  {metadata.cameraModel}
                </p>
                <p className="text-[10px] text-text-muted">Camera Body</p>
              </div>
            )}

            {/* Lens Model */}
            {metadata.lensModel && (
              <div className="flex items-start gap-2 pt-1">
                <Aperture size={14} className="mt-0.5 text-text-secondary shrink-0" />
                <div>
                  <p className="text-text-primary font-medium">{metadata.lensModel}</p>
                  <p className="text-[10px] text-text-muted">Lens</p>
                </div>
              </div>
            )}

            {/* Exposure Settings Grid */}
            <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono">
              <div className="rounded-lg bg-bg-card p-2 border border-border-subtle">
                <span className="text-[10px] text-text-muted block">Focal</span>
                <span className="text-xs text-text-primary font-semibold mt-0.5 block">
                  {metadata.focalLength || "-"}
                </span>
              </div>
              <div className="rounded-lg bg-bg-card p-2 border border-border-subtle">
                <span className="text-[10px] text-text-muted block">Aperture</span>
                <span className="text-xs text-text-primary font-semibold mt-0.5 block">
                  {metadata.aperture || "-"}
                </span>
              </div>
              <div className="rounded-lg bg-bg-card p-2 border border-border-subtle">
                <span className="text-[10px] text-text-muted block">Shutter</span>
                <span className="text-xs text-text-primary font-semibold mt-0.5 block truncate">
                  {metadata.shutterSpeed || "-"}
                </span>
              </div>
              <div className="rounded-lg bg-bg-card p-2 border border-border-subtle">
                <span className="text-[10px] text-text-muted block">ISO</span>
                <span className="text-xs text-text-primary font-semibold mt-0.5 block">
                  {metadata.iso ? `${metadata.iso}` : "-"}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* GPS Location Section */}
        {hasGpsData && (
          <section className="rounded-2xl border border-border-subtle bg-bg-hover/60 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-text-primary font-semibold text-xs border-b border-border-subtle pb-2">
              <MapPin size={15} className="text-rose-400" />
              <span>Location (GPS)</span>
            </div>

            <p className="font-mono text-xs text-text-secondary">
              {metadata.latitude?.toFixed(5)}°, {metadata.longitude?.toFixed(5)}°
              {metadata.altitude ? ` · ${metadata.altitude.toFixed(0)}m` : ""}
            </p>

            <div className="flex gap-2 pt-1">
              {metadata.googleMapsUrl && (
                <a
                  href={metadata.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-bg-input px-3 py-1.5 text-xs text-text-secondary hover:bg-border-subtle hover:text-text-primary transition"
                >
                  <span>Google Maps</span>
                  <ExternalLink size={12} />
                </a>
              )}
              {metadata.openStreetMapUrl && (
                <a
                  href={metadata.openStreetMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-bg-input px-3 py-1.5 text-xs text-text-secondary hover:bg-border-subtle hover:text-text-primary transition"
                >
                  <span>OpenStreetMap</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
