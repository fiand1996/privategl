import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "./client";
import * as schema from "../schema";

export type ScanTaskStatus = "queued" | "running" | "completed" | "failed";

export interface ScanTask {
  id: string;
  libraryId: number;
  libraryName?: string;
  status: ScanTaskStatus;
  scannedEntries: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export function mapTask(
  row: typeof schema.scanTasks.$inferSelect | undefined,
): ScanTask | null {
  if (!row) return null;
  return {
    id: row.id,
    libraryId: row.libraryId,
    status: row.status,
    scannedEntries: row.scannedEntries,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    error: row.error,
  };
}

export function enqueueScan(libraryId: number) {
  const db = getDatabase();
  return db.transaction((tx) => {
    const library = tx
      .select({ id: schema.libraries.id })
      .from(schema.libraries)
      .where(eq(schema.libraries.id, libraryId))
      .get();
    if (!library) return { error: "not_found" as const };

    const activeTask = tx
      .select({ id: schema.scanTasks.id })
      .from(schema.scanTasks)
      .where(
        sql`${schema.scanTasks.libraryId} = ${libraryId}
          AND ${schema.scanTasks.status} IN ('queued', 'running')`,
      )
      .get();
    if (activeTask) return { error: "active" as const };

    const id = randomUUID();
    tx.insert(schema.scanTasks)
      .values({
        id,
        libraryId,
        status: "queued",
        createdAt: new Date().toISOString(),
      })
      .run();
    return { task: getTask(id) };
  });
}

export function getTask(taskId: string): ScanTask | null {
  const row = getDatabase()
    .select({
      id: schema.scanTasks.id,
      libraryId: schema.scanTasks.libraryId,
      status: schema.scanTasks.status,
      scannedEntries: schema.scanTasks.scannedEntries,
      createdAt: schema.scanTasks.createdAt,
      startedAt: schema.scanTasks.startedAt,
      finishedAt: schema.scanTasks.finishedAt,
      error: schema.scanTasks.error,
      libraryName: schema.libraries.name,
    })
    .from(schema.scanTasks)
    .innerJoin(
      schema.libraries,
      eq(schema.scanTasks.libraryId, schema.libraries.id),
    )
    .where(eq(schema.scanTasks.id, taskId))
    .get();
  if (!row) return null;
  const task = mapTask(row)!;
  task.libraryName = row.libraryName;
  return task;
}

export function getRecentTasks(limit = 20): ScanTask[] {
  return getDatabase()
    .select({
      id: schema.scanTasks.id,
      libraryId: schema.scanTasks.libraryId,
      status: schema.scanTasks.status,
      scannedEntries: schema.scanTasks.scannedEntries,
      createdAt: schema.scanTasks.createdAt,
      startedAt: schema.scanTasks.startedAt,
      finishedAt: schema.scanTasks.finishedAt,
      error: schema.scanTasks.error,
      libraryName: schema.libraries.name,
    })
    .from(schema.scanTasks)
    .innerJoin(
      schema.libraries,
      eq(schema.scanTasks.libraryId, schema.libraries.id),
    )
    .orderBy(desc(schema.scanTasks.createdAt))
    .limit(limit)
    .all()
    .map((row) => {
      const task = mapTask(row)!;
      task.libraryName = row.libraryName;
      return task;
    });
}

export function recoverInterruptedTasks() {
  getDatabase()
    .update(schema.scanTasks)
    .set({ status: "queued", startedAt: null })
    .where(eq(schema.scanTasks.status, "running"))
    .run();
}

export function claimNextTask(): ScanTask | null {
  const db = getDatabase();
  return db.transaction((tx) => {
    const queued = tx
      .select({ id: schema.scanTasks.id })
      .from(schema.scanTasks)
      .where(eq(schema.scanTasks.status, "queued"))
      .orderBy(schema.scanTasks.createdAt)
      .get();
    if (!queued) return null;

    const result = tx
      .update(schema.scanTasks)
      .set({
        status: "running",
        startedAt: new Date().toISOString(),
        error: null,
      })
      .where(
        sql`${schema.scanTasks.id} = ${queued.id}
          AND ${schema.scanTasks.status} = 'queued'`,
      )
      .run();
    return result.changes ? getTask(queued.id) : null;
  });
}

export function updateTaskProgress(taskId: string, scannedEntries: number) {
  getDatabase()
    .update(schema.scanTasks)
    .set({ scannedEntries })
    .where(eq(schema.scanTasks.id, taskId))
    .run();
}

export function completeTask(taskId: string, libraryId: number) {
  const now = new Date().toISOString();
  getDatabase().transaction((tx) => {
    tx.delete(schema.libraryEntries)
      .where(
        sql`${schema.libraryEntries.libraryId} = ${libraryId}
          AND ${schema.libraryEntries.scanId} != ${taskId}`,
      )
      .run();

    // Clean up any orphaned album entries, tags, or metadata for deleted files
    tx.delete(schema.albumEntries)
      .where(
        sql`${schema.albumEntries.libraryId} = ${libraryId}
          AND ${schema.albumEntries.entryPath} NOT IN (
            SELECT ${schema.libraryEntries.path} FROM ${schema.libraryEntries}
            WHERE ${schema.libraryEntries.libraryId} = ${libraryId}
          )`,
      )
      .run();

    tx.delete(schema.photoTags)
      .where(
        sql`${schema.photoTags.libraryId} = ${libraryId}
          AND ${schema.photoTags.entryPath} NOT IN (
            SELECT ${schema.libraryEntries.path} FROM ${schema.libraryEntries}
            WHERE ${schema.libraryEntries.libraryId} = ${libraryId}
          )`,
      )
      .run();

    tx.delete(schema.photoUserMetadata)
      .where(
        sql`${schema.photoUserMetadata.libraryId} = ${libraryId}
          AND ${schema.photoUserMetadata.entryPath} NOT IN (
            SELECT ${schema.libraryEntries.path} FROM ${schema.libraryEntries}
            WHERE ${schema.libraryEntries.libraryId} = ${libraryId}
          )`,
      )
      .run();

    tx.delete(schema.photoMetadata)
      .where(
        sql`${schema.photoMetadata.libraryId} = ${libraryId}
          AND ${schema.photoMetadata.entryPath} NOT IN (
            SELECT ${schema.libraryEntries.path} FROM ${schema.libraryEntries}
            WHERE ${schema.libraryEntries.libraryId} = ${libraryId}
          )`,
      )
      .run();

    tx.update(schema.libraries)
      .set({ lastScanAt: now })
      .where(eq(schema.libraries.id, libraryId))
      .run();
    tx.update(schema.scanTasks)
      .set({ status: "completed", finishedAt: now })
      .where(eq(schema.scanTasks.id, taskId))
      .run();
  });
}

export function failTask(taskId: string, error: string) {
  getDatabase()
    .update(schema.scanTasks)
    .set({ status: "failed", error, finishedAt: new Date().toISOString() })
    .where(eq(schema.scanTasks.id, taskId))
    .run();
}

export interface ScannedEntry {
  path: string;
  parentPath: string;
  name: string;
  kind: "directory" | "image";
  extension: string | null;
  size: number | null;
  modifiedAt: string | null;
}

export function saveScannedEntries(
  libraryId: number,
  taskId: string,
  entries: ScannedEntry[],
  scannedCount: number,
) {
  if (!entries.length) {
    updateTaskProgress(taskId, scannedCount);
    return;
  }

  getDatabase().transaction((tx) => {
    for (const entry of entries) {
      tx.insert(schema.libraryEntries)
        .values({ ...entry, libraryId, scanId: taskId })
        .onConflictDoUpdate({
          target: [schema.libraryEntries.libraryId, schema.libraryEntries.path],
          set: {
            parentPath: entry.parentPath,
            name: entry.name,
            kind: entry.kind,
            extension: entry.extension,
            size: entry.size,
            modifiedAt: entry.modifiedAt,
            scanId: taskId,
          },
        })
        .run();
    }
    tx.update(schema.scanTasks)
      .set({ scannedEntries: scannedCount })
      .where(eq(schema.scanTasks.id, taskId))
      .run();
  });
}
