export function galleryImageVersion(
  modifiedAt: string | null | undefined,
  size: number | null | undefined,
) {
  if (!modifiedAt) return "";
  return `${modifiedAt}-${size ?? ""}`;
}

export function galleryImageUrl(
  filePath: string,
  libraryId: number,
  modifiedAt?: string | null,
  size?: number | null,
  width?: number,
) {
  const params = new URLSearchParams({
    path: filePath,
    libraryId: String(libraryId),
  });

  const v = galleryImageVersion(modifiedAt, size);
  if (v) {
    params.set("v", v);
  }

  if (width && Number.isFinite(width) && width > 0) {
    params.set("w", String(Math.round(width)));
  }

  return `/api/gallery/image?${params}`;
}
