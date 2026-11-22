import { NextRequest, NextResponse } from "next/server";
import { getExplorePhotos, getExploreSummary } from "@/lib/database";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const libraryId = Number(searchParams.get("libraryId"));

  if (!Number.isSafeInteger(libraryId) || libraryId < 1) {
    return NextResponse.json(
      { error: "A valid libraryId is required." },
      { status: 400 },
    );
  }

  const collection = searchParams.get("collection") as
    | "favorites"
    | "top-rated"
    | "places"
    | null;
  const tag = searchParams.get("tag");
  const person = searchParams.get("person");
  const camera = searchParams.get("camera");
  const year = searchParams.get("year");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.max(
    1,
    Math.min(100, Number(searchParams.get("pageSize")) || 48),
  );

  try {
    const hasFilter = Boolean(collection || tag || person || camera || year);

    if (hasFilter) {
      const result = getExplorePhotos(
        libraryId,
        {
          collection: collection || undefined,
          tag: tag || undefined,
          person: person || undefined,
          camera: camera || undefined,
          year: year || undefined,
        },
        page,
        pageSize,
      );

      return NextResponse.json(result);
    }

    const summary = getExploreSummary(libraryId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load explore data:", error);
    return NextResponse.json(
      { error: "Failed to load explore data." },
      { status: 500 },
    );
  }
}
