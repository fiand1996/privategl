"use client";

import { ArrowDownAZ, Grid2X2 } from "lucide-react";

export type GallerySort = "name-asc" | "name-desc" | "modified-desc";
export type GridSize = "small" | "medium" | "large";

interface GridControlsProps {
  sort?: GallerySort;
  gridSize: GridSize;
  onSortChange?: (sort: GallerySort) => void;
  onGridSizeChange: (size: GridSize) => void;
}

export function GridControls({
  sort,
  gridSize,
  onSortChange,
  onGridSizeChange,
}: GridControlsProps) {
  return (
    <div className="flex items-center gap-2">
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
