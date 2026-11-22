import { NextRequest, NextResponse } from "next/server";
import { getGalleryFolders, createGalleryFolder } from "@/lib/gallery-actions";
import { GalleryPathError } from "@/lib/gallery";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const libraryId = Number(searchParams.get("libraryId"));

  if (!Number.isSafeInteger(libraryId) || libraryId < 1) {
    return NextResponse.json({ error: "Invalid library ID." }, { status: 400 });
  }

  try {
    const folders = getGalleryFolders(libraryId);
    return NextResponse.json({ folders });
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("Failed to load folders:", error);
    return NextResponse.json(
      { error: "Failed to load folders." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      libraryId?: number;
      parentFolder?: string;
      folderName?: string;
    };

    const { libraryId, parentFolder = "", folderName } = body;

    if (!libraryId || !Number.isSafeInteger(libraryId) || libraryId < 1) {
      return NextResponse.json(
        { error: "Invalid library ID." },
        { status: 400 },
      );
    }

    if (!folderName || typeof folderName !== "string" || !folderName.trim()) {
      return NextResponse.json(
        { error: "Folder name is required." },
        { status: 400 },
      );
    }

    const result = createGalleryFolder(libraryId, parentFolder, folderName);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("Create folder error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred creating the folder.",
      },
      { status: 500 },
    );
  }
}
