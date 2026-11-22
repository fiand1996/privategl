"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Compass, X } from "lucide-react";
import { useLibrary } from "@/components/layout/library-context";
import { useAppSettings } from "@/components/layout/settings-context";
import { GalleryHeader } from "@/components/layout/gallery-header";
import {
  type GallerySort,
  type GridSize,
} from "@/components/gallery/grid-controls";
import type { ExploreSummary } from "@/lib/database";
import { ExploreHubView } from "@/components/explore/explore-hub-view";
import { ExploreFilteredView } from "@/components/explore/explore-filtered-view";

export function ExplorePage() {
  const searchParams = useSearchParams();
  const { selectedLibraryId } = useLibrary();
  const { settings } = useAppSettings();

  const [gridSize, setGridSize] = useState<GridSize>(settings.defaultGridSize || "medium");
  const [sort, setSort] = useState<GallerySort>("modified-desc");
  const [notice, setNotice] = useState("");

  const collectionParam = searchParams.get("collection");
  const tagParam = searchParams.get("tag");
  const personParam = searchParams.get("person");
  const cameraParam = searchParams.get("camera");
  const yearParam = searchParams.get("year");

  const hasFilter = Boolean(
    collectionParam || tagParam || personParam || cameraParam || yearParam,
  );

  // Explore Hub Summary State
  const [summary, setSummary] = useState<ExploreSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  // Fetch Explore Summary when on Hub view
  useEffect(() => {
    if (!selectedLibraryId || hasFilter) return;

    let active = true;
    Promise.resolve().then(() => {
      if (active) setSummaryLoading(true);
    });

    fetch(`/api/explore?libraryId=${selectedLibraryId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load explore summary.");
        return res.json();
      })
      .then((data: ExploreSummary) => {
        if (active) {
          setSummary(data);
          setSummaryError("");
          setSummaryLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setSummaryError(err instanceof Error ? err.message : "Error loading data");
          setSummaryLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedLibraryId, hasFilter]);

  if (!selectedLibraryId) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center text-center">
        <Compass size={48} className="text-text-muted mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-foreground">No Media Library Selected</h2>
        <p className="mt-2 text-sm text-text-muted max-w-sm">
          Select or add a media library from Settings to start exploring.
        </p>
      </div>
    );
  }

  return (
    <div>
      <GalleryHeader />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-24 sm:px-8">
        {/* Page Title & Subtitle */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Explore
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {hasFilter
              ? "Filtered Collection View"
              : "Discover your photos by smart collections, tags, equipment, and memories."}
          </p>
        </div>

        {/* Floating Notice Bar */}
        {notice && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-400 animate-in fade-in duration-200">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              className="rounded p-1 hover:bg-emerald-500/20 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {!hasFilter ? (
          <ExploreHubView
            summary={summary}
            loading={summaryLoading}
            error={summaryError}
            libraryId={selectedLibraryId}
          />
        ) : (
          <ExploreFilteredView
            libraryId={selectedLibraryId}
            gridSize={gridSize}
            onGridSizeChange={setGridSize}
            sort={sort}
            onSortChange={setSort}
            collectionParam={collectionParam}
            tagParam={tagParam}
            personParam={personParam}
            cameraParam={cameraParam}
            yearParam={yearParam}
            onNotice={setNotice}
          />
        )}
      </div>
    </div>
  );
}
