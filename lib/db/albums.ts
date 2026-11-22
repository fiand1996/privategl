import { count, desc, eq, inArray, sql } from "drizzle-orm";
import path from "node:path";
import { getDatabase } from "./client";
import { getLibrary } from "./libraries";
import { GalleryPathError } from "../gallery";
import * as schema from "../schema";

const GALLERY_PAGE_SIZE = 48;

export interface IndexedAlbum {
  id?: number;
  kind?: "folder" | "custom";
  name: string;
  path: string;
  description?: string | null;
  photoCount: number;
  coverPath: string;
  coverModifiedAt: string | null;
  coverSize: number | null;
  updatedAt: string | null;
}

export function syncFolderAlbums(libraryId: number) {
  const db = getDatabase();
  const folderRows = db
    .select({
      parentPath: schema.libraryEntries.parentPath,
    })
    .from(schema.libraryEntries)
    .where(
      sql`${schema.libraryEntries.libraryId} = ${libraryId}
        AND ${schema.libraryEntries.kind} = 'image'
        AND ${schema.libraryEntries.parentPath} != ''`,
    )
    .groupBy(schema.libraryEntries.parentPath)
    .all();

  const now = new Date().toISOString();
  for (const row of folderRows) {
    const folderName = path.posix.basename(row.parentPath);
    db.insert(schema.albums)
      .values({
        libraryId,
        name: folderName,
        kind: "folder",
        folderPath: row.parentPath,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();
  }

  // Garbage collect deleted files from album entries
  db.run(sql`
    DELETE FROM album_entries 
    WHERE library_id = ${libraryId} 
      AND entry_path NOT IN (
        SELECT path FROM library_entries WHERE library_id = ${libraryId} AND kind = 'image'
      )
  `);
}

export function getIndexedAlbums(
  libraryId: number,
  requestedPage = 1,
  sort: "name-asc" | "name-desc" | "modified-desc" = "name-asc",
  kindFilter?: "all" | "folder" | "custom",
) {
  const db = getDatabase();
  if (!getLibrary(libraryId)) {
    throw new GalleryPathError("Library not found.", 404);
  }

  syncFolderAlbums(libraryId);

  // Fetch albums
  const albumConditions =
    kindFilter && kindFilter !== "all"
      ? sql`${schema.albums.libraryId} = ${libraryId} AND ${schema.albums.kind} = ${kindFilter}`
      : eq(schema.albums.libraryId, libraryId);

  const allAlbums = db
    .select()
    .from(schema.albums)
    .where(albumConditions)
    .all();
  const albumItems: IndexedAlbum[] = [];

  // Batch aggregate stats for folder albums (eliminates N+1 queries)
  const folderStatsRows = db
    .select({
      parentPath: schema.libraryEntries.parentPath,
      photoCount: count(),
      coverName: sql<string>`min(${schema.libraryEntries.name})`,
      updatedAt: sql<string | null>`max(${schema.libraryEntries.modifiedAt})`,
    })
    .from(schema.libraryEntries)
    .where(
      sql`${schema.libraryEntries.libraryId} = ${libraryId}
        AND ${schema.libraryEntries.kind} = 'image'
        AND ${schema.libraryEntries.parentPath} != ''`,
    )
    .groupBy(schema.libraryEntries.parentPath)
    .all();

  const folderStatsMap = new Map<
    string,
    { photoCount: number; coverName: string; updatedAt: string | null }
  >();
  for (const row of folderStatsRows) {
    folderStatsMap.set(row.parentPath, row);
  }

  // Batch aggregate stats for custom albums (eliminates N+1 queries)
  const customStatsRows = db
    .select({
      albumId: schema.albumEntries.albumId,
      photoCount: count(),
      firstEntry: sql<string>`min(${schema.albumEntries.entryPath})`,
      updatedAt: sql<string | null>`max(${schema.libraryEntries.modifiedAt})`,
    })
    .from(schema.albumEntries)
    .innerJoin(
      schema.libraryEntries,
      sql`${schema.albumEntries.libraryId} = ${schema.libraryEntries.libraryId} AND ${schema.albumEntries.entryPath} = ${schema.libraryEntries.path}`,
    )
    .where(
      sql`${schema.albumEntries.libraryId} = ${libraryId}
        AND ${schema.libraryEntries.kind} = 'image'`,
    )
    .groupBy(schema.albumEntries.albumId)
    .all();

  const customStatsMap = new Map<
    number,
    { photoCount: number; firstEntry: string; updatedAt: string | null }
  >();
  for (const row of customStatsRows) {
    customStatsMap.set(row.albumId, row);
  }

  for (const alb of allAlbums) {
    if (alb.kind === "folder" && alb.folderPath) {
      const stats = folderStatsMap.get(alb.folderPath);
      if (!stats || stats.photoCount === 0) continue;

      const coverPath =
        alb.coverEntryPath ||
        (stats.coverName
          ? path.posix.join(alb.folderPath, stats.coverName)
          : "");

      albumItems.push({
        id: alb.id,
        kind: alb.kind,
        name: alb.name,
        path: alb.folderPath,
        description: alb.description,
        photoCount: stats.photoCount,
        coverPath,
        coverModifiedAt: stats.updatedAt,
        coverSize: null,
        updatedAt: alb.updatedAt || stats.updatedAt,
      });
    } else if (alb.kind === "custom") {
      const stats = customStatsMap.get(alb.id);
      const photoCount = stats?.photoCount ?? 0;
      const coverPath = alb.coverEntryPath || stats?.firstEntry || "";

      albumItems.push({
        id: alb.id,
        kind: alb.kind,
        name: alb.name,
        path: `custom:${alb.id}`,
        description: alb.description,
        photoCount,
        coverPath,
        coverModifiedAt: stats?.updatedAt ?? null,
        coverSize: null,
        updatedAt: alb.updatedAt,
      });
    }
  }

  // Sort albums
  albumItems.sort((a, b) => {
    if (sort === "name-desc") return b.name.localeCompare(a.name);
    if (sort === "modified-desc") {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    }
    return a.name.localeCompare(b.name);
  });

  const totalCount = albumItems.length;
  const pageSize = GALLERY_PAGE_SIZE;
  const page = Math.max(
    1,
    Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1,
  );
  const items = albumItems.slice((page - 1) * pageSize, page * pageSize);

  return { items, totalCount, page, pageSize };
}

export function getIndexedAlbumPhotos(
  libraryId: number,
  albumPathOrId: string,
  requestedPage = 1,
  sort: "name-asc" | "name-desc" | "modified-desc" = "name-asc",
) {
  const db = getDatabase();
  if (!getLibrary(libraryId)) {
    throw new GalleryPathError("Library not found.", 404);
  }

  const isCustom =
    albumPathOrId.startsWith("custom:") || /^\d+$/.test(albumPathOrId);

  if (isCustom) {
    const customId = Number(albumPathOrId.replace("custom:", ""));
    const alb = db
      .select()
      .from(schema.albums)
      .where(eq(schema.albums.id, customId))
      .get();
    if (!alb) throw new GalleryPathError("Album not found.", 404);

    const baseConditions = sql`${schema.albumEntries.albumId} = ${customId} AND ${schema.libraryEntries.kind} = 'image'`;
    const totalCount =
      db
        .select({ count: count() })
        .from(schema.albumEntries)
        .innerJoin(
          schema.libraryEntries,
          sql`${schema.albumEntries.libraryId} = ${schema.libraryEntries.libraryId} AND ${schema.albumEntries.entryPath} = ${schema.libraryEntries.path}`,
        )
        .where(baseConditions)
        .get()?.count ?? 0;

    const pageSize = GALLERY_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.max(
      1,
      Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1,
    );

    if (page > pageCount && totalCount > 0) {
      return {
        album: alb.name,
        path: albumPathOrId,
        albumId: alb.id,
        kind: alb.kind,
        description: alb.description,
        items: [],
        totalCount,
        page,
        pageSize,
      };
    }

    const items = db
      .select({
        name: schema.libraryEntries.name,
        path: schema.libraryEntries.path,
        size: schema.libraryEntries.size,
        modifiedAt: schema.libraryEntries.modifiedAt,
        width: schema.photoMetadata.width,
        height: schema.photoMetadata.height,
        isFavorite: sql<boolean>`coalesce((SELECT pum.is_favorite FROM photo_user_metadata pum WHERE pum.library_id = ${libraryId} AND pum.entry_path = ${schema.libraryEntries.path}), 0) = 1`,
      })
      .from(schema.albumEntries)
      .innerJoin(
        schema.libraryEntries,
        sql`${schema.albumEntries.libraryId} = ${schema.libraryEntries.libraryId} AND ${schema.albumEntries.entryPath} = ${schema.libraryEntries.path}`,
      )
      .leftJoin(
        schema.photoMetadata,
        sql`${schema.photoMetadata.libraryId} = ${libraryId} AND ${schema.photoMetadata.entryPath} = ${schema.libraryEntries.path}`,
      )
      .where(baseConditions)
      .orderBy(
        ...(sort === "name-desc"
          ? [sql`lower(${schema.libraryEntries.name}) DESC`]
          : sort === "modified-desc"
            ? [
                sql`${schema.libraryEntries.modifiedAt} IS NULL`,
                desc(schema.libraryEntries.modifiedAt),
                sql`lower(${schema.libraryEntries.name})`,
              ]
            : [sql`lower(${schema.libraryEntries.name})`]),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      album: alb.name,
      path: albumPathOrId,
      albumId: alb.id,
      kind: alb.kind,
      description: alb.description,
      items,
      totalCount,
      page,
      pageSize,
    };
  }

  // Folder Album
  const normalizedPath = albumPathOrId
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  syncFolderAlbums(libraryId);

  const alb = db
    .select()
    .from(schema.albums)
    .where(
      sql`${schema.albums.libraryId} = ${libraryId} AND ${schema.albums.folderPath} = ${normalizedPath}`,
    )
    .get();

  const albumTitle = alb?.name || path.posix.basename(normalizedPath);
  const conditions = sql`${schema.libraryEntries.libraryId} = ${libraryId}
    AND ${schema.libraryEntries.parentPath} = ${normalizedPath}
    AND ${schema.libraryEntries.kind} = 'image'`;

  const totalCount =
    db
      .select({ count: count() })
      .from(schema.libraryEntries)
      .where(conditions)
      .get()?.count ?? 0;

  const pageSize = GALLERY_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.max(
    1,
    Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1,
  );

  if (page > pageCount && totalCount > 0) {
    return {
      album: albumTitle,
      path: normalizedPath,
      albumId: alb?.id,
      kind: alb?.kind ?? "folder",
      items: [],
      totalCount,
      page,
      pageSize,
    };
  }

  const items = db
    .select({
      name: schema.libraryEntries.name,
      path: schema.libraryEntries.path,
      size: schema.libraryEntries.size,
      modifiedAt: schema.libraryEntries.modifiedAt,
      width: schema.photoMetadata.width,
      height: schema.photoMetadata.height,
      isFavorite: sql<boolean>`coalesce((SELECT pum.is_favorite FROM photo_user_metadata pum WHERE pum.library_id = ${libraryId} AND pum.entry_path = ${schema.libraryEntries.path}), 0) = 1`,
    })
    .from(schema.libraryEntries)
    .leftJoin(
      schema.photoMetadata,
      sql`${schema.photoMetadata.libraryId} = ${libraryId} AND ${schema.photoMetadata.entryPath} = ${schema.libraryEntries.path}`,
    )
    .where(conditions)
    .orderBy(
      ...(sort === "name-desc"
        ? [sql`lower(${schema.libraryEntries.name}) DESC`]
        : sort === "modified-desc"
          ? [
              sql`${schema.libraryEntries.modifiedAt} IS NULL`,
              desc(schema.libraryEntries.modifiedAt),
              sql`lower(${schema.libraryEntries.name})`,
            ]
          : [sql`lower(${schema.libraryEntries.name})`]),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  return {
    album: albumTitle,
    path: normalizedPath,
    albumId: alb?.id,
    kind: alb?.kind ?? "folder",
    description: alb?.description,
    items,
    totalCount,
    page,
    pageSize,
  };
}

export function createCustomAlbum(
  libraryId: number,
  name: string,
  description?: string,
  initialPaths: string[] = [],
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const trimmedName = name.trim();
  if (!trimmedName)
    throw new GalleryPathError("Album name cannot be empty.", 400);

  const res = db
    .insert(schema.albums)
    .values({
      libraryId,
      name: trimmedName,
      kind: "custom",
      description: description?.trim() || null,
      coverEntryPath: initialPaths[0] || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: schema.albums.id })
    .get();

  if (initialPaths.length > 0 && res?.id) {
    for (const p of initialPaths) {
      db.insert(schema.albumEntries)
        .values({
          albumId: res.id,
          libraryId,
          entryPath: p,
          createdAt: now,
        })
        .onConflictDoNothing()
        .run();
    }
  }

  return { success: true, albumId: res?.id, name: trimmedName };
}

export function renameAlbum(albumId: number, newName: string) {
  const db = getDatabase();
  const trimmed = newName.trim();
  if (!trimmed) throw new GalleryPathError("Album name cannot be empty.", 400);

  db.update(schema.albums)
    .set({
      name: trimmed,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.albums.id, albumId))
    .run();

  return { success: true, name: trimmed };
}

export function deleteAlbum(albumId: number) {
  const db = getDatabase();
  const alb = db
    .select({ kind: schema.albums.kind })
    .from(schema.albums)
    .where(eq(schema.albums.id, albumId))
    .get();

  if (!alb) {
    throw new GalleryPathError("Album not found.", 404);
  }

  if (alb.kind === "folder") {
    throw new GalleryPathError(
      "Folder-based albums cannot be deleted directly. Delete the folder in the Folder view instead.",
      400,
    );
  }

  db.delete(schema.albums).where(eq(schema.albums.id, albumId)).run();
  return { success: true };
}

export function addPhotosToAlbum(
  albumId: number,
  libraryId: number,
  paths: string[],
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  let added = 0;

  for (const p of paths) {
    const result = db
      .insert(schema.albumEntries)
      .values({
        albumId,
        libraryId,
        entryPath: p,
        createdAt: now,
      })
      .onConflictDoNothing()
      .run();
    if (result.changes > 0) added++;
  }

  const alb = db
    .select()
    .from(schema.albums)
    .where(eq(schema.albums.id, albumId))
    .get();
  if (alb && !alb.coverEntryPath && paths[0]) {
    db.update(schema.albums)
      .set({ coverEntryPath: paths[0], updatedAt: now })
      .where(eq(schema.albums.id, albumId))
      .run();
  }

  return { success: true, count: added };
}

export function removePhotosFromAlbum(albumId: number, paths: string[]) {
  const db = getDatabase();
  db.delete(schema.albumEntries)
    .where(
      sql`${schema.albumEntries.albumId} = ${albumId} AND ${inArray(schema.albumEntries.entryPath, paths)}`,
    )
    .run();
  return { success: true };
}
