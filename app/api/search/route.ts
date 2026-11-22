import { NextRequest, NextResponse } from "next/server";
import { searchIndexedLibrary } from "@/lib/database";
import { GalleryPathError } from "@/lib/gallery";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const libraryId = Number(searchParams.get("libraryId"));
  const query = (searchParams.get("q") ?? "").trim();

  if (!Number.isSafeInteger(libraryId) || libraryId < 1) {
    return NextResponse.json({ error: "Invalid library." }, { status: 400 });
  }
  if (query.length > 200) {
    return NextResponse.json({ error: "Search query is too long." }, { status: 400 });
  }

  try {
    return NextResponse.json(searchIndexedLibrary(libraryId, query));
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to search indexed library:", error);
    return NextResponse.json(
      { error: "Search could not be performed." },
      { status: 500 },
    );
  }
}
