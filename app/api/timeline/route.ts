import { NextRequest, NextResponse } from "next/server";
import { getIndexedTimelinePage, getLibrary } from "@/lib/database";
import { GalleryPathError } from "@/lib/gallery";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const libraryId = Number(searchParams.get("libraryId"));
  const page = Number(searchParams.get("page") || 1);
  const search = searchParams.get("q") || "";

  if (!Number.isSafeInteger(libraryId) || libraryId < 1) {
    return NextResponse.json({ error: "Invalid library." }, { status: 400 });
  }

  try {
    if (!getLibrary(libraryId)) {
      return NextResponse.json({ error: "Library not found." }, { status: 404 });
    }
    return NextResponse.json(getIndexedTimelinePage(libraryId, page, search));
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to read indexed timeline:", error);
    return NextResponse.json(
      { error: "An error occurred while loading the timeline." },
      { status: 500 },
    );
  }
}
