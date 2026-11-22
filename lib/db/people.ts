import { eq, sql } from "drizzle-orm";
import { getDatabase } from "./client";
import * as schema from "../schema";

export interface PersonItem {
  id: number;
  name: string;
  count: number;
  coverPath: string | null;
}

export function getAllPeople(libraryId?: number): PersonItem[] {
  const db = getDatabase();
  if (libraryId) {
    const rows = db.all<{
      id: number;
      name: string;
      count: number;
      cover_path: string | null;
    }>(sql`
      SELECT p.id, p.name, COUNT(pp.id) as count,
             COALESCE(p.cover_entry_path, (
               SELECT pp2.entry_path FROM photo_people pp2
               JOIN library_entries le ON le.library_id = pp2.library_id AND le.path = pp2.entry_path
               WHERE pp2.person_id = p.id AND pp2.library_id = ${libraryId}
               ORDER BY pp2.id DESC LIMIT 1
             )) as cover_path
      FROM people p
      JOIN photo_people pp ON pp.person_id = p.id
      JOIN library_entries le ON le.library_id = pp.library_id AND le.path = pp.entry_path
      WHERE pp.library_id = ${libraryId}
      GROUP BY p.id, p.name
      ORDER BY count DESC, p.name ASC
    `);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      count: r.count,
      coverPath: r.cover_path,
    }));
  }

  const rows = db.all<{
    id: number;
    name: string;
    count: number;
    cover_path: string | null;
  }>(sql`
    SELECT p.id, p.name, COUNT(pp.id) as count,
           p.cover_entry_path as cover_path
    FROM people p
    LEFT JOIN photo_people pp ON pp.person_id = p.id
    GROUP BY p.id, p.name
    ORDER BY count DESC, p.name ASC
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    count: r.count,
    coverPath: r.cover_path,
  }));
}

export function getPhotoPeople(
  libraryId: number,
  entryPath: string,
): { id: number; name: string }[] {
  const db = getDatabase();
  const normalized = entryPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const rows = db.all<{ id: number; name: string }>(sql`
    SELECT p.id, p.name
    FROM people p
    JOIN photo_people pp ON pp.person_id = p.id
    WHERE pp.library_id = ${libraryId} AND pp.entry_path = ${normalized}
    ORDER BY p.name ASC
  `);
  return rows;
}

export function getOrCreatePerson(rawName: string): { id: number; name: string } {
  const db = getDatabase();
  const trimmed = rawName.trim();
  if (!trimmed) throw new Error("Person name cannot be empty.");

  // Case-insensitive lookup
  const existing = db
    .select({ id: schema.people.id, name: schema.people.name })
    .from(schema.people)
    .where(sql`lower(${schema.people.name}) = ${trimmed.toLowerCase()}`)
    .get();

  if (existing) return existing;

  const now = new Date().toISOString();
  const inserted = db
    .insert(schema.people)
    .values({
      name: trimmed,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: schema.people.id, name: schema.people.name })
    .get();

  return inserted;
}

export function addPersonToPhoto(
  libraryId: number,
  entryPath: string,
  personName: string,
): { person: { id: number; name: string } } {
  const db = getDatabase();
  const normalized = entryPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const person = getOrCreatePerson(personName);
  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.insert(schema.photoPeople)
      .values({
        libraryId,
        entryPath: normalized,
        personId: person.id,
        createdAt: now,
      })
      .onConflictDoNothing()
      .run();

    // Mark isPeopleEdited = 1 to protect manual edits from rescan overwrite
    tx.insert(schema.photoUserMetadata)
      .values({
        libraryId,
        entryPath: normalized,
        isPeopleEdited: 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.photoUserMetadata.libraryId,
          schema.photoUserMetadata.entryPath,
        ],
        set: {
          isPeopleEdited: 1,
          updatedAt: now,
        },
      })
      .run();
  });

  return { person };
}

export function removePersonFromPhoto(
  libraryId: number,
  entryPath: string,
  personId: number,
): void {
  const db = getDatabase();
  const normalized = entryPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.delete(schema.photoPeople)
      .where(
        sql`${schema.photoPeople.libraryId} = ${libraryId} AND ${schema.photoPeople.entryPath} = ${normalized} AND ${schema.photoPeople.personId} = ${personId}`,
      )
      .run();

    // Mark isPeopleEdited = 1 to protect manual edits from rescan overwrite
    tx.insert(schema.photoUserMetadata)
      .values({
        libraryId,
        entryPath: normalized,
        isPeopleEdited: 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.photoUserMetadata.libraryId,
          schema.photoUserMetadata.entryPath,
        ],
        set: {
          isPeopleEdited: 1,
          updatedAt: now,
        },
      })
      .run();
  });
}

export function setPhotoPeople(
  libraryId: number,
  entryPath: string,
  personNames: string[],
): { id: number; name: string }[] {
  const db = getDatabase();
  const normalized = entryPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const now = new Date().toISOString();

  return db.transaction((tx) => {
    // Delete existing associations
    tx.delete(schema.photoPeople)
      .where(
        sql`${schema.photoPeople.libraryId} = ${libraryId} AND ${schema.photoPeople.entryPath} = ${normalized}`,
      )
      .run();

    const result: { id: number; name: string }[] = [];
    const seen = new Set<string>();

    for (const name of personNames) {
      const clean = name.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      let person = tx
        .select({ id: schema.people.id, name: schema.people.name })
        .from(schema.people)
        .where(sql`lower(${schema.people.name}) = ${key}`)
        .get();

      if (!person) {
        person = tx
          .insert(schema.people)
          .values({
            name: clean,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: schema.people.id, name: schema.people.name })
          .get();
      }

      tx.insert(schema.photoPeople)
        .values({
          libraryId,
          entryPath: normalized,
          personId: person.id,
          createdAt: now,
        })
        .onConflictDoNothing()
        .run();

      result.push(person);
    }

    // Mark isPeopleEdited = 1
    tx.insert(schema.photoUserMetadata)
      .values({
        libraryId,
        entryPath: normalized,
        isPeopleEdited: 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.photoUserMetadata.libraryId,
          schema.photoUserMetadata.entryPath,
        ],
        set: {
          isPeopleEdited: 1,
          updatedAt: now,
        },
      })
      .run();

    return result;
  });
}

export function addPeopleToPhotosBatch(
  libraryId: number,
  entryPaths: string[],
  personNames: string[],
): { addedCount: number } {
  if (entryPaths.length === 0 || personNames.length === 0) {
    return { addedCount: 0 };
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  return db.transaction((tx) => {
    let count = 0;
    const resolvedPeople: { id: number; name: string }[] = [];

    for (const name of personNames) {
      const clean = name.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();

      let person = tx
        .select({ id: schema.people.id, name: schema.people.name })
        .from(schema.people)
        .where(sql`lower(${schema.people.name}) = ${key}`)
        .get();

      if (!person) {
        person = tx
          .insert(schema.people)
          .values({
            name: clean,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: schema.people.id, name: schema.people.name })
          .get();
      }

      resolvedPeople.push(person);
    }

    for (const path of entryPaths) {
      const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
      for (const p of resolvedPeople) {
        tx.insert(schema.photoPeople)
          .values({
            libraryId,
            entryPath: normalized,
            personId: p.id,
            createdAt: now,
          })
          .onConflictDoNothing()
          .run();
        count++;
      }

      // Mark isPeopleEdited = 1 for each photo in the batch
      tx.insert(schema.photoUserMetadata)
        .values({
          libraryId,
          entryPath: normalized,
          isPeopleEdited: 1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            schema.photoUserMetadata.libraryId,
            schema.photoUserMetadata.entryPath,
          ],
          set: {
            isPeopleEdited: 1,
            updatedAt: now,
          },
        })
        .run();
    }

    return { addedCount: count };
  });
}

export function updatePerson(
  id: number,
  updates: { name?: string; coverEntryPath?: string | null },
): void {
  const db = getDatabase();
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.name && updates.name.trim()) {
    patch.name = updates.name.trim();
  }
  if (updates.coverEntryPath !== undefined) {
    patch.coverEntryPath = updates.coverEntryPath;
  }

  db.update(schema.people)
    .set(patch)
    .where(eq(schema.people.id, id))
    .run();
}

export function deletePerson(id: number): void {
  const db = getDatabase();
  db.delete(schema.people).where(eq(schema.people.id, id)).run();
}

/**
 * Automatically migrates existing legacy tags like `people/John` or `person/Jane`
 * into the first-class `people` and `photo_people` tables.
 */
export function migrateLegacyPeopleTags(): void {
  const db = getDatabase();
  try {
    const legacyTags = db.all<{ id: number; name: string }>(sql`
      SELECT id, name FROM tags
      WHERE lower(name) LIKE 'people/%'
         OR lower(name) LIKE 'person/%'
         OR lower(name) LIKE 'people:%'
         OR lower(name) LIKE 'person:%'
    `);

    if (legacyTags.length === 0) return;

    const now = new Date().toISOString();

    db.transaction((tx) => {
      for (const t of legacyTags) {
        const cleanName = t.name.replace(/^(people|person)[/|:]\s*/i, "").trim();
        if (!cleanName) continue;

        let person = tx
          .select({ id: schema.people.id })
          .from(schema.people)
          .where(sql`lower(${schema.people.name}) = ${cleanName.toLowerCase()}`)
          .get();

        if (!person) {
          person = tx
            .insert(schema.people)
            .values({
              name: cleanName,
              createdAt: now,
              updatedAt: now,
            })
            .returning({ id: schema.people.id })
            .get();
        }

        // Copy associations from photo_tags to photo_people
        tx.run(sql`
          INSERT OR IGNORE INTO photo_people (library_id, entry_path, person_id, created_at)
          SELECT library_id, entry_path, ${person.id}, ${now}
          FROM photo_tags
          WHERE tag_id = ${t.id}
        `);
      }
    });
  } catch (err) {
    console.warn("[People] Migration of legacy people tags skipped:", err);
  }
}
