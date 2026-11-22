import { connection } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import {
  createLibrary,
  deleteLibrary,
  enqueueScan,
  findLibraryByRoot,
  updateLibrary,
} from "@/lib/database";
import {
  ensureDefaultLibrary,
  validateLibraryRoot,
} from "@/lib/library-service";
import { triggerScanQueue } from "@/lib/scan-runner";

export async function GET() {
  await connection();
  try {
    const libraries = ensureDefaultLibrary().map((library) => ({
      id: library.id,
      name: library.name,
      rootPath: library.rootPath,
      createdAt: library.createdAt,
      lastScanAt: library.lastScanAt,
      imageCount: library.imageCount,
      folderCount: library.folderCount,
      totalSizeBytes: library.totalSizeBytes,
      activeTask: library.activeTask,
      isDefault: library.isDefault,
    }));
    return NextResponse.json({ libraries });
  } catch (error) {
    console.error("Failed to load photo libraries:", error);
    return NextResponse.json(
      { error: "Libraries could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: unknown; rootPath?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const requestedPath =
      typeof body.rootPath === "string" ? body.rootPath.trim() : "";

    if (!name || name.length > 100) {
      return NextResponse.json(
        { error: "Library name must be between 1 and 100 characters." },
        { status: 400 },
      );
    }

    let rootPath: string;
    try {
      rootPath = validateLibraryRoot(requestedPath);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid library path." },
        { status: 400 },
      );
    }

    if (findLibraryByRoot(rootPath)) {
      return NextResponse.json(
        { error: "That folder is already registered as a library." },
        { status: 409 },
      );
    }

    const id = createLibrary(name, rootPath);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Failed to create photo library:", error);
    return NextResponse.json(
      { error: "Library could not be created." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: unknown;
      name?: unknown;
      rootPath?: unknown;
    };
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json({ error: "Invalid library ID." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const rootPath =
      typeof body.rootPath === "string" && body.rootPath.trim()
        ? body.rootPath.trim()
        : undefined;

    const result = updateLibrary(id, name, rootPath);
    if (result.pathChanged) {
      enqueueScan(id);
      triggerScanQueue();
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update library.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const idParam = searchParams.get("id");
    const id = idParam ? Number(idParam) : null;
    if (!id || !Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "Valid library ID is required." },
        { status: 400 },
      );
    }

    deleteLibrary(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete library.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
