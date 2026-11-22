import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { getDatabase, getLibrary } from "./database";
import { GalleryPathError, IMAGE_CONTENT_TYPES } from "./gallery";
import * as schema from "./schema";

function isWithinDirectory(directory: string, candidate: string) {
  const relativePath = path.relative(directory, candidate);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, "\\$&");
}

export function resolveLibraryPath(
  libraryRoot: string,
  relativePath: string,
  checkExists = true,
) {
  let root: string;
  try {
    root = fs.realpathSync(libraryRoot);
  } catch {
    throw new GalleryPathError("Library directory is unavailable.", 404);
  }

  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const candidate = path.resolve(root, normalized);

  if (!isWithinDirectory(root, candidate)) {
    throw new GalleryPathError("Path is outside library directory.", 400);
  }

  if (checkExists) {
    if (!fs.existsSync(candidate)) {
      throw new GalleryPathError(`Path "${relativePath}" not found.`, 404);
    }
  }

  return { root, absolutePath: candidate, normalizedRelative: normalized };
}

export function getGalleryFolders(libraryId: number) {
  const library = getLibrary(libraryId);
  if (!library) throw new GalleryPathError("Library not found.", 404);

  const db = getDatabase();
  const folderRows = db
    .select({
      path: schema.libraryEntries.path,
      name: schema.libraryEntries.name,
      parentPath: schema.libraryEntries.parentPath,
    })
    .from(schema.libraryEntries)
    .where(
      sql`${schema.libraryEntries.libraryId} = ${libraryId} AND ${schema.libraryEntries.kind} = 'directory'`,
    )
    .orderBy(schema.libraryEntries.path)
    .all();

  return [
    { path: "", name: "Root (Main)" },
    ...folderRows.map((f) => ({
      path: f.path,
      name: f.name || f.path,
    })),
  ];
}

export function deleteGalleryItems(libraryId: number, relativePaths: string[]) {
  const library = getLibrary(libraryId);
  if (!library) throw new GalleryPathError("Library not found.", 404);

  const db = getDatabase();
  let deletedCount = 0;

  for (const relPath of relativePaths) {
    const { absolutePath, normalizedRelative } = resolveLibraryPath(
      library.rootPath,
      relPath,
      true,
    );

    // Prevent deleting root itself
    if (normalizedRelative === "") {
      throw new GalleryPathError("Cannot delete library root directory.", 400);
    }

    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      fs.rmSync(absolutePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(absolutePath);
    }

    const childPattern = `${escapeLikePattern(normalizedRelative)}/%`;

    // Delete from SQLite database
    db.transaction((tx) => {
      tx.delete(schema.libraryEntries)
        .where(
          sql`${schema.libraryEntries.libraryId} = ${libraryId}
            AND (${schema.libraryEntries.path} = ${normalizedRelative}
              OR ${schema.libraryEntries.path} LIKE ${childPattern} ESCAPE '\\')`,
        )
        .run();

      tx.delete(schema.albumEntries)
        .where(
          sql`${schema.albumEntries.libraryId} = ${libraryId}
            AND (${schema.albumEntries.entryPath} = ${normalizedRelative}
              OR ${schema.albumEntries.entryPath} LIKE ${childPattern} ESCAPE '\\')`,
        )
        .run();

      tx.delete(schema.albums)
        .where(
          sql`${schema.albums.libraryId} = ${libraryId}
            AND (${schema.albums.folderPath} = ${normalizedRelative}
              OR ${schema.albums.folderPath} LIKE ${childPattern} ESCAPE '\\')`,
        )
        .run();

      tx.delete(schema.photoTags)
        .where(
          sql`${schema.photoTags.libraryId} = ${libraryId}
            AND (${schema.photoTags.entryPath} = ${normalizedRelative}
              OR ${schema.photoTags.entryPath} LIKE ${childPattern} ESCAPE '\\')`,
        )
        .run();

      tx.delete(schema.photoUserMetadata)
        .where(
          sql`${schema.photoUserMetadata.libraryId} = ${libraryId}
            AND (${schema.photoUserMetadata.entryPath} = ${normalizedRelative}
              OR ${schema.photoUserMetadata.entryPath} LIKE ${childPattern} ESCAPE '\\')`,
        )
        .run();

      tx.delete(schema.photoMetadata)
        .where(
          sql`${schema.photoMetadata.libraryId} = ${libraryId}
            AND (${schema.photoMetadata.entryPath} = ${normalizedRelative}
              OR ${schema.photoMetadata.entryPath} LIKE ${childPattern} ESCAPE '\\')`,
        )
        .run();
    });

    deletedCount++;
  }

  return { success: true, count: deletedCount };
}

