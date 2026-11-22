import { eq, sql } from "drizzle-orm";
import { getDatabase } from "./client";
import { getPhotoPeople } from "./people";
import { extractEmbeddedPhotoData } from "../gallery-metadata";
import * as schema from "../schema";

export interface TagItem {
  id: number;
  name: string;
  count: number;
}

export function getAllTags(libraryId?: number): TagItem[] {
  const db = getDatabase();
  if (libraryId) {
    const rows = db.all<{ id: number; name: string; count: number }>(sql`
      SELECT t.id, t.name, COUNT(pt.id) as count
      FROM tags t
      JOIN photo_tags pt ON pt.tag_id = t.id
      WHERE pt.library_id = ${libraryId}
      GROUP BY t.id, t.name
      ORDER BY t.name ASC
    `);
    return rows;
  }

  const rows = db.all<{ id: number; name: string; count: number }>(sql`
    SELECT t.id, t.name, COUNT(pt.id) as count
    FROM tags t
    LEFT JOIN photo_tags pt ON pt.tag_id = t.id
    GROUP BY t.id, t.name
    ORDER BY t.name ASC
  `);
  return rows;
}

export function getPhotoTags(
  libraryId: number,
  entryPath: string,
): { id: number; name: string }[] {
  const db = getDatabase();
  const normalized = entryPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const rows = db.all<{ id: number; name: string }>(sql`
    SELECT t.id, t.name
    FROM tags t
    JOIN photo_tags pt ON pt.tag_id = t.id
    WHERE pt.library_id = ${libraryId} AND (pt.entry_path = ${entryPath} OR pt.entry_path = ${normalized})
    ORDER BY t.name ASC
  `);
  return rows;
}

export function addTagToPhotos(
  libraryId: number,
  entryPaths: string[],
  rawTagName: string,
): { tag: { id: number; name: string }; affected: number } {
  const cleanedName = rawTagName.trim().replace(/^#+/, "").toLowerCase();
  if (!cleanedName) {
    throw new Error("Tag name cannot be empty.");
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  let tagRow = db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.name, cleanedName))
    .get();

  if (!tagRow) {
    const inserted = db
      .insert(schema.tags)
      .values({ name: cleanedName, createdAt: now })
      .returning({ id: schema.tags.id, name: schema.tags.name })
      .get();
    tagRow = inserted;
  }

  const tagId = tagRow.id;
  let affected = 0;

  db.transaction((tx) => {
    for (const p of entryPaths) {
      const normalized = p.replace(/\\/g, "/").replace(/^\/+/, "");
      const res = tx
        .insert(schema.photoTags)
        .values({
          libraryId,
          entryPath: normalized,
          tagId,
          createdAt: now,
        })
        .onConflictDoNothing()
        .run();
      if (res.changes > 0) affected++;

      // Mark isTagsEdited = 1 for this photo
      tx.insert(schema.photoUserMetadata)
        .values({
          libraryId,
          entryPath: normalized,
          isTagsEdited: 1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            schema.photoUserMetadata.libraryId,
            schema.photoUserMetadata.entryPath,
          ],
          set: {
            isTagsEdited: 1,
            updatedAt: now,
          },
        })
        .run();
    }
  });

  return { tag: tagRow, affected };
}

export function removeTagFromPhoto(
  libraryId: number,
  entryPath: string,
  tagId: number,
): void {
  const db = getDatabase();
  const normalized = entryPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.delete(schema.photoTags)
      .where(
        sql`${schema.photoTags.libraryId} = ${libraryId}
          AND ${schema.photoTags.entryPath} = ${normalized}
          AND ${schema.photoTags.tagId} = ${tagId}`,
      )
      .run();

    // Mark isTagsEdited = 1
    tx.insert(schema.photoUserMetadata)
      .values({
        libraryId,
        entryPath: normalized,
        isTagsEdited: 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.photoUserMetadata.libraryId,
          schema.photoUserMetadata.entryPath,
        ],
        set: {
          isTagsEdited: 1,
          updatedAt: now,
        },
      })
      .run();
  });
}

