import path from "node:path";

export const GALLERY_ROOT =
  process.env.GALLERY_ROOT_PATH || path.join(process.cwd(), "media", "photos");

export class GalleryPathError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404,
  ) {
    super(message);
    this.name = "GalleryPathError";
  }
}

export const IMAGE_CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
