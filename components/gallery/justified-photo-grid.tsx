"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhotoCard } from "./photo-card";
import { type GalleryPhoto } from "./lightbox-modal";
import { type GridSize } from "./grid-controls";

interface JustifiedPhotoGridProps {
  photos: GalleryPhoto[];
  libraryId: number;
  gridSize?: GridSize;
  selectable?: boolean;
  selectedPaths?: Set<string>;
  onToggleSelect?: (path: string) => void;
  onToggleFavorite?: (photo: GalleryPhoto, isFav: boolean) => void;
  onSelect: (photo: GalleryPhoto) => void;
  onContextMenu?: (e: React.MouseEvent, photo: GalleryPhoto) => void;
}

interface LayoutItem {
  photo: GalleryPhoto;
  aspectRatio: number;
  width: number;
  height: number;
}

interface LayoutRow {
  items: LayoutItem[];
  height: number;
}

function getGridRowConfig(size: GridSize) {
  switch (size) {
    case "small":
      return { targetRowHeight: 195, gap: 10 };
    case "large":
      return { targetRowHeight: 390, gap: 18 };
    case "medium":
    default:
      return { targetRowHeight: 288, gap: 14 };
  }
}

export function JustifiedPhotoGrid({
  photos,
  libraryId,
  gridSize = "medium",
  selectable = false,
  selectedPaths,
  onToggleSelect,
  onToggleFavorite,
  onSelect,
  onContextMenu,
}: JustifiedPhotoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Measure container width responsively
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) {
        setContainerWidth(Math.floor(width));
      }
    };

    updateWidth();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(Math.floor(width));
        }
      }
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  const { targetRowHeight, gap } = getGridRowConfig(gridSize);

  const [measuredAspectRatios, setMeasuredAspectRatios] = useState<
    Record<string, number>
  >({});

  const handleMeasureAspectRatio = useCallback(
    (path: string, naturalAr: number) => {
      if (!naturalAr || naturalAr <= 0 || !Number.isFinite(naturalAr)) return;
      setMeasuredAspectRatios((prev) => {
        const existing = prev[path];
        if (existing && Math.abs(existing - naturalAr) < 0.03) {
          return prev;
        }
        return { ...prev, [path]: naturalAr };
      });
    },
    [],
  );

  // Compute horizontal justified layout rows
  const rows: LayoutRow[] = useMemo(() => {
    if (!photos || photos.length === 0 || containerWidth <= 0) return [];

    const computedRows: LayoutRow[] = [];
    let currentRow: { photo: GalleryPhoto; ar: number }[] = [];
    let currentSumAr = 0;

    for (const photo of photos) {
      // Calculate aspect ratio (width / height)
      let ar = 1.5; // Standard 3:2 landscape fallback
      const measured = measuredAspectRatios[photo.path];
      if (measured) {
        ar = measured;
      } else if (photo.width && photo.height && photo.height > 0) {
        ar = photo.width / photo.height;
      }
      // Clamp aspect ratio between 0.5 (tall portrait) and 3.0 (wide landscape/panorama)
      ar = Math.max(0.5, Math.min(3.0, ar));

      currentRow.push({ photo, ar });
      currentSumAr += ar;

      const totalGaps = (currentRow.length - 1) * gap;
      const availableWidth = containerWidth - totalGaps;
      const calculatedHeight = availableWidth / currentSumAr;

      // Break row when calculated height reaches target height threshold
      // or if row has enough items for the width
      if (calculatedHeight <= targetRowHeight * 1.15) {
        const rowHeight = Math.round(calculatedHeight);
        let allocatedWidth = 0;

        const rowItems: LayoutItem[] = currentRow.map((item, idx) => {
          let itemWidth: number;
          if (idx === currentRow.length - 1) {
            // Last item absorbs any sub-pixel rounding error to guarantee exact width
            itemWidth = Math.max(50, availableWidth - allocatedWidth);
          } else {
            itemWidth = Math.round(rowHeight * item.ar);
            allocatedWidth += itemWidth;
          }

          return {
            photo: item.photo,
            aspectRatio: item.ar,
            width: itemWidth,
            height: rowHeight,
          };
        });

        computedRows.push({ items: rowItems, height: rowHeight });
        currentRow = [];
        currentSumAr = 0;
      }
    }

    // Handle last leftover row
    if (currentRow.length > 0) {
      const totalGaps = (currentRow.length - 1) * gap;
      const availableWidth = containerWidth - totalGaps;
      const calculatedHeight = availableWidth / currentSumAr;

      // If almost full, justify it
      if (calculatedHeight <= targetRowHeight * 1.35) {
        const rowHeight = Math.round(calculatedHeight);
        let allocatedWidth = 0;

        const rowItems: LayoutItem[] = currentRow.map((item, idx) => {
          let itemWidth: number;
          if (idx === currentRow.length - 1) {
            itemWidth = Math.max(50, availableWidth - allocatedWidth);
          } else {
            itemWidth = Math.round(rowHeight * item.ar);
            allocatedWidth += itemWidth;
          }

          return {
            photo: item.photo,
            aspectRatio: item.ar,
            width: itemWidth,
            height: rowHeight,
          };
        });

        computedRows.push({ items: rowItems, height: rowHeight });
      } else {
        // Partial row: align to targetRowHeight and left-align
        const rowHeight = targetRowHeight;
        const rowItems: LayoutItem[] = currentRow.map((item) => ({
          photo: item.photo,
          aspectRatio: item.ar,
          width: Math.round(rowHeight * item.ar),
          height: rowHeight,
        }));

        computedRows.push({ items: rowItems, height: rowHeight });
      }
    }

    return computedRows;
  }, [photos, containerWidth, targetRowHeight, gap, measuredAspectRatios]);

  return (
    <div ref={containerRef} className="w-full">
      {rows.map((row, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="flex w-full"
          style={{ gap: `${gap}px`, marginBottom: `${gap}px` }}
        >
          {row.items.map(({ photo, width, height }, photoIndex) => (
            <PhotoCard
              key={photo.path}
              photo={photo}
              libraryId={libraryId}
              aspectRatio="justified"
              width={width}
              height={height}
              eager={rowIndex === 0 && photoIndex < 6}
              selectable={selectable}
              selected={selectedPaths?.has(photo.path)}
              onToggleSelect={() => onToggleSelect?.(photo.path)}
              onToggleFavorite={onToggleFavorite}
              onSelect={onSelect}
              onContextMenu={(e) => onContextMenu?.(e, photo)}
              onMeasureAspectRatio={handleMeasureAspectRatio}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
