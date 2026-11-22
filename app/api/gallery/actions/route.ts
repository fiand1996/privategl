import { NextRequest, NextResponse } from "next/server";
import {
  deleteGalleryItems,
  moveGalleryItems,
  copyGalleryItems,
  renameGalleryItem,
} from "@/lib/gallery-actions";
import { GalleryPathError } from "@/lib/gallery";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      libraryId?: number;
      action?: "delete" | "move" | "copy" | "rename";
      path?: string;
      paths?: string[];
      destinationFolder?: string;
      newName?: string;
    };

    const { libraryId, action, path, paths, destinationFolder = "", newName } = body;

    if (!libraryId || !Number.isSafeInteger(libraryId) || libraryId < 1) {
      return NextResponse.json({ error: "Invalid library ID." }, { status: 400 });
    }

    if (action === "rename") {
      const targetPath = path || (Array.isArray(paths) && paths[0]) || "";
      if (!targetPath) {
        return NextResponse.json(
          { error: "No target item specified to rename." },
          { status: 400 },
        );
      }
      if (!newName || typeof newName !== "string" || !newName.trim()) {
        return NextResponse.json(
          { error: "A valid new name is required." },
          { status: 400 },
        );
      }
      const result = renameGalleryItem(libraryId, targetPath, newName);
      return NextResponse.json(result);
    }

    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { error: "No items selected." },
        { status: 400 },
      );
    }

    if (action === "delete") {
      const result = deleteGalleryItems(libraryId, paths);
      return NextResponse.json(result);
    }

    if (action === "move") {
      const result = moveGalleryItems(libraryId, paths, destinationFolder);
      return NextResponse.json(result);
    }

    if (action === "copy") {
      const result = copyGalleryItems(libraryId, paths, destinationFolder);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Invalid action. Supported: delete, move, copy, rename" },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Gallery action error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred performing the action.",
      },
      { status: 500 },
    );
  }
}
