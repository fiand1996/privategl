import { NextRequest, NextResponse } from "next/server";
import {
  getAllTags,
  addTagToPhotos,
  removeTagFromPhoto,
  getPhotoTags,
  hasDirectoryEntries,
} from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const libraryIdParam = searchParams.get("libraryId");
    const libraryId = libraryIdParam ? Number(libraryIdParam) : undefined;
    const entryPath = searchParams.get("path");

    if (entryPath && libraryId) {
      const tags = getPhotoTags(libraryId, entryPath);
      return NextResponse.json(
        { tags },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        },
      );
    }

    const tags = getAllTags(libraryId);
    return NextResponse.json(
      { tags },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load tags.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      libraryId: number;
      entryPaths: string[];
      tag: string;
    };

    if (
      !Number.isSafeInteger(body.libraryId) ||
      !Array.isArray(body.entryPaths) ||
      body.entryPaths.length === 0 ||
      !body.tag?.trim()
    ) {
      return NextResponse.json(
        { error: "Library ID, non-empty entryPaths array, and tag name are required." },
        { status: 400 },
      );
    }

    if (hasDirectoryEntries(body.libraryId, body.entryPaths)) {
      return NextResponse.json(
        { error: "Cannot add tags to directories. Please select only photos." },
        { status: 400 },
      );
    }

    const result = addTagToPhotos(body.libraryId, body.entryPaths, body.tag);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add tag.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      libraryId: number;
      entryPath: string;
      tagId: number;
    };

    if (
      !Number.isSafeInteger(body.libraryId) ||
      !body.entryPath ||
      !Number.isSafeInteger(body.tagId)
    ) {
      return NextResponse.json(
        { error: "Library ID, entryPath, and tagId are required." },
        { status: 400 },
      );
    }

    removeTagFromPhoto(body.libraryId, body.entryPath, body.tagId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove tag.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