export function moveGalleryItems(
  libraryId: number,
  sourcePaths: string[],
  destinationFolder: string,
) {
  const library = getLibrary(libraryId);
  if (!library) throw new GalleryPathError("Library not found.", 404);

  const destFolderNormalized = destinationFolder
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const { absolutePath: destAbs } = resolveLibraryPath(
    library.rootPath,
    destFolderNormalized,
    destFolderNormalized !== "",
  );

  if (destFolderNormalized !== "" && !fs.statSync(destAbs).isDirectory()) {
    throw new GalleryPathError("Destination is not a directory.", 400);
  }

  const db = getDatabase();
  let movedCount = 0;

  for (const srcRel of sourcePaths) {
    const { absolutePath: srcAbs, normalizedRelative: srcNorm } =
      resolveLibraryPath(library.rootPath, srcRel, true);

    if (srcNorm === "") {
      throw new GalleryPathError("Cannot move root directory.", 400);
    }

    const itemName = path.basename(srcNorm);
    const targetRel = destFolderNormalized
      ? `${destFolderNormalized}/${itemName}`
      : itemName;

    // Check circular move (cannot move a directory into itself or child)
    if (
      targetRel === srcNorm ||
      destFolderNormalized === srcNorm ||
      destFolderNormalized.startsWith(srcNorm + "/")
    ) {
      throw new GalleryPathError(
        `Cannot move "${itemName}" into itself or its own subfolder.`,
        400,
      );
    }

    const targetAbs = path.join(destAbs, itemName);

    if (fs.existsSync(targetAbs)) {
      throw new GalleryPathError(
        `An item named "${itemName}" already exists in the destination folder.`,
        400,
      );
    }

    // Move in filesystem
    fs.renameSync(srcAbs, targetAbs);

    const childSrcPattern = `${escapeLikePattern(srcNorm)}/%`;

    // Update in database
    db.transaction((tx) => {
      // Find all affected entries (the item and its children if directory)
      const rows = tx
        .select({
          path: schema.libraryEntries.path,
          kind: schema.libraryEntries.kind,
        })
        .from(schema.libraryEntries)
        .where(
          sql`${schema.libraryEntries.libraryId} = ${libraryId}
            AND (${schema.libraryEntries.path} = ${srcNorm}
              OR ${schema.libraryEntries.path} LIKE ${childSrcPattern} ESCAPE '\\')`,
        )
        .all();

      for (const row of rows) {
        const suffix = row.path.slice(srcNorm.length);
        const newEntryPath = targetRel + suffix;
        const newParent = path.posix.dirname(newEntryPath);
        const parentPathVal = newParent === "." ? "" : newParent;
        const nameVal = path.posix.basename(newEntryPath);

        tx.update(schema.libraryEntries)
          .set({
            path: newEntryPath,
            parentPath: parentPathVal,
            name: nameVal,
          })
          .where(
            sql`${schema.libraryEntries.libraryId} = ${libraryId} AND ${schema.libraryEntries.path} = ${row.path}`,
          )
          .run();

        tx.update(schema.albumEntries)
          .set({ entryPath: newEntryPath })
          .where(
            sql`${schema.albumEntries.libraryId} = ${libraryId} AND ${schema.albumEntries.entryPath} = ${row.path}`,
          )
          .run();

        tx.update(schema.photoTags)
          .set({ entryPath: newEntryPath })
          .where(
            sql`${schema.photoTags.libraryId} = ${libraryId} AND ${schema.photoTags.entryPath} = ${row.path}`,
          )
          .run();

        tx.update(schema.photoUserMetadata)
          .set({ entryPath: newEntryPath })
          .where(
            sql`${schema.photoUserMetadata.libraryId} = ${libraryId} AND ${schema.photoUserMetadata.entryPath} = ${row.path}`,
          )
          .run();

        tx.update(schema.photoMetadata)
          .set({ entryPath: newEntryPath })
          .where(
            sql`${schema.photoMetadata.libraryId} = ${libraryId} AND ${schema.photoMetadata.entryPath} = ${row.path}`,
          )
          .run();

        if (row.kind === "directory") {
          tx.update(schema.albums)
            .set({ folderPath: newEntryPath })
            .where(
              sql`${schema.albums.libraryId} = ${libraryId} AND ${schema.albums.folderPath} = ${row.path}`,
            )
            .run();
        }
      }
    });

    movedCount++;
  }

  return { success: true, count: movedCount };
}