export interface PhotoUserMetadataResult {
  isFavorite: boolean;
  caption: string | null;
  rating: number;
  tags: { id: number; name: string }[];
  people?: { id: number; name: string }[];
  isCaptionEdited: boolean;
  isRatingEdited: boolean;
  isTagsEdited: boolean;
  isPeopleEdited: boolean;
}

export function getPhotoUserMetadata(
  libraryId: number,
  entryPath: string,
): PhotoUserMetadataResult {
  const db = getDatabase();
  const normalized = entryPath.replace(/\\/g, "/").replace(/^\/+/, "");

  const row = db
    .select()
    .from(schema.photoUserMetadata)
    .where(
      sql`${schema.photoUserMetadata.libraryId} = ${libraryId} AND ${schema.photoUserMetadata.entryPath} = ${normalized}`,
    )
    .get();

  const tags = getPhotoTags(libraryId, normalized);
  const people = getPhotoPeople(libraryId, normalized);

  return {
    isFavorite: Boolean(row?.isFavorite),
    caption: row?.caption ?? null,
    rating: row?.rating ?? 0,
    tags,
    people,
    isCaptionEdited: Boolean(row?.isCaptionEdited),
    isRatingEdited: Boolean(row?.isRatingEdited),
    isTagsEdited: Boolean(row?.isTagsEdited),
    isPeopleEdited: Boolean(row?.isPeopleEdited),
  };
}

export function setPhotoUserMetadata(
  libraryId: number,
  entryPath: string,
  updates: { isFavorite?: boolean; caption?: string | null; rating?: number },
): PhotoUserMetadataResult {
  const db = getDatabase();
  const normalized = entryPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const now = new Date().toISOString();

  const existing = db
    .select()
    .from(schema.photoUserMetadata)
    .where(
      sql`${schema.photoUserMetadata.libraryId} = ${libraryId} AND ${schema.photoUserMetadata.entryPath} = ${normalized}`,
    )
    .get();

  const isFavorite =
    updates.isFavorite !== undefined
      ? updates.isFavorite
        ? 1
        : 0
      : (existing?.isFavorite ?? 0);
  const caption =
    updates.caption !== undefined
      ? updates.caption
      : (existing?.caption ?? null);
  const rating =
    updates.rating !== undefined ? updates.rating : (existing?.rating ?? 0);

  const isCaptionEdited =
    updates.caption !== undefined ? 1 : (existing?.isCaptionEdited ?? 0);
  const isRatingEdited =
    updates.rating !== undefined ? 1 : (existing?.isRatingEdited ?? 0);
  const isTagsEdited = existing?.isTagsEdited ?? 0;
  const isPeopleEdited = existing?.isPeopleEdited ?? 0;

  db.insert(schema.photoUserMetadata)
    .values({
      libraryId,
      entryPath: normalized,
      isFavorite,
      caption,
      rating,
      isCaptionEdited,
      isRatingEdited,
      isTagsEdited,
      isPeopleEdited,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.photoUserMetadata.libraryId,
        schema.photoUserMetadata.entryPath,
      ],
      set: {
        isFavorite,
        caption,
        rating,
        isCaptionEdited,
        isRatingEdited,
        isTagsEdited,
        isPeopleEdited,
        updatedAt: now,
      },
    })
    .run();

  return getPhotoUserMetadata(libraryId, normalized);
}

export function togglePhotoFavorite(
  libraryId: number,
  entryPath: string,
): boolean {
  const current = getPhotoUserMetadata(libraryId, entryPath);
  const updated = setPhotoUserMetadata(libraryId, entryPath, {
    isFavorite: !current.isFavorite,
  });
  return updated.isFavorite;
}

export interface ScannedImageFile {
  relativePath: string;
  absolutePath: string;
}

export function getExistingPhotoMetadataIndex(
  libraryId: number,
): Map<
  string,
  { size: number | null; modifiedAt: string | null; width: number | null }
