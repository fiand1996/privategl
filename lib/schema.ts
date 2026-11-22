import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const libraries = sqliteTable(
  "libraries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    rootPath: text("root_path").notNull(),
    createdAt: text("created_at").notNull(),
    lastScanAt: text("last_scan_at"),
  },
  (table) => [uniqueIndex("libraries_root_path_idx").on(table.rootPath)],
);

export const scanTasks = sqliteTable(
  "scan_tasks",
  {
    id: text("id").primaryKey(),
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["queued", "running", "completed", "failed"],
    }).notNull(),
    scannedEntries: integer("scanned_entries").notNull().default(0),
    createdAt: text("created_at").notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    error: text("error"),
  },
  (table) => [
    index("scan_tasks_queue_idx").on(table.status, table.createdAt),
    index("scan_tasks_library_idx").on(table.libraryId, table.createdAt),
  ],
);

export const libraryEntries = sqliteTable(
  "library_entries",
  {
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    parentPath: text("parent_path").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["directory", "image"] }).notNull(),
    extension: text("extension"),
    size: integer("size"),
    modifiedAt: text("modified_at"),
    scanId: text("scan_id").notNull(),
  },
  (table) => [
    uniqueIndex("library_entries_library_path_idx").on(
      table.libraryId,
      table.path,
    ),
    index("library_entries_browse_idx").on(
      table.libraryId,
      table.parentPath,
      table.kind,
      table.name,
    ),
    index("library_entries_timeline_idx").on(
      table.libraryId,
      table.kind,
      table.modifiedAt,
    ),
    index("library_entries_parent_idx").on(
      table.libraryId,
      table.kind,
      table.parentPath,
    ),
  ],
);

export const albums = sqliteTable(
  "albums",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["folder", "custom"] }).notNull().default("custom"),
    folderPath: text("folder_path"),
    description: text("description"),
    coverEntryPath: text("cover_entry_path"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("albums_library_kind_idx").on(table.libraryId, table.kind),
    uniqueIndex("albums_library_folder_idx").on(table.libraryId, table.folderPath),
  ],
);

export const albumEntries = sqliteTable(
  "album_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    albumId: integer("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    entryPath: text("entry_path").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("album_entries_unique_idx").on(table.albumId, table.entryPath),
    index("album_entries_lookup_idx").on(table.libraryId, table.entryPath),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("tags_name_idx").on(table.name)],
);

export const photoTags = sqliteTable(
  "photo_tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    entryPath: text("entry_path").notNull(),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("photo_tags_entry_tag_idx").on(table.entryPath, table.tagId),
    index("photo_tags_library_entry_idx").on(table.libraryId, table.entryPath),
    index("photo_tags_tag_idx").on(table.tagId),
  ],
);

export const photoUserMetadata = sqliteTable(
  "photo_user_metadata",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    entryPath: text("entry_path").notNull(),
    isFavorite: integer("is_favorite").notNull().default(0),
    caption: text("caption"),
    rating: integer("rating").default(0),
    isCaptionEdited: integer("is_caption_edited").notNull().default(0),
    isRatingEdited: integer("is_rating_edited").notNull().default(0),
    isTagsEdited: integer("is_tags_edited").notNull().default(0),
    isPeopleEdited: integer("is_people_edited").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("photo_user_meta_entry_idx").on(table.libraryId, table.entryPath),
    index("photo_user_meta_fav_idx").on(table.libraryId, table.isFavorite),
  ],
);

export const photoMetadata = sqliteTable(
  "photo_metadata",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    entryPath: text("entry_path").notNull(),
    width: integer("width"),
    height: integer("height"),
    capturedAt: text("captured_at"),
    cameraMake: text("camera_make"),
    cameraModel: text("camera_model"),
    lensModel: text("lens_model"),
    focalLength: text("focal_length"),
    focalLength35mm: text("focal_length_35mm"),
    aperture: text("aperture"),
    shutterSpeed: text("shutter_speed"),
    iso: integer("iso"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    altitude: real("altitude"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("photo_metadata_entry_idx").on(
      table.libraryId,
      table.entryPath,
    ),
    index("photo_metadata_library_captured_idx").on(
      table.libraryId,
      table.capturedAt,
    ),
    index("photo_metadata_camera_idx").on(
      table.libraryId,
      table.cameraMake,
      table.cameraModel,
    ),
  ],
);

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    displayName: text("display_name"),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "viewer"] }).notNull().default("viewer"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("users_username_idx").on(table.username)],
);

export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    coverEntryPath: text("cover_entry_path"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("people_name_idx").on(table.name)],
);

export const photoPeople = sqliteTable(
  "photo_people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    entryPath: text("entry_path").notNull(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("photo_people_entry_person_idx").on(
      table.libraryId,
      table.entryPath,
      table.personId,
    ),
    index("photo_people_library_entry_idx").on(
      table.libraryId,
      table.entryPath,
    ),
    index("photo_people_person_idx").on(table.personId),
  ],
);



