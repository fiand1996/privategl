import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "../schema";

const DATABASE_PATH =
  process.env.GALLERY_DATABASE_PATH ||
  path.join(process.cwd(), "data", "gallery.sqlite");
const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

let database: Database.Database | undefined;
let orm: BetterSQLite3Database<typeof schema> | undefined;

export { DATABASE_PATH };

export function getRawDatabase(): Database.Database {
  if (!database) {
    getDatabase();
  }
  return database!;
}

export function closeDatabase(): void {
  if (database) {
    try {
      database.close();
    } catch {
      // ignore
    }
    database = undefined;
    orm = undefined;
  }
}

export function getDatabase() {
  if (orm) return orm;

  fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
  database = new Database(DATABASE_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.pragma("synchronous = NORMAL");
  database.pragma("cache_size = -64000");
  database.pragma("temp_store = MEMORY");
  database.pragma("mmap_size = 268435456");

  orm = drizzle(database, { schema });
  migrate(orm, { migrationsFolder: MIGRATIONS_FOLDER });

  try {
    // Dynamically import or run one-time legacy people tags migration
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migrateLegacyPeopleTags } = require("./people");
    migrateLegacyPeopleTags();
  } catch (err) {
    console.warn("[Database] Could not run migrateLegacyPeopleTags:", err);
  }

  return orm;
}
