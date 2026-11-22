import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  GalleryPathError,
  IMAGE_CONTENT_TYPES,
} from "@/lib/gallery";
import { resolveLibraryFile } from "@/lib/library-files";

// Optimize Sharp memory and thread usage:
// 1. Limit internal libvips cache to prevent memory bloat during batch thumbnail requests
sharp.cache({ memory: 50, items: 100, files: 20 });
// 2. Limit concurrency (libvips worker threads) to prevent CPU core saturation
sharp.concurrency(2);
sharp.simd(true);

const THUMBNAIL_CACHE_DIR = path.join(process.cwd(), "data", "thumbnails");
const pendingThumbnails = new Map<string, Promise<string>>();

// Semaphore to limit simultaneous image decodes in memory (prevents multi-gigabyte RAM spikes)
const MAX_CONCURRENT_RESIZES = 4;
let activeResizes = 0;
const resizeQueue: (() => void)[] = [];

function acquireResizeSlot(): Promise<void> {
  if (activeResizes < MAX_CONCURRENT_RESIZES) {
    activeResizes++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    resizeQueue.push(() => {
      activeResizes++;
      resolve();
    });
  });
}

function releaseResizeSlot(): void {
  activeResizes--;
  if (resizeQueue.length > 0) {
    const next = resizeQueue.shift();
    next?.();
  }
}

function normalizeThumbnailWidth(width: number): number {
  if (width <= 160) return 160;
  if (width <= 260) return 260;
  if (width <= 400) return 400;
  if (width <= 640) return 640;
  if (width <= 1200) return 1200;
  return 1200;
}

async function getOrCreateThumbnail(
  absolutePath: string,
  targetWidth: number,
  hash: string,
): Promise<string> {
  const thumbPath = path.join(THUMBNAIL_CACHE_DIR, `${hash}.webp`);

  try {
    await fs.promises.access(thumbPath);
    return thumbPath;
  } catch {
    // Thumbnail does not exist yet
  }

  const existing = pendingThumbnails.get(thumbPath);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    await fs.promises.mkdir(THUMBNAIL_CACHE_DIR, { recursive: true });
    const tempPath = `${thumbPath}.${process.pid}.${Date.now()}.tmp`;
    await acquireResizeSlot();
    try {
      await sharp(absolutePath)
        .rotate()
        .resize(targetWidth, Math.round(targetWidth * 2.5), {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80, effort: 3 })
        .toFile(tempPath);

      await fs.promises.rename(tempPath, thumbPath);
      return thumbPath;
    } catch (err) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {}
      throw err;
    } finally {
      releaseResizeSlot();
      pendingThumbnails.delete(thumbPath);
    }
  })();

  pendingThumbnails.set(thumbPath, promise);
  return promise;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const filePath = searchParams.get("path");
  const libraryId = Number(searchParams.get("libraryId"));
  const version = searchParams.get("v");
  const rawWidth = searchParams.get("w");

  if (!filePath || !Number.isSafeInteger(libraryId) || libraryId < 1) {
    return NextResponse.json(
      { error: "Library and file path are required." },
      { status: 400 },
    );
  }

  try {
    const absolutePath = resolveLibraryFile(libraryId, filePath);
    const contentType = IMAGE_CONTENT_TYPES[path.extname(absolutePath).toLowerCase()];

    if (!contentType) {
      return NextResponse.json(
        { error: "Unsupported image format." },
        { status: 415 },
      );
    }

    const stats = await fs.promises.stat(absolutePath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: "Path is not a file." }, { status: 400 });
    }

    // Check if thumbnail was requested
    const parsedWidth = rawWidth ? Number.parseInt(rawWidth, 10) : NaN;
    const isThumbnailRequest = Number.isFinite(parsedWidth) && parsedWidth > 0;

    if (isThumbnailRequest) {
      const targetWidth = normalizeThumbnailWidth(parsedWidth);
      const hash = crypto
        .createHash("sha1")
        .update(`${libraryId}:${filePath}:${stats.mtimeMs}:${stats.size}:w${targetWidth}:v2`)
        .digest("hex");

      const etag = `"${hash}"`;
      if (request.headers.get("if-none-match") === etag) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            ETag: etag,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      try {
        const thumbFile = await getOrCreateThumbnail(absolutePath, targetWidth, hash);
        const buffer = await fs.promises.readFile(/*turbopackIgnore: true*/ thumbFile);

        return new NextResponse(buffer, {
          headers: {
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Length": String(buffer.byteLength),
            "Content-Type": "image/webp",
            ETag: etag,
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (thumbError) {
        console.warn("Failed to generate thumbnail, falling back to original:", thumbError);
        // Fall back to original file stream below
      }
    }

    // Full resolution original file
    const fileEtag = `"${stats.mtimeMs.toString(36)}-${stats.size.toString(36)}"`;
    if (request.headers.get("if-none-match") === fileEtag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: fileEtag,
          "Cache-Control": version ? "public, max-age=31536000, immutable" : "private, max-age=60",
        },
      });
    }

    const cacheableVersion =
      version === `${stats.mtime.toISOString()}-${stats.size}`;

    const fileStream = fs.createReadStream(absolutePath);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        fileStream.on("data", (chunk: string | Buffer) => {
          fileStream.pause();
          controller.enqueue(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        fileStream.once("end", () => controller.close());
        fileStream.once("error", (error: Error) => controller.error(error));
      },
      pull() {
        fileStream.resume();
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new NextResponse(body, {
      headers: {
        "Cache-Control": cacheableVersion
          ? "public, max-age=31536000, immutable"
          : "private, max-age=60",
        "Content-Length": String(stats.size),
        "Content-Type": contentType,
        ETag: fileEtag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof GalleryPathError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to read gallery image:", error);
    return NextResponse.json(
      { error: "An error occurred while loading the image." },
      { status: 500 },
    );
  }
}
