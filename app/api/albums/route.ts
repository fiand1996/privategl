import { NextRequest, NextResponse } from "next/server";
import {
  addPhotosToAlbum,
  createCustomAlbum,
  deleteAlbum,
  getIndexedAlbums,
  getLibrary,
  hasDirectoryEntries,
  removePhotosFromAlbum,
  renameAlbum,
} from "@/lib/database";
import { GalleryPathError } from "@/lib/gallery";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const libraryId = Number(searchParams.get("libraryId"));
  const page = Number(searchParams.get("page") || 1);
  const requestedSort = searchParams.get("sort");
  const kindFilter = searchParams.get("kind") as
    | "all"
    | "folder"
    | "custom"
    | null;
  const sort =
    requestedSort === "name-desc" || requestedSort === "modified-desc"
      ? requestedSort
      : "name-asc";

  if (!Number.isSafeInteger(libraryId) || libraryId < 1) {
    return NextResponse.json({ error: "Invalid library." }, { status: 400 });
  }

  try {
    if (!getLibrary(libraryId)) {
      return NextResponse.json(
        { error: "Library not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      getIndexedAlbums(libraryId, page, sort, kindFilter || "all"),
    );
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("Failed to read indexed albums:", error);
    return NextResponse.json(
      { error: "An error occurred while loading albums." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || "create";

    if (action === "create") {
      const { libraryId, name, description, paths } = body;
      if (!libraryId || !name) {
        return NextResponse.json(
          { error: "libraryId and name are required." },
          { status: 400 },
        );
      }
      const initialPaths = Array.isArray(paths) ? paths : [];
      if (initialPaths.length > 0 && hasDirectoryEntries(Number(libraryId), initialPaths)) {
        return NextResponse.json(
          { error: "Cannot add directories to albums. Please select only photos." },
          { status: 400 },
        );
      }
      const res = createCustomAlbum(
        Number(libraryId),
        String(name),
        description ? String(description) : undefined,
        initialPaths,
      );
      return NextResponse.json(res);
    }

    if (action === "add-photos") {
      const { albumId, libraryId, paths } = body;
      if (
        !albumId ||
        !libraryId ||
        !Array.isArray(paths) ||
        paths.length === 0
      ) {
        return NextResponse.json(
          { error: "albumId, libraryId, and paths are required." },
          { status: 400 },
        );
      }
      if (hasDirectoryEntries(Number(libraryId), paths)) {
        return NextResponse.json(
          { error: "Cannot add directories to albums. Please select only photos." },
          { status: 400 },
        );
      }
      const res = addPhotosToAlbum(Number(albumId), Number(libraryId), paths);
      return NextResponse.json(res);
    }

    if (action === "remove-photos") {
      const { albumId, paths } = body;
      if (!albumId || !Array.isArray(paths) || paths.length === 0) {
        return NextResponse.json(
          { error: "albumId and paths are required." },
          { status: 400 },
        );
      }
      const res = removePhotosFromAlbum(Number(albumId), paths);
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process album request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { albumId, name } = body;
    if (!albumId || !name) {
      return NextResponse.json(
        { error: "albumId and name are required." },
        { status: 400 },
      );
    }
    const res = renameAlbum(Number(albumId), String(name));
    return NextResponse.json(res);
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to rename album.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let albumId = Number(searchParams.get("albumId"));

    if (!albumId) {
      const body = await request.json().catch(() => ({}));
      albumId = Number(body.albumId);
    }

    if (!albumId) {
      return NextResponse.json(
        { error: "albumId is required." },
        { status: 400 },
      );
    }

    const res = deleteAlbum(albumId);
    return NextResponse.json(res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete album.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
