import { NextRequest, NextResponse } from "next/server";
import { GalleryPathError } from "@/lib/gallery";
import { getPhotoMetadata } from "@/lib/gallery-metadata";
import { getPhotoUserMetadata, hasDirectoryEntries, setPhotoUserMetadata } from "@/lib/database";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const filePath = searchParams.get("path");
  const libraryId = Number(searchParams.get("libraryId"));

  if (!filePath || !Number.isSafeInteger(libraryId) || libraryId < 1) {
    return NextResponse.json(
      { error: "Library ID and file path are required." },
      { status: 400 },
    );
  }

  try {
    const [exif, userMetadata] = await Promise.all([
      getPhotoMetadata(libraryId, filePath),
      Promise.resolve(getPhotoUserMetadata(libraryId, filePath)),
    ]);

    return NextResponse.json(
      {
        ...exif,
        userMetadata,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to load photo metadata:", error);
    return NextResponse.json(
      { error: "Failed to read photo metadata." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      libraryId: number;
      path?: string;
      entryPaths?: string[];
      isFavorite?: boolean;
      caption?: string | null;
      rating?: number;
    };

    if (!Number.isSafeInteger(body.libraryId) || body.libraryId < 1) {
      return NextResponse.json(
        { error: "Valid library ID is required." },
        { status: 400 },
      );
    }

    const pathsToCheck =
      Array.isArray(body.entryPaths) && body.entryPaths.length > 0
        ? body.entryPaths
        : body.path
          ? [body.path]
          : [];

    if (pathsToCheck.length > 0 && hasDirectoryEntries(body.libraryId, pathsToCheck)) {
      return NextResponse.json(
        { error: "Cannot modify metadata or favorite directories. Please select only photos." },
        { status: 400 },
      );
    }

    if (Array.isArray(body.entryPaths) && body.entryPaths.length > 0) {
      for (const p of body.entryPaths) {
        setPhotoUserMetadata(body.libraryId, p, {
          isFavorite: body.isFavorite,
          caption: body.caption,
          rating: body.rating,
        });
      }
      return NextResponse.json({
        success: true,
        count: body.entryPaths.length,
      });
    }

    if (!body.path) {
      return NextResponse.json(
        { error: "Valid file path or entryPaths array is required." },
        { status: 400 },
      );
    }

    const updated = setPhotoUserMetadata(body.libraryId, body.path, {
      isFavorite: body.isFavorite,
      caption: body.caption,
      rating: body.rating,
    });

    return NextResponse.json({ userMetadata: updated });
  } catch (error) {
    console.error("Failed to update photo metadata:", error);
    return NextResponse.json(
      { error: "Failed to update photo metadata." },
      { status: 500 },
    );
  }
}
