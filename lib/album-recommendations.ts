export function recordAlbumOpen(libraryId: number, albumPath: string) {
  if (typeof window === "undefined") return;
  const key = `${libraryId}:${albumPath}`;
  let counts: Record<string, number>;
  try {
    counts = JSON.parse(
      window.localStorage.getItem("gallery-album-opens") || "{}",
    ) as Record<string, number>;
  } catch (error) {
    console.warn("Could not read album recommendation history:", error);
    counts = {};
  }
  counts[key] = (counts[key] ?? 0) + 1;
  window.localStorage.setItem("gallery-album-opens", JSON.stringify(counts));
}
