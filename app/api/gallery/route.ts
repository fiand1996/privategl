import { NextRequest, NextResponse } from "next/server";
import {
  getIndexedGalleryContents,
  getLibrary,
} from "@/lib/database";
import { GalleryPathError } from "@/lib/gallery";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const libraryId = Number(searchParams.get("libraryId"));
  const subPath = searchParams.get("path") || "";
  const page = Number(searchParams.get("page") || 1);
  const search = searchParams.get("q") || "";
  const requestedSort = searchParams.get("sort");
  const sort =
    requestedSort === "name-desc" || requestedSort === "modified-desc"
      ? requestedSort
      : "name-asc";

  if (!Number.isSafeInteger(libraryId) || libraryId < 1) {
    return NextResponse.json({ error: "Invalid library." }, { status: 400 });
  }

  try {
    const library = getLibrary(libraryId);
    if (!library) {
      return NextResponse.json({ error: "Library not found." }, { status: 404 });
    }

    return NextResponse.json(
      getIndexedGalleryContents(libraryId, subPath, page, search, sort),
    );
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to read indexed gallery:", error);
    return NextResponse.json(
      { error: "An error occurred while loading folder contents." },
      { status: 500 },
    );
  }
}
