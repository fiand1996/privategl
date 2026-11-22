import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { processUploadBatch, type UploadItem } from "@/lib/gallery-upload";
import { GalleryPathError } from "@/lib/gallery";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session.user.role === "viewer") {
      return NextResponse.json(
        { error: "Forbidden. Viewer accounts have read-only access." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const libraryIdStr = formData.get("libraryId");
    if (!libraryIdStr) {
      return NextResponse.json(
        { error: "libraryId is required." },
        { status: 400 },
      );
    }

    const libraryId = Number(libraryIdStr);
    if (!Number.isSafeInteger(libraryId) || libraryId < 1) {
      return NextResponse.json(
        { error: "Invalid library ID." },
        { status: 400 },
      );
    }

    const targetFolder = String(formData.get("targetFolder") || "");

    const files = formData.getAll("files") as File[];
    const paths = formData.getAll("paths") as string[];

    if (!files.length) {
      return NextResponse.json(
        { error: "No files provided for upload." },
        { status: 400 },
      );
    }

    const uploadItems: UploadItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || typeof file.arrayBuffer !== "function") continue;

      // Use explicit relative path if provided (e.g. from webkitRelativePath for directory upload), else file.name
      const relativePath = paths[i] && paths[i].trim() ? paths[i].trim() : file.name;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      uploadItems.push({
        relativePath,
        buffer,
        modifiedAt: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
      });
    }

    const result = await processUploadBatch(libraryId, targetFolder, uploadItems);

    return NextResponse.json({
      success: true,
      uploadedCount: result.uploaded.length,
      skippedCount: result.skipped.length,
      skipped: result.skipped,
    });
  } catch (err) {
    if (err instanceof GalleryPathError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to process upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
