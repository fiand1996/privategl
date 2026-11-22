import fs from "node:fs";
import path from "node:path";
import { GALLERY_ROOT } from "./gallery";
import { createLibrary, findLibraryByRoot, getLibraryList } from "./database";

export function getDefaultLibraryRoot(): string | null {
  try {
    if (fs.existsSync(GALLERY_ROOT)) {
      return fs.realpathSync(GALLERY_ROOT);
    }
  } catch {}
  return null;
}

export function ensureDefaultLibrary() {
  try {
    if (!fs.existsSync(GALLERY_ROOT)) {
      fs.mkdirSync(GALLERY_ROOT, { recursive: true });
    }
    const rootPath = fs.realpathSync(GALLERY_ROOT);
    const existing = findLibraryByRoot(rootPath);

    if (!existing) {
      try {
        createLibrary("My Gallery", rootPath);
      } catch (error) {
        const racedInsert = findLibraryByRoot(rootPath);
        if (!racedInsert) throw error;
      }
    }
  } catch (error) {
    console.warn(
      `[Library] Default gallery folder (${GALLERY_ROOT}) could not be initialized:`,
      error instanceof Error ? error.message : error,
    );
  }

  return getLibraryList();
}

export function validateLibraryRoot(requestedPath: string) {
  if (!requestedPath || !requestedPath.trim()) {
    throw new Error("Folder path is required.");
  }
  if (!path.isAbsolute(requestedPath)) {
    throw new Error("Library path must be absolute.");
  }

  const rootPath = fs.realpathSync(requestedPath);
  if (!fs.statSync(rootPath).isDirectory()) {
    throw new Error("Library path is not a directory.");
  }
  return rootPath;
}
