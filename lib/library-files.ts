import fs from "node:fs";
import path from "node:path";
import { getLibrary } from "./database";
import { GalleryPathError } from "./gallery";

function isWithinDirectory(directory: string, candidate: string) {
  const relativePath = path.relative(directory, candidate);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

export function resolveLibraryFile(libraryId: number, relativePath: string) {
  const library = getLibrary(libraryId);
  if (!library) throw new GalleryPathError("Library not found.", 404);

  let root: string;
  try {
    root = fs.realpathSync(library.rootPath);
  } catch {
    throw new GalleryPathError("Library folder is unavailable.", 404);
  }

  const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const candidate = path.resolve(root, normalizedPath);
  if (!isWithinDirectory(root, candidate)) {
    throw new GalleryPathError("Path is outside the library.", 400);
  }

  let absolutePath: string;
  try {
    absolutePath = fs.realpathSync(candidate);
  } catch {
    throw new GalleryPathError("File not found.", 404);
  }

  if (!isWithinDirectory(root, absolutePath)) {
    throw new GalleryPathError("Access outside the library is not allowed.", 400);
  }
  return absolutePath;
}
