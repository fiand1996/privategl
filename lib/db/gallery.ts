import { count, desc, inArray, sql } from "drizzle-orm";
import path from "node:path";
import { getDatabase } from "./client";
import { getLibrary } from "./libraries";
import { type IndexedAlbum } from "./albums";
import { GalleryPathError } from "../gallery";
import * as schema from "../schema";

export const GALLERY_PAGE_SIZE = 48;
export const TIMELINE_PAGE_SIZE = 48;
export const PHOTOS_PAGE_SIZE = 48;

export interface IndexedGalleryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  coverPath?: string;
  coverUpdatedAt?: string;
  coverSize?: number;
  size?: number;
  updatedAt?: string;
  isFavorite?: boolean;
}

export interface IndexedGalleryPage {
  currentPath: string;
  items: IndexedGalleryItem[];
  breadcrumbs: { name: string; path: string }[];
  totalCount: number;
  folderCount: number;
  imageCount: number;
  page: number;
  pageSize: number;
  search: string;
}

export interface IndexedPhoto {
  name: string;
  path: string;
  size: number | null;
  modifiedAt: string | null;
  width?: number | null;
  height?: number | null;
  isFavorite?: boolean;
}

export interface IndexedTimelinePage {
  items: IndexedPhoto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface IndexedSearchResults {
  photos: IndexedPhoto[];
  albums: IndexedAlbum[];
}

function getAlbumCovers(libraryId: number, albumPaths: string[]) {
  if (!albumPaths.length)
    return new Map<
      string,
      { name: string; size: number | null; modifiedAt: string | null }
    >();
  const rows = getDatabase()
    .select({
      parentPath: schema.libraryEntries.parentPath,
      name: schema.libraryEntries.name,
      size: schema.libraryEntries.size,
      modifiedAt: schema.libraryEntries.modifiedAt,
    })
    .from(schema.libraryEntries)
    .where(
      sql`${schema.libraryEntries.libraryId} = ${libraryId}
        AND ${schema.libraryEntries.kind} = 'image'
        AND ${inArray(schema.libraryEntries.parentPath, albumPaths)}`,
    )
    .orderBy(sql`lower(${schema.libraryEntries.name})`)
    .all();
  const covers = new Map<
    string,
    { name: string; size: number | null; modifiedAt: string | null }
  >();
  for (const row of rows) {
    if (!covers.has(row.parentPath)) {
      covers.set(row.parentPath, {
        name: row.name,
        size: row.size,
        modifiedAt: row.modifiedAt,
      });
    }
  }
  return covers;
}

export function searchIndexedLibrary(
  libraryId: number,
  search: string,
): IndexedSearchResults {
  const db = getDatabase();
  if (!getLibrary(libraryId)) {
    throw new GalleryPathError("Library not found.", 404);
  }
  const query = search.trim();
  if (!query) return { photos: [], albums: [] };

  const cleanQuery = query.replace(/^#+/, "");

  const photos = db
    .select({
      name: schema.libraryEntries.name,
      path: schema.libraryEntries.path,
      size: schema.libraryEntries.size,
      modifiedAt: schema.libraryEntries.modifiedAt,
    })
    .from(schema.libraryEntries)
    .where(
      sql`${schema.libraryEntries.libraryId} = ${libraryId}
        AND ${schema.libraryEntries.kind} = 'image'
        AND (
          instr(lower(${schema.libraryEntries.name}), lower(${cleanQuery})) > 0
          OR ${schema.libraryEntries.path} IN (
            SELECT pt.entry_path FROM photo_tags pt
            JOIN tags t ON t.id = pt.tag_id
            WHERE pt.library_id = ${libraryId} AND instr(lower(t.name), lower(${cleanQuery})) > 0
          )
          OR ${schema.libraryEntries.path} IN (
            SELECT pum.entry_path FROM photo_user_metadata pum
            WHERE pum.library_id = ${libraryId} AND instr(lower(pum.caption), lower(${cleanQuery})) > 0
          )
        )`,
    )
    .orderBy(
      sql`${schema.libraryEntries.modifiedAt} IS NULL`,
      desc(schema.libraryEntries.modifiedAt),
    )
    .limit(6)
    .all();

  const albumRows = db
    .select({
      path: schema.libraryEntries.parentPath,
      photoCount: count(),
      coverName: sql<string>`min(${schema.libraryEntries.name})`,
      updatedAt: sql<string | null>`max(${schema.libraryEntries.modifiedAt})`,
    })
    .from(schema.libraryEntries)
    .where(
      sql`${schema.libraryEntries.libraryId} = ${libraryId}
        AND ${schema.libraryEntries.kind} = 'image'
        AND ${schema.libraryEntries.parentPath} != ''
        AND instr(lower(${schema.libraryEntries.parentPath}), lower(${query})) > 0`,
    )
    .groupBy(schema.libraryEntries.parentPath)
    .orderBy(desc(sql`max(${schema.libraryEntries.modifiedAt})`))
    .limit(4)
    .all();
  const covers = getAlbumCovers(
    libraryId,
    albumRows.map((album) => album.path),
  );
  const albums = albumRows.map((album) => ({
    name: path.posix.basename(album.path),
    path: album.path,
    photoCount: album.photoCount,
    coverPath: path.posix.join(
      album.path,
      covers.get(album.path)?.name ?? album.coverName,
    ),
    coverModifiedAt: covers.get(album.path)?.modifiedAt ?? null,
    coverSize: covers.get(album.path)?.size ?? null,
    updatedAt: album.updatedAt,
  }));

  return { photos, albums };
}

export function getIndexedTimelinePage(
  libraryId: number,
  requestedPage = 1,
  search = "",
): IndexedTimelinePage {
  const db = getDatabase();
  if (!getLibrary(libraryId)) {
    throw new GalleryPathError("Library not found.", 404);
  }

  const query = search.trim();
  const conditions = sql`${schema.libraryEntries.libraryId} = ${libraryId}
    AND ${schema.libraryEntries.kind} = 'image'
    AND instr(lower(${schema.libraryEntries.name}), lower(${query})) > 0`;
  const totalCount =
    db
      .select({ count: count() })
      .from(schema.libraryEntries)
      .where(conditions)
      .get()?.count ?? 0;
  const pageSize = TIMELINE_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.max(
    1,
    Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1,
  );
  if (page > pageCount) {
    return { items: [], totalCount, page, pageSize };
  }
  const rows = db
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
      sql`${schema.libraryEntries.modifiedAt} IS NULL`,
      desc(schema.libraryEntries.modifiedAt),
      sql`lower(${schema.libraryEntries.path})`,
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  return { items: rows, totalCount, page, pageSize };
}

export const getIndexedPhotosPage = getIndexedTimelinePage;
export type IndexedPhotosPage = IndexedTimelinePage;

export function getIndexedGalleryContents(
  libraryId: number,
  subPath = "",
  requestedPage = 1,
  search = "",
  sort: "name-asc" | "name-desc" | "modified-desc" = "name-asc",
): IndexedGalleryPage {
  const db = getDatabase();
  const library = getLibrary(libraryId);
  if (!library) throw new GalleryPathError("Library not found.", 404);

  const normalizedPath = subPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const exists = normalizedPath
    ? db
        .select({ kind: schema.libraryEntries.kind })
        .from(schema.libraryEntries)
        .where(
          sql`${schema.libraryEntries.libraryId} = ${libraryId}
            AND ${schema.libraryEntries.path} = ${normalizedPath}`,
        )
        .get()
    : { kind: "directory" };
  if (!exists || exists.kind !== "directory") {
    throw new GalleryPathError("Folder not found in the library index.", 404);
  }

  const query = search.trim();
  const conditions = sql`${schema.libraryEntries.libraryId} = ${libraryId}
    AND ${schema.libraryEntries.parentPath} = ${normalizedPath}
    AND instr(lower(${schema.libraryEntries.name}), lower(${query})) > 0`;
  const countRows = db
    .select({
      kind: schema.libraryEntries.kind,
      count: count(),
    })
    .from(schema.libraryEntries)
    .where(conditions)
    .groupBy(schema.libraryEntries.kind)
    .all();
  const folderCount =
    countRows.find((row) => row.kind === "directory")?.count ?? 0;
  const imageCount = countRows.find((row) => row.kind === "image")?.count ?? 0;
  const totalCount = folderCount + imageCount;
  const pageSize = GALLERY_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.max(
    1,
    Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1,
  );
  if (page > pageCount && totalCount > 0) {
    const breadcrumbs = [{ name: library.name, path: "" }];
    const segments = normalizedPath.split("/").filter(Boolean);
    let accumulatedPath = "";
    for (const segment of segments) {
      accumulatedPath = path.posix.join(accumulatedPath, segment);
      breadcrumbs.push({ name: segment, path: accumulatedPath });
    }
    return {
      currentPath: normalizedPath,
      items: [],
      breadcrumbs,
      totalCount,
      folderCount,
      imageCount,
      page,
      pageSize,
      search: query,
    };
  }
  const rows = db
    .select()
    .from(schema.libraryEntries)
    .where(conditions)
    .orderBy(
      sql`CASE ${schema.libraryEntries.kind} WHEN 'directory' THEN 0 ELSE 1 END`,
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

  const directories = rows.filter((row) => row.kind === "directory");
  const covers =
    directories.length > 0
      ? db
          .select({
            parentPath: schema.libraryEntries.parentPath,
            name: schema.libraryEntries.name,
            modifiedAt: schema.libraryEntries.modifiedAt,
            size: schema.libraryEntries.size,
          })
          .from(schema.libraryEntries)
          .where(
            sql`${schema.libraryEntries.libraryId} = ${libraryId}
              AND ${schema.libraryEntries.kind} = 'image'
              AND ${inArray(
                schema.libraryEntries.parentPath,
                directories.map((directory) => directory.path),
              )}`,
          )
          .orderBy(sql`lower(${schema.libraryEntries.name})`)
          .all()
      : [];
  const coverByDirectory = new Map<
    string,
    { name: string; modifiedAt: string | null; size: number | null }
  >();
  for (const cover of covers) {
    if (!coverByDirectory.has(cover.parentPath)) {
      coverByDirectory.set(cover.parentPath, {
        name: cover.name,
        modifiedAt: cover.modifiedAt,
        size: cover.size,
      });
    }
  }

  const breadcrumbs = [{ name: library.name, path: "" }];
  const segments = normalizedPath.split("/").filter(Boolean);
  let accumulatedPath = "";
  for (const segment of segments) {
    accumulatedPath = path.posix.join(accumulatedPath, segment);
    breadcrumbs.push({ name: segment, path: accumulatedPath });
  }

  const favoriteEntries = new Set(
    db
      .select({ entryPath: schema.photoUserMetadata.entryPath })
      .from(schema.photoUserMetadata)
      .where(
        sql`${schema.photoUserMetadata.libraryId} = ${libraryId} AND ${schema.photoUserMetadata.isFavorite} = 1`,
      )
      .all()
      .map((r) => r.entryPath),
  );

  return {
    currentPath: normalizedPath,
    items: rows.map((row) => ({
      name: row.name,
      path: row.path,
      isDirectory: row.kind === "directory",
      ...(row.kind === "image"
        ? { isFavorite: favoriteEntries.has(row.path) }
        : {}),
      ...(coverByDirectory.has(row.path)
        ? {
            coverPath: path.posix.join(
              row.path,
              coverByDirectory.get(row.path)!.name,
            ),
            ...(coverByDirectory.get(row.path)!.modifiedAt
              ? { coverUpdatedAt: coverByDirectory.get(row.path)!.modifiedAt! }
              : {}),
            ...(coverByDirectory.get(row.path)!.size !== null
              ? { coverSize: coverByDirectory.get(row.path)!.size! }
              : {}),
          }
        : {}),
      ...(row.size !== null ? { size: row.size } : {}),
      ...(row.modifiedAt ? { updatedAt: row.modifiedAt } : {}),
    })),
    breadcrumbs,
    totalCount,
    folderCount,
    imageCount,
    page,
    pageSize,
    search: query,
  };
}

export function hasDirectoryEntries(libraryId: number, paths: string[]): boolean {
  if (!paths || paths.length === 0) return false;
  const db = getDatabase();
  const dirRow = db
    .select({ path: schema.libraryEntries.path })
    .from(schema.libraryEntries)
    .where(
      sql`${schema.libraryEntries.libraryId} = ${libraryId}
        AND ${inArray(schema.libraryEntries.path, paths)}
        AND ${schema.libraryEntries.kind} = 'directory'`,
    )
    .limit(1)
    .get();
  return Boolean(dirRow);
}