function getNonConflictingPath(dirAbs: string, originalName: string) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  let candidateName = originalName;
  let counter = 1;

  while (fs.existsSync(path.join(dirAbs, candidateName))) {
    candidateName = `${base} (${counter})${ext}`;
    counter++;
  }

  return candidateName;
}

export function copyGalleryItems(
  libraryId: number,
  sourcePaths: string[],
  destinationFolder: string,
) {
  const library = getLibrary(libraryId);
  if (!library) throw new GalleryPathError("Library not found.", 404);

  const destFolderNormalized = destinationFolder
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const { absolutePath: destAbs } = resolveLibraryPath(
    library.rootPath,
    destFolderNormalized,
    destFolderNormalized !== "",
  );

  if (destFolderNormalized !== "" && !fs.statSync(destAbs).isDirectory()) {
    throw new GalleryPathError("Destination is not a directory.", 400);
  }

  const db = getDatabase();
  let copiedCount = 0;

  for (const srcRel of sourcePaths) {
    const { absolutePath: srcAbs, normalizedRelative: srcNorm } =
      resolveLibraryPath(library.rootPath, srcRel, true);

    if (srcNorm === "") {
      throw new GalleryPathError("Cannot copy root directory.", 400);
    }

    const originalName = path.basename(srcNorm);
    const targetName = getNonConflictingPath(destAbs, originalName);
    const targetAbs = path.join(destAbs, targetName);
    const targetRel = destFolderNormalized
      ? `${destFolderNormalized}/${targetName}`
      : targetName;

    const stat = fs.statSync(srcAbs);

    if (
      stat.isDirectory() &&
      (destFolderNormalized === srcNorm ||
        destFolderNormalized.startsWith(srcNorm + "/"))
    ) {
      throw new GalleryPathError(
        `Cannot copy "${originalName}" into itself or its own subfolder.`,
        400,
      );
    }

    if (stat.isDirectory()) {
      fs.cpSync(srcAbs, targetAbs, { recursive: true });
    } else {
      fs.copyFileSync(srcAbs, targetAbs);
    }

    // Helper to recursively index copied files into SQLite
    const batch: Array<{
      path: string;
      parentPath: string;
      name: string;
      kind: "directory" | "image";
      extension: string | null;
      size: number | null;
      modifiedAt: string | null;
      scanId: string;
    }> = [];

    function collectEntries(currentAbs: string, currentRel: string) {
      const currentStat = fs.statSync(currentAbs);
      const isDir = currentStat.isDirectory();
      const entryName = path.posix.basename(currentRel);
      const dirName = path.posix.dirname(currentRel);
      const parentVal = dirName === "." ? "" : dirName;
      const ext = path.extname(entryName).toLowerCase();

      if (isDir) {
        batch.push({
          path: currentRel,
          parentPath: parentVal,
          name: entryName,
          kind: "directory",
          extension: null,
          size: null,
          modifiedAt: null,
          scanId: "copy-op",
        });

        for (const child of fs.readdirSync(currentAbs)) {
          if (child.startsWith(".")) continue;
          collectEntries(
            path.join(currentAbs, child),
            path.posix.join(currentRel, child),
          );
        }
      } else if (IMAGE_CONTENT_TYPES[ext]) {
        batch.push({
          path: currentRel,
          parentPath: parentVal,
          name: entryName,
          kind: "image",
          extension: ext,
          size: currentStat.size,
          modifiedAt: currentStat.mtime.toISOString(),
          scanId: "copy-op",
        });
      }
    }

    collectEntries(targetAbs, targetRel);

    db.transaction((tx) => {
      for (const entry of batch) {
        tx.insert(schema.libraryEntries)
          .values({
            libraryId,
            ...entry,
          })
          .onConflictDoUpdate({
            target: [
              schema.libraryEntries.libraryId,
              schema.libraryEntries.path,
            ],
            set: entry,
          })
          .run();
      }
    });

    copiedCount++;
  }

  return { success: true, count: copiedCount };
}

