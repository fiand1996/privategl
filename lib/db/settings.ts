import { getDatabase } from "./client";
import * as schema from "../schema";

const DEFAULT_APP_SETTINGS: Record<string, string> = {
  defaultGridSize: "medium",
  defaultSort: "modified-desc",
  theme: "sleek-dark",
  accentColor: "blue",
};

export function getAppSettings(): Record<string, string> {
  const db = getDatabase();
  const rows = db.select().from(schema.appSettings).all();
  const result: Record<string, string> = { ...DEFAULT_APP_SETTINGS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function getAppSetting(
  key: string,
  defaultValue?: string,
): string | undefined {
  const all = getAppSettings();
  return all[key] ?? defaultValue;
}

export function setAppSetting(key: string, value: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.insert(schema.appSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value, updatedAt: now },
    })
    .run();
}

export function setAppSettings(
  settings: Record<string, string>,
): Record<string, string> {
  const db = getDatabase();
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(settings)) {
    db.insert(schema.appSettings)
      .values({ key, value: String(value), updatedAt: now })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value: String(value), updatedAt: now },
      })
      .run();
  }
  return getAppSettings();
}
