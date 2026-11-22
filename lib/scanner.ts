import fs from "node:fs";
import path from "node:path";
import {
  completeTask,
  failTask,
  getExistingPhotoMetadataIndex,
  getLibrary,
  saveScannedEntries,
  syncFolderAlbums,
  syncScannedImageMetadataBatch,
  type ScannedEntry,
  type ScannedImageFile,
} from "./database";
import { IMAGE_CONTENT_TYPES } from "./gallery";

const BATCH_SIZE = 50;

export async function scanLibrary(taskId: string, libraryId: number) {
  const library = getLibrary(libraryId);
  if (!library) throw new Error("Library not found in database.");

  let root: string;
  try {
    root = fs.realpathSync(library.rootPath);
    if (!fs.statSync(root).isDirectory()) {
      throw new Error(`Path "${library.rootPath}" is not a directory.`);
    }
  } catch (cause) {
    throw new Error(
      `Library directory is not accessible (${cause instanceof Error ? cause.message : String(cause)}). Ensure the storage folder or drive is connected.`,
    );
  }

  const pendingDirectories = [{ absolutePath: root, relativePath: "" }];
  const batch: ScannedEntry[] = [];
  const existingMetaIndex = getExistingPhotoMetadataIndex(libraryId);
  const imagesToSyncMeta: ScannedImageFile[] = [];
  let scannedCount = 0;

  function flush() {
    if (!batch.length) return;
    saveScannedEntries(
      libraryId,
      taskId,
      batch.splice(0, batch.length),
      scannedCount,
    );
  }

  while (pendingDirectories.length) {
    const directory = pendingDirectories.shift()!;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory.absolutePath, { withFileTypes: true });
    } catch (readErr) {
      console.warn(
        `[Scanner] Skipping unreadable folder (${directory.relativePath || "Root"}):`,
        readErr instanceof Error ? readErr.message : readErr,
      );
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const relativePath = path.posix.join(directory.relativePath, entry.name);
      const absolutePath = path.join(directory.absolutePath, entry.name);

      if (entry.isDirectory()) {
        batch.push({
          path: relativePath,
          parentPath: directory.relativePath,
          name: entry.name,
          kind: "directory",
          extension: null,
          size: null,
          modifiedAt: null,
        });
        pendingDirectories.push({ absolutePath, relativePath });
      } else if (
        entry.isFile() &&
        IMAGE_CONTENT_TYPES[path.extname(entry.name).toLowerCase()]
      ) {
        try {
          const stats = fs.statSync(absolutePath);
          const modifiedIso = stats.mtime.toISOString();
          batch.push({
            path: relativePath,
            parentPath: directory.relativePath,
            name: entry.name,
            kind: "image",
            extension: path.extname(entry.name).toLowerCase(),
            size: stats.size,
            modifiedAt: modifiedIso,
          });

          const existing = existingMetaIndex.get(relativePath);
          if (
            !existing ||
            existing.width === null ||
            existing.size !== stats.size ||
            existing.modifiedAt !== modifiedIso
          ) {
            imagesToSyncMeta.push({ relativePath, absolutePath });
          }
        } catch (statErr) {
          console.warn(
            `[Scanner] Skipping unreadable file (${relativePath}):`,
            statErr instanceof Error ? statErr.message : statErr,
          );
          continue;
        }
      } else {
        continue;
      }

      scannedCount++;
      if (batch.length >= BATCH_SIZE) flush();

      if (imagesToSyncMeta.length >= 25) {
        await syncScannedImageMetadataBatch(
          libraryId,
          imagesToSyncMeta.splice(0, imagesToSyncMeta.length),
        );
      }
    }
  }

  flush();

  if (imagesToSyncMeta.length > 0) {
    await syncScannedImageMetadataBatch(
      libraryId,
      imagesToSyncMeta.splice(0, imagesToSyncMeta.length),
    );
  }

  try {
    syncFolderAlbums(libraryId);
  } catch (err) {
    console.warn("[Scanner] Failed to sync folder albums:", err);
  }
  completeTask(taskId, libraryId);
}

export function recordScanFailure(taskId: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Library scan failed.";
  failTask(taskId, message);
}
