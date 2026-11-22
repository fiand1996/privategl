import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  addPeopleToPhotosBatch,
  addPersonToPhoto,
  deletePerson,
  getAllPeople,
  getPhotoPeople,
  hasDirectoryEntries,
  removePersonFromPhoto,
  setPhotoPeople,
  updatePerson,
} from "@/lib/database";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const libraryId = Number(searchParams.get("libraryId"));
  const filePath = searchParams.get("path");

  if (!Number.isSafeInteger(libraryId) || libraryId < 1) {
    return NextResponse.json(
      { error: "A valid libraryId is required." },
      { status: 400 },
    );
  }

  try {
    const allPeople = getAllPeople(libraryId);
    if (filePath) {
      const photoPeople = getPhotoPeople(libraryId, filePath);
      return NextResponse.json(
        {
          people: photoPeople,
          allPeople,
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        },
      );
    }

    return NextResponse.json(
      { people: allPeople },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (err) {
    console.error("Failed to load people:", err);
    return NextResponse.json(
      { error: "Failed to load people data." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (session.user.role === "viewer") {
      return NextResponse.json(
        { error: "Forbidden. Viewers cannot edit people metadata." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      libraryId: number;
      path?: string;
      entryPaths?: string[];
      personName?: string;
      personNames?: string[];
      personId?: number;
      action?: "add" | "remove" | "set" | "batch-add";
    };

    const {
      libraryId,
      path: filePath,
      entryPaths,
      personName,
      personNames,
      personId,
      action = "add",
    } = body;

    if (!Number.isSafeInteger(libraryId) || libraryId < 1) {
      return NextResponse.json(
        { error: "A valid libraryId is required." },
        { status: 400 },
      );
    }

    const pathsToCheck =
      Array.isArray(entryPaths) && entryPaths.length > 0
        ? entryPaths
        : filePath
          ? [filePath]
          : [];

    if (pathsToCheck.length > 0 && hasDirectoryEntries(libraryId, pathsToCheck)) {
      return NextResponse.json(
        { error: "Cannot add people to directories. Please select only photos." },
        { status: 400 },
      );
    }

    // 1. Single photo operations
    if (filePath) {
      if (action === "add" && personName) {
        const result = addPersonToPhoto(libraryId, filePath, personName);
        const updated = getPhotoPeople(libraryId, filePath);
        return NextResponse.json({ success: true, person: result.person, people: updated });
      }

      if (action === "remove" && personId) {
        removePersonFromPhoto(libraryId, filePath, personId);
        const updated = getPhotoPeople(libraryId, filePath);
        return NextResponse.json({ success: true, people: updated });
      }

      if (action === "set" && Array.isArray(personNames)) {
        const updated = setPhotoPeople(libraryId, filePath, personNames);
        return NextResponse.json({ success: true, people: updated });
      }
    }

    // 2. Batch photo operations
    if (Array.isArray(entryPaths) && entryPaths.length > 0) {
      const names = Array.isArray(personNames)
        ? personNames
        : personName
          ? [personName]
          : [];

      if (names.length === 0) {
        return NextResponse.json(
          { error: "At least one person name must be provided." },
          { status: 400 },
        );
      }

      const result = addPeopleToPhotosBatch(libraryId, entryPaths, names);
      return NextResponse.json({ success: true, affected: result.addedCount });
    }

    return NextResponse.json(
      { error: "Invalid request parameters." },
      { status: 400 },
    );
  } catch (err) {
    console.error("Failed to update people metadata:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update people." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as {
      id: number;
      name?: string;
      coverEntryPath?: string | null;
    };

    if (!Number.isSafeInteger(body.id) || body.id < 1) {
      return NextResponse.json(
        { error: "A valid person id is required." },
        { status: 400 },
      );
    }

    updatePerson(body.id, {
      name: body.name,
      coverEntryPath: body.coverEntryPath,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update person." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const id = Number(searchParams.get("id"));

    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "A valid person id is required." },
        { status: 400 },
      );
    }

    deletePerson(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete person." },
      { status: 500 },
    );
  }
}
