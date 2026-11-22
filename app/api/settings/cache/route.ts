import fs from "node:fs";
import path from "node:path";
import { connection } from "next/server";
import { NextResponse } from "next/server";
import sharp from "sharp";

const THUMBNAIL_CACHE_DIR = path.join(process.cwd(), "data", "thumbnails");

export async function GET() {
  await connection();
  try {
    if (!fs.existsSync(THUMBNAIL_CACHE_DIR)) {
      return NextResponse.json({
        thumbnailCount: 0,
        totalSizeBytes: 0,
      });
    }

    const files = await fs.promises.readdir(THUMBNAIL_CACHE_DIR);
    let count = 0;
    let totalSizeBytes = 0;

    for (const file of files) {
      if (!file.endsWith(".webp")) continue;
      try {
        const stat = await fs.promises.stat(path.join(THUMBNAIL_CACHE_DIR, file));
        if (stat.isFile()) {
          count++;
          totalSizeBytes += stat.size;
        }
      } catch {
        // Skip files that vanished or are locked
      }
    }

    return NextResponse.json(
      {
        thumbnailCount: count,
        totalSizeBytes,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Failed to read thumbnail cache stats:", error);
    return NextResponse.json(
      { error: "Failed to determine cache storage." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    if (!fs.existsSync(THUMBNAIL_CACHE_DIR)) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    const files = await fs.promises.readdir(THUMBNAIL_CACHE_DIR);
    let deletedCount = 0;

    for (const file of files) {
      if (file === ".gitkeep") continue;
      try {
        await fs.promises.unlink(path.join(THUMBNAIL_CACHE_DIR, file));
        deletedCount++;
      } catch (err) {
        console.warn(`[Cache] Could not delete thumbnail ${file}:`, err);
      }
    }

    // Flush and reset Sharp in-memory cache
    sharp.cache(false);
    sharp.cache({ memory: 50, items: 100, files: 20 });

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    console.error("Failed to purge thumbnail cache:", error);
    return NextResponse.json(
      { error: "Failed to clear thumbnail cache." },
      { status: 500 },
    );
  }
}
