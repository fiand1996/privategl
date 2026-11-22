import { count, desc, sql } from "drizzle-orm";
import { getDatabase } from "./client";
import { getAllPeople } from "./people";
import * as schema from "../schema";

export interface ExploreSummary {
  smartCollections: {
    favorites: { count: number; coverPath: string | null };
    topRated: { count: number; coverPath: string | null };
    places: { count: number; coverPath: string | null };
  };
  people: {
    id: number;
    name: string;
    tagName?: string;
    count: number;
    coverPath: string | null;
  }[];
  tags: { id: number; name: string; count: number; coverPath: string | null }[];
  cameras: {
    cameraMake: string | null;
    cameraModel: string | null;
    displayName: string;
    count: number;
    coverPath: string | null;
  }[];
  years: { year: string; count: number; coverPath: string | null }[];
}

export interface ExploreFilter {
  collection?: "favorites" | "top-rated" | "places";
  tag?: string;
  person?: string;
  camera?: string;
  year?: string;
}

export interface ExplorePhotosResult {
  filter: ExploreFilter;
  filterLabel: string;
  items: (typeof schema.libraryEntries.$inferSelect & {
    isFavorite: boolean;
    capturedAt?: string | null;
  })[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function getExploreSummary(libraryId: number): ExploreSummary {
  const db = getDatabase();

  const favRow = db.get<{ count: number; cover_path: string | null }>(sql`
    SELECT COUNT(pum.id) as count,
           (SELECT pum2.entry_path
            FROM photo_user_metadata pum2
            JOIN library_entries le ON le.library_id = pum2.library_id AND le.path = pum2.entry_path
            WHERE pum2.library_id = ${libraryId} AND pum2.is_favorite = 1
            ORDER BY pum2.id DESC LIMIT 1) as cover_path
    FROM photo_user_metadata pum
    JOIN library_entries le ON le.library_id = pum.library_id AND le.path = pum.entry_path
    WHERE pum.library_id = ${libraryId} AND pum.is_favorite = 1
  `);

  const topRatedRow = db.get<{ count: number; cover_path: string | null }>(sql`
    SELECT COUNT(pum.id) as count,
           (SELECT pum2.entry_path
            FROM photo_user_metadata pum2
            JOIN library_entries le ON le.library_id = pum2.library_id AND le.path = pum2.entry_path
            WHERE pum2.library_id = ${libraryId} AND pum2.rating >= 4
            ORDER BY pum2.rating DESC, pum2.id DESC LIMIT 1) as cover_path
    FROM photo_user_metadata pum
    JOIN library_entries le ON le.library_id = pum.library_id AND le.path = pum.entry_path
    WHERE pum.library_id = ${libraryId} AND pum.rating >= 4
  `);

  const placesRow = db.get<{ count: number; cover_path: string | null }>(sql`
    SELECT COUNT(pm.id) as count,
           (SELECT pm2.entry_path
            FROM photo_metadata pm2
            JOIN library_entries le ON le.library_id = pm2.library_id AND le.path = pm2.entry_path
            WHERE pm2.library_id = ${libraryId} AND pm2.latitude IS NOT NULL
            ORDER BY pm2.id DESC LIMIT 1) as cover_path
    FROM photo_metadata pm
    JOIN library_entries le ON le.library_id = pm.library_id AND le.path = pm.entry_path
    WHERE pm.library_id = ${libraryId} AND pm.latitude IS NOT NULL
  `);

  const tagRows = db.all<{
    id: number;
    name: string;
    count: number;
    cover_path: string | null;
  }>(sql`
    SELECT t.id, t.name, COUNT(pt.id) as count,
           (SELECT pt2.entry_path
            FROM photo_tags pt2
            JOIN library_entries le ON le.library_id = pt2.library_id AND le.path = pt2.entry_path
            WHERE pt2.tag_id = t.id AND pt2.library_id = ${libraryId}
            ORDER BY pt2.id DESC LIMIT 1) as cover_path
    FROM tags t
    JOIN photo_tags pt ON pt.tag_id = t.id
    JOIN library_entries le ON le.library_id = pt.library_id AND le.path = pt.entry_path
    WHERE pt.library_id = ${libraryId}
    GROUP BY t.id, t.name
    ORDER BY count DESC, t.name ASC
  `);

  const people = getAllPeople(libraryId).map((p) => ({
    id: p.id,
    name: p.name,
    tagName: p.name,
    count: p.count,
    coverPath: p.coverPath,
  }));

  const personNamesSet = new Set(people.map((p) => p.name.toLowerCase()));

  const filteredTagRows = tagRows.filter((t) => {
    const isPeoplePrefix = /^(people|person)[/|:]/i.test(t.name.trim());
    if (isPeoplePrefix) return false;
    // Exclude flat tag identical to person name (e.g. "fitaz" vs person "fitaz") to avoid duplicates
    if (personNamesSet.has(t.name.trim().toLowerCase())) return false;
    return true;
  });

  const cameraRows = db.all<{
    camera_make: string | null;
    camera_model: string | null;
    count: number;
    cover_path: string | null;
  }>(sql`
    SELECT pm.camera_make, pm.camera_model, COUNT(pm.id) as count,
           (SELECT pm2.entry_path
            FROM photo_metadata pm2
            JOIN library_entries le ON le.library_id = pm2.library_id AND le.path = pm2.entry_path
            WHERE pm2.library_id = ${libraryId}
              AND coalesce(pm2.camera_make, '') = coalesce(pm.camera_make, '')
              AND coalesce(pm2.camera_model, '') = coalesce(pm.camera_model, '')
            ORDER BY pm2.id DESC LIMIT 1) as cover_path
    FROM photo_metadata pm
    JOIN library_entries le ON le.library_id = pm.library_id AND le.path = pm.entry_path
    WHERE pm.library_id = ${libraryId}
      AND (pm.camera_model IS NOT NULL OR pm.camera_make IS NOT NULL)
    GROUP BY pm.camera_make, pm.camera_model
    ORDER BY count DESC
  `);

  const cameras = cameraRows.map((c) => {
    const make = c.camera_make?.trim() || "";
    const model = c.camera_model?.trim() || "";
    let displayName = model || make || "Unknown Camera";
    if (make && model && !model.toLowerCase().includes(make.toLowerCase())) {
      displayName = `${make} ${model}`;
    }
    return {
      cameraMake: c.camera_make,
      cameraModel: c.camera_model,
      displayName,
      count: c.count,
      coverPath: c.cover_path,
    };
  });

  const yearRows = db.all<{
    year: string;
    count: number;
    cover_path: string | null;
  }>(sql`
    SELECT substr(coalesce(pm.captured_at, le.modified_at), 1, 4) as year,
           COUNT(le.path) as count,
           max(le.path) as cover_path
    FROM library_entries le
    LEFT JOIN photo_metadata pm ON pm.library_id = le.library_id AND pm.entry_path = le.path
    WHERE le.library_id = ${libraryId} AND le.kind = 'image'
    GROUP BY year
    HAVING length(year) = 4 AND year GLOB '[12][0-9][0-9][0-9]'
    ORDER BY year DESC
  `);

  return {
    smartCollections: {
      favorites: {
        count: favRow?.count ?? 0,
        coverPath: favRow?.cover_path ?? null,
      },
      topRated: {
        count: topRatedRow?.count ?? 0,
        coverPath: topRatedRow?.cover_path ?? null,
      },
      places: {
        count: placesRow?.count ?? 0,
        coverPath: placesRow?.cover_path ?? null,
      },
    },
    people,
    tags: filteredTagRows.map((t) => ({
      id: t.id,
      name: t.name,
      count: t.count,
      coverPath: t.cover_path,
    })),
    cameras,
    years: yearRows.map((y) => ({
      year: y.year,
      count: y.count,
      coverPath: y.cover_path,
    })),
  };
}

export function getExplorePhotos(
  libraryId: number,
  filter: ExploreFilter,
  page: number = 1,
  pageSize: number = 48,
): ExplorePhotosResult {
  const db = getDatabase();
  const offset = Math.max(0, (page - 1) * pageSize);

  const conditions = [
    sql`${schema.libraryEntries.libraryId} = ${libraryId}`,
    sql`${schema.libraryEntries.kind} = 'image'`,
  ];

  let filterLabel = "Explore";

  if (filter.collection === "favorites") {
    filterLabel = "Favorites";
    conditions.push(
      sql`EXISTS (SELECT 1 FROM photo_user_metadata pum WHERE pum.library_id = ${libraryId} AND pum.entry_path = ${schema.libraryEntries.path} AND pum.is_favorite = 1)`,
    );
  } else if (filter.collection === "top-rated") {
    filterLabel = "Top Rated";
    conditions.push(
      sql`EXISTS (SELECT 1 FROM photo_user_metadata pum WHERE pum.library_id = ${libraryId} AND pum.entry_path = ${schema.libraryEntries.path} AND pum.rating >= 4)`,
    );
  } else if (filter.collection === "places") {
    filterLabel = "Places";
    conditions.push(
      sql`EXISTS (SELECT 1 FROM photo_metadata pm WHERE pm.library_id = ${libraryId} AND pm.entry_path = ${schema.libraryEntries.path} AND pm.latitude IS NOT NULL)`,
    );
  } else if (filter.person) {
    const rawPerson = filter.person.trim();
    const capitalized = rawPerson
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    filterLabel = `People: ${capitalized}`;

    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM photo_people pp
        JOIN people p ON p.id = pp.person_id
        WHERE pp.library_id = ${libraryId}
          AND pp.entry_path = ${schema.libraryEntries.path}
          AND lower(p.name) = ${rawPerson.toLowerCase()}
      )`,
    );
  } else if (filter.tag) {
    const rawTag = filter.tag.trim();
    const isPeoplePrefix = /^(people|person)[/|:]/i.test(rawTag);
    const cleanedTag = rawTag.replace(/^#+/, "").toLowerCase();

    if (isPeoplePrefix) {
      const personName = cleanedTag.replace(/^(people|person)[/|:]\s*/i, "").trim();
      const capitalized = personName
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      filterLabel = `People: ${capitalized}`;

      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM photo_tags pt
          JOIN tags t ON t.id = pt.tag_id
          WHERE pt.library_id = ${libraryId}
            AND pt.entry_path = ${schema.libraryEntries.path}
            AND (
              lower(t.name) = ${cleanedTag}
              OR lower(t.name) = ${personName}
              OR lower(t.name) = ${"people/" + personName}
              OR lower(t.name) = ${"person/" + personName}
            )
        )`,
      );
    } else {
      filterLabel = `#${cleanedTag}`;
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM photo_tags pt
          JOIN tags t ON t.id = pt.tag_id
          WHERE pt.library_id = ${libraryId}
            AND pt.entry_path = ${schema.libraryEntries.path}
            AND lower(t.name) = ${cleanedTag}
        )`,
      );
    }
  } else if (filter.camera) {
    filterLabel = filter.camera;
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM photo_metadata pm
        WHERE pm.library_id = ${libraryId}
          AND pm.entry_path = ${schema.libraryEntries.path}
          AND (pm.camera_model = ${filter.camera}
            OR (coalesce(pm.camera_make, '') || ' ' || coalesce(pm.camera_model, '')) = ${filter.camera})
      )`,
    );
  } else if (filter.year) {
    filterLabel = `Year ${filter.year}`;
    conditions.push(
      sql`substr(coalesce((SELECT pm.captured_at FROM photo_metadata pm WHERE pm.library_id = ${libraryId} AND pm.entry_path = ${schema.libraryEntries.path}), ${schema.libraryEntries.modifiedAt}), 1, 4) = ${filter.year}`,
    );
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const totalCountRow = db
    .select({ count: count() })
    .from(schema.libraryEntries)
    .where(whereClause)
    .get();

  const totalCount = totalCountRow?.count ?? 0;

  const rows = db
    .select({
      libraryId: schema.libraryEntries.libraryId,
      path: schema.libraryEntries.path,
      parentPath: schema.libraryEntries.parentPath,
      name: schema.libraryEntries.name,
      kind: schema.libraryEntries.kind,
      extension: schema.libraryEntries.extension,
      size: schema.libraryEntries.size,
      modifiedAt: schema.libraryEntries.modifiedAt,
      scanId: schema.libraryEntries.scanId,
      width: sql<number | null>`(SELECT pm.width FROM photo_metadata pm WHERE pm.library_id = ${libraryId} AND pm.entry_path = ${schema.libraryEntries.path})`,
      height: sql<number | null>`(SELECT pm.height FROM photo_metadata pm WHERE pm.library_id = ${libraryId} AND pm.entry_path = ${schema.libraryEntries.path})`,
      isFavorite: sql<boolean>`coalesce((SELECT pum.is_favorite FROM photo_user_metadata pum WHERE pum.library_id = ${libraryId} AND pum.entry_path = ${schema.libraryEntries.path}), 0) = 1`,
      capturedAt: sql<
        string | null
      >`(SELECT pm.captured_at FROM photo_metadata pm WHERE pm.library_id = ${libraryId} AND pm.entry_path = ${schema.libraryEntries.path})`,
    })
    .from(schema.libraryEntries)
    .where(whereClause)
    .orderBy(
      desc(
        sql`coalesce((SELECT pm.captured_at FROM photo_metadata pm WHERE pm.library_id = ${libraryId} AND pm.entry_path = ${schema.libraryEntries.path}), ${schema.libraryEntries.modifiedAt})`,
      ),
    )
    .limit(pageSize)
    .offset(offset)
    .all();

  return {
    filter,
    filterLabel,
    items: rows,
    totalCount,
    page,
    pageSize,
  };
}
