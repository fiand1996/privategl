"use client";

import {
  CheckCircle2,
  Loader2,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { ConfirmDialog } from "@/components/gallery/confirm-dialog";

interface UserItem {
  id: number;
  username: string;
  displayName: string | null;
  role: "admin" | "viewer";
  createdAt: string;
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function UsersView() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [userModalError, setUserModalError] = useState("");
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userActionNotice, setUserActionNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);

  const fetchUsers = () => {
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (!isAdmin) return;
    let isMounted = true;
    const controller = new AbortController();

    fetch("/api/users", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load users."))))
      .then((data: { users?: UserItem[] }) => {
        if (isMounted) {
          setUsers(data.users ?? []);
          setLoadingUsers(false);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (isMounted) {
          setLoadingUsers(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isAdmin, refreshKey]);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setUserModalError("");
    const cleanUsername = newUsername.trim().toLowerCase();
    if (!cleanUsername) {
      setUserModalError("Username is required.");
      return;
    }
    if (newPassword.length < 6) {
      setUserModalError("Password must be at least 6 characters.");
      return;
    }

    setUserSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          password: newPassword,
          displayName: newDisplayName.trim() || undefined,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create user.");
      }

      setAddUserModalOpen(false);
      setNewUsername("");
      setNewDisplayName("");
      setNewPassword("");
      setNewRole("viewer");
      setUserActionNotice(`User "${cleanUsername}" created successfully.`);
      fetchUsers();
    } catch (err) {
      setUserModalError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/users?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user.");
      }
      setUserActionNotice(`User "${deleteTarget.username}" was deleted.`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-border-subtle bg-bg-card p-8 text-center text-text-secondary">
        <Shield size={32} className="mx-auto text-text-muted mb-3" />
        <p className="text-sm font-medium text-foreground">Access Restricted</p>
        <p className="text-xs text-text-muted mt-1">
          Only administrators have permission to manage user accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Users size={20} className="text-accent" />
            User Accounts
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Manage user credentials and access levels for Private Gallery.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setUserModalError("");
            setAddUserModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-foreground transition hover:bg-accent-hover active:scale-[0.99] cursor-pointer"
        >
          <UserPlus size={15} />
          <span>Add User</span>
        </button>
      </div>

      {userActionNotice && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs font-medium text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{userActionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setUserActionNotice("")}
            className="text-emerald-400/80 hover:text-emerald-300 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {loadingUsers ? (
        <div className="flex items-center justify-center py-16 text-text-muted gap-2">
          <Loader2 size={20} className="animate-spin text-accent" />
          <span className="text-xs">Loading user accounts...</span>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border-subtle bg-bg-surface/50 p-12 text-center">
          <Users size={32} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm font-medium text-foreground">No users found</p>
          <p className="text-xs text-text-muted mt-1">
            Add your first user to grant access to the gallery.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border-subtle bg-bg-card">
          <div className="divide-y divide-border-subtle">
            {users.map((u) => {
              const isCurrentSelf = Number(session?.user?.id) === u.id;
              const userInitial = (u.displayName || u.username).charAt(0).toUpperCase();

              return (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition hover:bg-bg-hover"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-bg-input border border-border-strong text-sm font-bold text-accent">
                      {userInitial}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary truncate">
                          {u.displayName || u.username}
                        </span>
                        {isCurrentSelf && (
                          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                            You
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                        <span>@{u.username}</span>
                        <span>•</span>
                        <span>Joined {formatDate(u.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {u.role === "admin" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                        <Shield size={12} />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-bg-hover px-3 py-1 text-xs font-medium text-text-secondary">
                        Viewer
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={isCurrentSelf}
                      onClick={() => setDeleteTarget(u)}
                      title={isCurrentSelf ? "Cannot delete your own account" : `Delete ${u.username}`}
                      className="flex size-8 items-center justify-center rounded-xl text-text-muted hover:bg-rose-500/10 hover:text-rose-400 transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add User Modal Dialog */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-border-strong bg-bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <UserPlus size={16} />
                </div>
                <h3 className="text-base font-bold text-text-primary">Add New User</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddUserModalOpen(false)}
                className="rounded-lg p-1 text-text-secondary hover:bg-border-subtle hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>

            {userModalError && (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                {userModalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Username <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. viewer1"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full rounded-2xl border border-border-strong bg-bg-hover px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Guest Viewer"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full rounded-2xl border border-border-strong bg-bg-hover px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-2xl border border-border-strong bg-bg-hover px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setNewRole("viewer")}
                    className={`flex flex-col items-start rounded-2xl border p-3 text-left transition cursor-pointer ${
                      newRole === "viewer"
                        ? "border-accent bg-accent/10 text-text-primary"
                        : "border-border-strong bg-bg-hover text-text-secondary hover:border-border-strong"
                    }`}
                  >
                    <span className="text-xs font-semibold text-text-primary">Viewer</span>
                    <span className="text-[11px] text-text-secondary mt-0.5">
                      Read-only gallery access. Cannot modify or delete photos.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole("admin")}
                    className={`flex flex-col items-start rounded-2xl border p-3 text-left transition cursor-pointer ${
                      newRole === "admin"
                        ? "border-accent bg-accent/10 text-text-primary"
                        : "border-border-strong bg-bg-hover text-text-secondary hover:border-border-strong"
                    }`}
                  >
                    <span className="text-xs font-semibold text-text-primary">Admin</span>
                    <span className="text-[11px] text-text-secondary mt-0.5">
                      Full administrative access, user management, and disk actions.
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  className="rounded-2xl border border-border-strong px-4 py-2.5 text-xs font-medium text-foreground hover:bg-bg-hover transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-foreground transition hover:bg-accent-hover active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {userSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete User Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete User Account"
        description={`Are you sure you want to delete user "${deleteTarget?.username}"? This action cannot be undone.`}
        confirmLabel="Delete User"
        isDestructive
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleteLoading) setDeleteTarget(null);
        }}
      />

      {/* Error Alert Dialog */}
      <ConfirmDialog
        open={Boolean(alertError)}
        title="Action Failed"
        description={alertError || ""}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setAlertError(null)}
      />
    </div>
  );
}
