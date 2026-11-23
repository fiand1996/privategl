"use client";

import { ArrowDownAZ, Check, Grid2X2, SlidersHorizontal, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

export type GallerySort = "name-asc" | "name-desc" | "modified-desc";
export type GridSize = "small" | "medium" | "large";

interface GridControlsProps {
  sort?: GallerySort;
  gridSize: GridSize;
  onSortChange?: (sort: GallerySort) => void;
  onGridSizeChange: (size: GridSize) => void;
}

const SORT_OPTIONS: Array<{ value: GallerySort; label: string }> = [
  { value: "modified-desc", label: "Latest" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
];

const GRID_OPTIONS: Array<{ value: GridSize; label: string }> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export function GridControls({
  sort,
  gridSize,
  onSortChange,
  onGridSizeChange,
}: GridControlsProps) {
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <>
      {/* Desktop Controls (hidden on small screens) */}
      <div className="hidden sm:flex items-center gap-2">
        {/* Sort selection */}
        {sort && onSortChange && (
          <label className="flex h-9 items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-card px-2.5 text-xs text-text-primary transition hover:bg-bg-hover shadow-sm">
            <ArrowDownAZ size={14} className="text-text-secondary" />
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as GallerySort)}
              className="bg-transparent font-medium outline-none cursor-pointer"
            >
              <option value="modified-desc" className="bg-bg-card text-text-primary">Latest</option>
              <option value="name-asc" className="bg-bg-card text-text-primary">Name (A–Z)</option>
              <option value="name-desc" className="bg-bg-card text-text-primary">Name (Z–A)</option>
            </select>
          </label>
        )}

        {/* Grid size selection */}
        <label className="flex h-9 items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-card px-2.5 text-xs text-text-primary transition hover:bg-bg-hover shadow-sm">
          <Grid2X2 size={14} className="text-text-secondary" />
          <select
            value={gridSize}
            onChange={(e) => onGridSizeChange(e.target.value as GridSize)}
            className="bg-transparent font-medium outline-none cursor-pointer"
          >
            <option value="small" className="bg-bg-card text-text-primary">Small</option>
            <option value="medium" className="bg-bg-card text-text-primary">Medium</option>
            <option value="large" className="bg-bg-card text-text-primary">Large</option>
          </select>
        </label>
      </div>

      {/* Mobile Compact View Button */}
      <div className="flex sm:hidden items-center">
        <button
          type="button"
          onClick={() => setMobileModalOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-full border border-border-subtle bg-bg-card px-2.5 text-xs text-text-primary transition hover:bg-bg-hover shadow-sm cursor-pointer"
          title="Display options"
          aria-label="Display options"
        >
          <SlidersHorizontal size={14} className="text-accent" />
          <span className="font-medium">View</span>
        </button>
      </div>

      {/* Mobile Display Options Bottom Sheet / Modal */}
      {mobileModalOpen && isClient && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:hidden animate-in fade-in duration-150"
          onClick={() => setMobileModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl border-t border-border-strong bg-bg-surface p-5 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-accent" />
                <h3 className="text-sm font-bold text-text-primary">Display Options</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileModalOpen(false)}
                className="flex size-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Sort Options */}
            {sort && onSortChange && (
              <div className="mt-4">
                <label className="text-xs font-semibold text-text-secondary block mb-2">
                  Sort Order
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SORT_OPTIONS.map((opt) => {
                    const active = sort === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onSortChange(opt.value)}
                        className={`flex items-center justify-center gap-1 rounded-xl py-2 px-2 text-xs font-medium transition cursor-pointer ${
                          active
                            ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                            : "border border-border-subtle bg-bg-card text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {active && <Check size={12} className="shrink-0" />}
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grid Size Options */}
            <div className="mt-4">
              <label className="text-xs font-semibold text-text-secondary block mb-2">
                Grid Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GRID_OPTIONS.map((opt) => {
                  const active = gridSize === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onGridSizeChange(opt.value)}
                      className={`flex items-center justify-center gap-1 rounded-xl py-2 px-2 text-xs font-medium transition cursor-pointer ${
                        active
                          ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                          : "border border-border-subtle bg-bg-card text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {active && <Check size={12} className="shrink-0" />}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Done Button */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setMobileModalOpen(false)}
                className="w-full rounded-2xl bg-accent py-2.5 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function getGridClasses(size: GridSize) {
  switch (size) {
    case "small":
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3";
    case "large":
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5";
    case "medium":
    default:
      return "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";
  }
}

export function getSavedGridSize(): GridSize {
  if (typeof window === "undefined") return "medium";
  try {
    const val = window.localStorage.getItem("gallery-default-grid-size");
    if (val === "small" || val === "medium" || val === "large") return val;
  } catch {
    // ignore localStorage errors
  }
  return "medium";
}

export function setSavedGridSize(size: GridSize): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("gallery-default-grid-size", size);
  } catch {
    // ignore localStorage errors
  }
}

export function getSavedSort(): GallerySort {
  if (typeof window === "undefined") return "modified-desc";
  try {
    const val = window.localStorage.getItem("gallery-default-sort");
    if (val === "modified-desc" || val === "name-asc" || val === "name-desc") return val;
  } catch {
    // ignore localStorage errors
  }
  return "modified-desc";
}

export function setSavedSort(sort: GallerySort): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("gallery-default-sort", sort);
  } catch {
    // ignore localStorage errors
  }
}