> {
  const db = getDatabase();
  const rows = db.all<{
    path: string;
    size: number | null;
    modified_at: string | null;
    width: number | null;
  }>(sql`
    SELECT le.path, le.size, le.modified_at, pm.width
    FROM library_entries le
    JOIN photo_metadata pm ON pm.library_id = le.library_id AND pm.entry_path = le.path
    WHERE le.library_id = ${libraryId} AND le.kind = 'image'
  `);

  const map = new Map<
    string,
    { size: number | null; modifiedAt: string | null; width: number | null }
  >();
  for (const r of rows) {
    map.set(r.path, {
      size: r.size,
      modifiedAt: r.modified_at,
      width: r.width,
    });
  }
  return map;
}

export async function syncScannedImageMetadataBatch(
  libraryId: number,
  items: ScannedImageFile[],
): Promise<number> {
  if (items.length === 0) return 0;

  const db = getDatabase();
  const now = new Date().toISOString();
  let syncedCount = 0;

  for (const item of items) {
    try {
      const data = await extractEmbeddedPhotoData(item.absolutePath);

      db.transaction((tx) => {
        // 1. Technical metadata: upsert into photo_metadata
        tx.insert(schema.photoMetadata)
          .values({
            libraryId,
            entryPath: item.relativePath,
            width: data.width,
            height: data.height,
            capturedAt: data.capturedAt,
            cameraMake: data.cameraMake,
            cameraModel: data.cameraModel,
            lensModel: data.lensModel,
            focalLength: data.focalLength,
            focalLength35mm: data.focalLength35mm,
            aperture: data.aperture,
            shutterSpeed: data.shutterSpeed,
            iso: data.iso,
            latitude: data.latitude,
            longitude: data.longitude,
            altitude: data.altitude,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              schema.photoMetadata.libraryId,
              schema.photoMetadata.entryPath,
            ],
            set: {
              width: data.width,
              height: data.height,
              capturedAt: data.capturedAt,
              cameraMake: data.cameraMake,
              cameraModel: data.cameraModel,
              lensModel: data.lensModel,
              focalLength: data.focalLength,
              focalLength35mm: data.focalLength35mm,
              aperture: data.aperture,
              shutterSpeed: data.shutterSpeed,
              iso: data.iso,
              latitude: data.latitude,
              longitude: data.longitude,
              altitude: data.altitude,
              updatedAt: now,
            },
          })
          .run();

        // 2. User metadata: check per-field edit flags
        const existingUserMeta = tx
          .select()
          .from(schema.photoUserMetadata)
          .where(
            sql`${schema.photoUserMetadata.libraryId} = ${libraryId} AND ${schema.photoUserMetadata.entryPath} = ${item.relativePath}`,
          )
          .get();

        if (existingUserMeta) {
          const updates: Record<string, unknown> = { updatedAt: now };
          // Only update caption if NOT user-edited
          if (!existingUserMeta.isCaptionEdited && data.embeddedCaption) {
            updates.caption = data.embeddedCaption;
          }
          // Only update rating if NOT user-edited
          if (
            !existingUserMeta.isRatingEdited &&
            data.embeddedRating !== null
          ) {
            updates.rating = data.embeddedRating;
          }

          if (Object.keys(updates).length > 1) {
            tx.update(schema.photoUserMetadata)
              .set(updates)
              .where(eq(schema.photoUserMetadata.id, existingUserMeta.id))
              .run();
          }

          // Only sync embedded keywords if NOT user-edited
          if (
            !existingUserMeta.isTagsEdited &&
            data.embeddedKeywords.length > 0
          ) {
            tx.delete(schema.photoTags)
              .where(
                sql`${schema.photoTags.libraryId} = ${libraryId} AND ${schema.photoTags.entryPath} = ${item.relativePath}`,
              )
              .run();

            for (const kw of data.embeddedKeywords) {
              const cleaned = kw.trim().replace(/^#+/, "").toLowerCase();
              if (!cleaned) continue;
              let tagRow = tx
                .select({ id: schema.tags.id })
                .from(schema.tags)
                .where(eq(schema.tags.name, cleaned))
                .get();
              if (!tagRow) {
                tagRow = tx
                  .insert(schema.tags)
                  .values({ name: cleaned, createdAt: now })
                  .returning({ id: schema.tags.id })
                  .get();
              }
              tx.insert(schema.photoTags)
                .values({
                  libraryId,
                  entryPath: item.relativePath,
                  tagId: tagRow.id,
                  createdAt: now,
                })
                .onConflictDoNothing()
                .run();
            }
          }

          // Only sync embedded people if NOT user-edited
          if (
            !existingUserMeta.isPeopleEdited &&
            data.embeddedPeople &&
            data.embeddedPeople.length > 0
          ) {
            tx.delete(schema.photoPeople)
              .where(
                sql`${schema.photoPeople.libraryId} = ${libraryId} AND ${schema.photoPeople.entryPath} = ${item.relativePath}`,
              )
              .run();

            for (const personName of data.embeddedPeople) {
              const clean = personName.trim();
              if (!clean) continue;
              let personRow = tx
                .select({ id: schema.people.id })
                .from(schema.people)
                .where(sql`lower(${schema.people.name}) = ${clean.toLowerCase()}`)
                .get();

              if (!personRow) {
                personRow = tx
                  .insert(schema.people)
                  .values({ name: clean, createdAt: now, updatedAt: now })
                  .returning({ id: schema.people.id })
                  .get();
              }

              tx.insert(schema.photoPeople)
                .values({
                  libraryId,
                  entryPath: item.relativePath,
                  personId: personRow.id,
                  createdAt: now,
                })
                .onConflictDoNothing()
                .run();
            }
          }
        } else {
          // Brand new photo! Initialize with embedded values
          tx.insert(schema.photoUserMetadata)
            .values({
              libraryId,
              entryPath: item.relativePath,
              isFavorite: 0,
              caption: data.embeddedCaption ?? null,
              rating: data.embeddedRating ?? 0,
              isCaptionEdited: 0,
              isRatingEdited: 0,
              isTagsEdited: 0,
              isPeopleEdited: 0,
              updatedAt: now,
            })
            .run();

          if (data.embeddedKeywords.length > 0) {
            for (const kw of data.embeddedKeywords) {
              const cleaned = kw.trim().replace(/^#+/, "").toLowerCase();
              if (!cleaned) continue;
              let tagRow = tx
                .select({ id: schema.tags.id })
                .from(schema.tags)
                .where(eq(schema.tags.name, cleaned))
                .get();
              if (!tagRow) {
                tagRow = tx
                  .insert(schema.tags)
                  .values({ name: cleaned, createdAt: now })
                  .returning({ id: schema.tags.id })
                  .get();
              }
              tx.insert(schema.photoTags)
                .values({
                  libraryId,
                  entryPath: item.relativePath,
                  tagId: tagRow.id,
                  createdAt: now,
                })
                .onConflictDoNothing()
                .run();
            }
          }

          if (data.embeddedPeople && data.embeddedPeople.length > 0) {
            for (const personName of data.embeddedPeople) {
              const clean = personName.trim();
              if (!clean) continue;
              let personRow = tx
                .select({ id: schema.people.id })
                .from(schema.people)
                .where(sql`lower(${schema.people.name}) = ${clean.toLowerCase()}`)
                .get();

              if (!personRow) {
                personRow = tx
                  .insert(schema.people)
                  .values({ name: clean, createdAt: now, updatedAt: now })
                  .returning({ id: schema.people.id })
                  .get();
              }

              tx.insert(schema.photoPeople)
                .values({
                  libraryId,
                  entryPath: item.relativePath,
                  personId: personRow.id,
                  createdAt: now,
                })
                .onConflictDoNothing()
                .run();
            }
          }
        }
      });

      syncedCount++;
    } catch (err) {
      console.warn(
        `[Scanner] Failed to sync metadata for ${item.relativePath}:`,
        err,
      );
    }
  }

  return syncedCount;
}