export function createGalleryFolder(
  libraryId: number,
  parentFolder: string,
  folderName: string,
) {
  const library = getLibrary(libraryId);
  if (!library) throw new GalleryPathError("Library not found.", 404);

  const parentNorm = parentFolder
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const { absolutePath: parentAbs } = resolveLibraryPath(
    library.rootPath,
    parentNorm,
    parentNorm !== "",
  );

  const sanitizedName = folderName.trim().replace(/[/\\?%*:|"<>]/g, "");
  if (!sanitizedName || sanitizedName === "." || sanitizedName === "..") {
    throw new GalleryPathError("Invalid folder name.", 400);
  }

  const newFolderAbs = path.join(parentAbs, sanitizedName);
  if (fs.existsSync(newFolderAbs)) {
    throw new GalleryPathError(
      `A folder or file named "${sanitizedName}" already exists.`,
      400,
    );
  }

  fs.mkdirSync(newFolderAbs, { recursive: true });

  const newRelPath = parentNorm
    ? `${parentNorm}/${sanitizedName}`
    : sanitizedName;

  const db = getDatabase();
  db.transaction((tx) => {
    tx.insert(schema.libraryEntries)
      .values({
        libraryId,
        path: newRelPath,
        parentPath: parentNorm,
        name: sanitizedName,
        kind: "directory",
        extension: null,
        size: null,
        modifiedAt: new Date().toISOString(),
        scanId: "create-folder-op",
      })
      .onConflictDoUpdate({
        target: [schema.libraryEntries.libraryId, schema.libraryEntries.path],
        set: {
          parentPath: parentNorm,
          name: sanitizedName,
          kind: "directory",
          modifiedAt: new Date().toISOString(),
        },
      })
      .run();
  });

  return { success: true, path: newRelPath };
}

export function renameGalleryItem(
  libraryId: number,
  relativePath: string,
  rawNewName: string,
) {
  const library = getLibrary(libraryId);
  if (!library) throw new GalleryPathError("Library not found.", 404);

  const { absolutePath: srcAbs, normalizedRelative: srcNorm } =
    resolveLibraryPath(library.rootPath, relativePath, true);

  if (srcNorm === "") {
    throw new GalleryPathError("Cannot rename library root directory.", 400);
  }

  const sanitizedNewName = rawNewName.trim();
  if (
    !sanitizedNewName ||
    sanitizedNewName === "." ||
    sanitizedNewName === ".." ||
    sanitizedNewName.includes("/") ||
    sanitizedNewName.includes("\\") ||
    sanitizedNewName.includes("\0")
  ) {
    throw new GalleryPathError("Invalid file or folder name.", 400);
  }

  const parentRel = path.posix.dirname(srcNorm);
  const parentNorm = parentRel === "." ? "" : parentRel;
  const currentName = path.posix.basename(srcNorm);

  const stat = fs.statSync(srcAbs);
  const isDir = stat.isDirectory();

  // If renaming a file, ensure extension integrity
  let finalNewName = sanitizedNewName;
  if (!isDir) {
    const currentExt = path.posix.extname(currentName);
    const newExt = path.posix.extname(sanitizedNewName);
    // If user provided a name without extension, preserve original extension
    if (!newExt && currentExt) {
      finalNewName = `${sanitizedNewName}${currentExt}`;
    }
  }

  if (finalNewName === currentName) {
    return {
      success: true,
      oldPath: srcNorm,
      newPath: srcNorm,
      newName: currentName,
    };
  }

  const newRelPath = parentNorm
    ? `${parentNorm}/${finalNewName}`
    : finalNewName;

  const targetAbs = path.join(path.dirname(srcAbs), finalNewName);

  if (fs.existsSync(targetAbs)) {
    throw new GalleryPathError(
      `An item named "${finalNewName}" already exists in this folder.`,
      400,
    );
  }

  // Rename in filesystem
  fs.renameSync(srcAbs, targetAbs);

  const childSrcPattern = `${escapeLikePattern(srcNorm)}/%`;

  // Update in database atomically
  const db = getDatabase();
  db.transaction((tx) => {
    // Find all affected entries (the item itself and its descendants if directory)
    const rows = tx
      .select({
        path: schema.libraryEntries.path,
        kind: schema.libraryEntries.kind,
      })
      .from(schema.libraryEntries)
      .where(
        sql`${schema.libraryEntries.libraryId} = ${libraryId}
          AND (${schema.libraryEntries.path} = ${srcNorm}
            OR ${schema.libraryEntries.path} LIKE ${childSrcPattern} ESCAPE '\\')`,
      )
      .all();

    for (const row of rows) {
      const suffix = row.path.slice(srcNorm.length);
      const newEntryPath = newRelPath + suffix;
      const newParent = path.posix.dirname(newEntryPath);
      const parentPathVal = newParent === "." ? "" : newParent;
      const nameVal = path.posix.basename(newEntryPath);
      const extVal =
        row.kind === "directory"
          ? null
          : path.posix.extname(nameVal).toLowerCase() || null;

      tx.update(schema.libraryEntries)
        .set({
          path: newEntryPath,
          parentPath: parentPathVal,
          name: nameVal,
          extension: extVal,
        })
        .where(
          sql`${schema.libraryEntries.libraryId} = ${libraryId} AND ${schema.libraryEntries.path} = ${row.path}`,
        )
        .run();

      tx.update(schema.albumEntries)
        .set({ entryPath: newEntryPath })
        .where(
          sql`${schema.albumEntries.libraryId} = ${libraryId} AND ${schema.albumEntries.entryPath} = ${row.path}`,
        )
        .run();

      tx.update(schema.photoTags)
        .set({ entryPath: newEntryPath })
        .where(
          sql`${schema.photoTags.libraryId} = ${libraryId} AND ${schema.photoTags.entryPath} = ${row.path}`,
        )
        .run();

      tx.update(schema.photoUserMetadata)
        .set({ entryPath: newEntryPath })
        .where(
          sql`${schema.photoUserMetadata.libraryId} = ${libraryId} AND ${schema.photoUserMetadata.entryPath} = ${row.path}`,
        )
        .run();

      tx.update(schema.photoMetadata)
        .set({ entryPath: newEntryPath })
        .where(
          sql`${schema.photoMetadata.libraryId} = ${libraryId} AND ${schema.photoMetadata.entryPath} = ${row.path}`,
        )
        .run();

      if (row.kind === "directory") {
        tx.update(schema.albums)
          .set({ folderPath: newEntryPath })
          .where(
            sql`${schema.albums.libraryId} = ${libraryId} AND ${schema.albums.folderPath} = ${row.path}`,
          )
          .run();
      }
    }
  });

  return {
    success: true,
    oldPath: srcNorm,
    newPath: newRelPath,
    newName: finalNewName,
  };
}
