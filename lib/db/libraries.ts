import { count, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "./client";
import { mapTask, type ScanTask } from "./tasks";
import { getDefaultLibraryRoot, validateLibraryRoot } from "../library-service";
import * as schema from "../schema";

export interface Library {
  id: number;
  name: string;
  rootPath: string;
  createdAt: string;
  lastScanAt: string | null;
  imageCount: number;
  folderCount: number;
  totalSizeBytes: number;
  activeTask: ScanTask | null;
  isDefault: boolean;
}

export function getLibrary(libraryId: number) {
  return getDatabase()
    .select()
    .from(schema.libraries)
    .where(eq(schema.libraries.id, libraryId))
    .get();
}

export function createLibrary(name: string, rootPath: string) {
  const [library] = getDatabase()
    .insert(schema.libraries)
    .values({ name, rootPath, createdAt: new Date().toISOString() })
    .returning({ id: schema.libraries.id })
    .all();
  return library.id;
}

export function updateLibrary(
  libraryId: number,
  name: string,
  newRootPath?: string,
): { id: number; pathChanged: boolean } {
  const db = getDatabase();
  const library = getLibrary(libraryId);
  if (!library) throw new Error("Library not found.");

  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 100) {
    throw new Error("Library name must be between 1 and 100 characters.");
  }

  let pathChanged = false;
  let finalRootPath = library.rootPath;

  if (newRootPath && newRootPath.trim() && newRootPath.trim() !== library.rootPath) {
    const validated = validateLibraryRoot(newRootPath.trim());
    if (validated !== library.rootPath) {
      const existing = findLibraryByRoot(validated);
      if (existing && existing.id !== libraryId) {
        throw new Error("That folder is already registered as another library.");
      }
      finalRootPath = validated;
      pathChanged = true;
    }
  }

  db.transaction((tx) => {
    if (pathChanged) {
      // Clear previously indexed entries for this library because the underlying folder changed
      tx.delete(schema.libraryEntries)
        .where(eq(schema.libraryEntries.libraryId, libraryId))
        .run();
    }
    tx.update(schema.libraries)
      .set({
        name: trimmedName,
        rootPath: finalRootPath,
      })
      .where(eq(schema.libraries.id, libraryId))
      .run();
  });

  return { id: libraryId, pathChanged };
}

export function deleteLibrary(libraryId: number): void {
  const db = getDatabase();
  const library = getLibrary(libraryId);
  if (!library) throw new Error("Library not found.");

  const defaultRoot = getDefaultLibraryRoot();
  if (defaultRoot && library.rootPath === defaultRoot) {
    throw new Error("Default library cannot be deleted.");
  }

  const all = db.select({ id: schema.libraries.id }).from(schema.libraries).all();
  if (all.length <= 1) {
    throw new Error("Cannot delete the only remaining library.");
  }

  db.delete(schema.libraries).where(eq(schema.libraries.id, libraryId)).run();
}

export function findLibraryByRoot(rootPath: string) {
  return getDatabase()
    .select({ id: schema.libraries.id })
    .from(schema.libraries)
    .where(eq(schema.libraries.rootPath, rootPath))
    .get();
}

export function getLibraryList(): Library[] {
  const db = getDatabase();
  const defaultRoot = getDefaultLibraryRoot();
  const libraryRows = db
    .select()
    .from(schema.libraries)
    .orderBy(sql`lower(${schema.libraries.name})`)
    .all();
  const entries = db
    .select({
      libraryId: schema.libraryEntries.libraryId,
      kind: schema.libraryEntries.kind,
      count: count(),
      totalSizeBytes: sql<number>`coalesce(sum(${schema.libraryEntries.size}), 0)`,
    })
    .from(schema.libraryEntries)
    .groupBy(schema.libraryEntries.libraryId, schema.libraryEntries.kind)
    .all();
  const activeTasks = db
    .select()
    .from(schema.scanTasks)
    .where(inArray(schema.scanTasks.status, ["queued", "running"]))
    .orderBy(schema.scanTasks.createdAt)
    .all();

  // Find lowest ID to treat as fallback default if defaultRoot doesn't match
  const minId = libraryRows.length > 0 ? Math.min(...libraryRows.map((l) => l.id)) : 0;

  return libraryRows.map((library) => {
    const activeTask = activeTasks.find(
      (task) => task.libraryId === library.id,
    );
    const isDefault = defaultRoot
      ? library.rootPath === defaultRoot
      : library.id === minId;

    return {
      id: library.id,
      name: library.name,
      rootPath: library.rootPath,
      createdAt: library.createdAt,
      lastScanAt: library.lastScanAt,
      imageCount:
        entries.find(
          (entry) => entry.libraryId === library.id && entry.kind === "image",
        )?.count ?? 0,
      totalSizeBytes: entries
        .filter(
          (entry) => entry.libraryId === library.id && entry.kind === "image",
        )
        .reduce((total, entry) => total + entry.totalSizeBytes, 0),
      folderCount:
        entries.find(
          (entry) =>
            entry.libraryId === library.id && entry.kind === "directory",
        )?.count ?? 0,
      activeTask: mapTask(activeTask),
      isDefault,
    };
  });
}
