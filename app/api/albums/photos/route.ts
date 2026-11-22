import { NextRequest, NextResponse } from "next/server";
import { getIndexedAlbumPhotos } from "@/lib/database";
import { GalleryPathError } from "@/lib/gallery";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const libraryId = Number(searchParams.get("libraryId"));
  const albumPath = searchParams.get("path") ?? "";
  const page = Number(searchParams.get("page") || 1);
  const requestedSort = searchParams.get("sort");
  const sort =
    requestedSort === "name-desc" || requestedSort === "modified-desc"
      ? requestedSort
      : "name-asc";

  if (!Number.isSafeInteger(libraryId) || libraryId < 1 || !albumPath) {
    return NextResponse.json(
      { error: "Library and album are required." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(getIndexedAlbumPhotos(libraryId, albumPath, page, sort));
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to read album photos:", error);
    return NextResponse.json(
      { error: "An error occurred while loading album photos." },
      { status: 500 },
    );
  }
}
