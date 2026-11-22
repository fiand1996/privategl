import { count, desc, eq } from "drizzle-orm";
import { getDatabase } from "./client";
import { hashPassword } from "../auth-passwords";
import * as schema from "../schema";

export type UserRole = "admin" | "viewer";

export interface UserRecord {
  id: number;
  username: string;
  displayName: string | null;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export type SafeUser = Omit<UserRecord, "passwordHash">;

export function getUserCount(): number {
  const db = getDatabase();
  const row = db.select({ count: count() }).from(schema.users).get();
  return row?.count ?? 0;
}

export function getUserByUsername(username: string): UserRecord | null {
  const db = getDatabase();
  const cleaned = username.trim().toLowerCase();
  const row = db.select().from(schema.users).where(eq(schema.users.username, cleaned)).get();
  return row ?? null;
}

export function getUserById(id: number): UserRecord | null {
  const db = getDatabase();
  const row = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  return row ?? null;
}

export function listUsers(): SafeUser[] {
  const db = getDatabase();
  const rows = db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.id))
    .all();
  return rows;
}

export function createUser(
  username: string,
  password: string,
  role: UserRole = "viewer",
  displayName?: string,
): SafeUser {
  const db = getDatabase();
  const cleaned = username.trim().toLowerCase();
  if (!cleaned) throw new Error("Username cannot be empty.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  const existing = getUserByUsername(cleaned);
  if (existing) throw new Error(`Username "${cleaned}" is already taken.`);

  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  const inserted = db
    .insert(schema.users)
    .values({
      username: cleaned,
      displayName: displayName?.trim() || null,
      passwordHash,
      role,
      createdAt: now,
    })
    .returning({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .get();

  return inserted;
}

export function updateUserPassword(id: number, newPassword: string): void {
  if (newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
  const db = getDatabase();
  const passwordHash = hashPassword(newPassword);
  db.update(schema.users)
    .set({ passwordHash })
    .where(eq(schema.users.id, id))
    .run();
}

export function deleteUser(id: number): void {
  const db = getDatabase();
  const user = getUserById(id);
  if (!user) throw new Error("User not found.");

  if (user.role === "admin") {
    const adminCount =
      db
        .select({ count: count() })
        .from(schema.users)
        .where(eq(schema.users.role, "admin"))
        .get()?.count ?? 0;
    if (adminCount <= 1) {
      throw new Error("Cannot delete the only admin user.");
    }
  }

  db.delete(schema.users).where(eq(schema.users.id, id)).run();
}
