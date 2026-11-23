"use client";

import {
  Check,
  Compass,
  Folder,
  FolderArchive,
  HardDrive,
  Images,
  LogOut,
  Palette,
  Settings,
  Shield,
  User,
  Users,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLibrary } from "./library-context";

const emptySubscribe = () => () => {};

const navItems = [
  { href: "/photos", label: "Photos", icon: Images },
  { href: "/albums", label: "Albums", icon: FolderArchive },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/folder", label: "Folder", icon: Folder },
];

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value)} ${units[unitIndex]}`;
}

export function GallerySidebar() {
  const pathname = usePathname();
  const { selectedLibrary, libraries, selectedLibraryId, selectLibrary } = useLibrary();
  const { data: session } = useSession();
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const mobileMenuOpen = openForPath === pathname;

  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isCurrent = (href: string) => {
    if (href === "/photos") {
      return (
        pathname === "/photos" ||
        pathname === "/" ||
        pathname.startsWith("/photos") ||
        pathname.startsWith("/timeline")
      );
    }
    return pathname.startsWith(href);
  };

  const isAdmin = session?.user?.role === "admin";
  const userDisplayName = session?.user?.name || session?.user?.email || "User";
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border-subtle bg-bg-surface px-3.5 py-4 lg:flex select-none">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent/20 to-accent/10 border border-accent/30 shadow-sm shadow-accent/20">
            <span className="text-base font-bold text-accent">PG</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-text-primary">
              Private Gallery
            </span>
            <span className="text-[11px] text-text-secondary">
              Local Media Gallery
            </span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav aria-label="Main navigation" className="mt-6 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isCurrent(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-accent-active-bg text-accent font-semibold"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom / Library Info, User Profile & Settings */}
        <div className="mt-auto space-y-2.5 pt-4 border-t border-border-subtle">
          {/* Selected Library Summary Box */}
          {selectedLibrary && (
            <div className="rounded-2xl border border-border-subtle bg-bg-card-subtle p-3 shadow-inner">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-primary truncate">
                  <HardDrive size={14} className="text-accent shrink-0" />
                  <span className="truncate">{selectedLibrary.name}</span>
                </div>
                <span
                  className="size-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0"
                  title="Online"
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-secondary">
                <span>{selectedLibrary.imageCount ?? 0} photos</span>
                <span>{formatBytes(selectedLibrary.totalSizeBytes ?? 0)}</span>
              </div>
            </div>
          )}

          {/* Settings Link (Admins Only) */}
          {isAdmin && (
            <Link
              href="/settings"
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${
                pathname.startsWith("/settings")
                  ? "bg-bg-input text-text-primary"
                  : "text-text-secondary hover:bg-bg-input hover:text-text-primary"
              }`}
            >
              <Settings size={18} strokeWidth={1.8} />
              Settings
            </Link>
          )}

          {/* User Profile & Sign Out Box */}
          {session?.user && (
            <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-bg-card-subtle p-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-border-subtle text-xs font-semibold text-accent">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-text-primary">
                    {userDisplayName}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1 text-accent">
                        <Shield size={10} /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-text-secondary">
                        <User size={10} /> Viewer
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Sign Out"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-border-subtle hover:text-rose-400 transition"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border-subtle bg-bg-surface px-2 shadow-lg lg:hidden select-none"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isCurrent(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 text-xs font-medium transition-colors duration-150 ${
                active
                  ? "text-accent"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}

        {/* Account & Settings Mobile Trigger */}
        <button
          type="button"
          onClick={() => setOpenForPath(mobileMenuOpen ? null : pathname)}
          className={`flex flex-col items-center gap-1 rounded-xl p-2 text-xs font-medium transition-colors duration-150 cursor-pointer ${
            mobileMenuOpen || pathname.startsWith("/settings")
              ? "text-accent"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <User size={19} strokeWidth={mobileMenuOpen || pathname.startsWith("/settings") ? 2.3 : 1.8} />
          <span>Account</span>
        </button>
      </nav>

      {/* Mobile Account & Settings Drawer (Rendered via Portal to escape header backdrop-filter constraints) */}
      {mobileMenuOpen && isClient && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 lg:hidden animate-in fade-in duration-150"
          onClick={() => setOpenForPath(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl border-t border-border-strong bg-bg-surface p-5 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-xl bg-accent/15 text-xs font-bold text-accent">
                  PG
                </div>
                <h3 className="text-sm font-bold text-text-primary">Account & Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenForPath(null)}
                className="flex size-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* User Profile Card & Sign Out */}
            {session?.user && (
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-border-subtle bg-bg-card p-3 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-sm font-bold text-accent">
                    {userInitial}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-text-primary">
                      {userDisplayName}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-0.5">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 text-accent font-medium">
                          <Shield size={11} /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-text-secondary">
                          <User size={11} /> Viewer
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20 cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            {/* Active Library & Switcher */}
            {selectedLibrary && (
              <div className="mt-4 rounded-2xl border border-border-subtle bg-bg-card p-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-text-primary truncate">
                    <HardDrive size={15} className="text-accent shrink-0" />
                    <span className="truncate">{selectedLibrary.name}</span>
                  </div>
                  <span
                    className="size-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0"
                    title="Active"
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-secondary">
                  <span>{selectedLibrary.imageCount ?? 0} photos</span>
                  <span>{formatBytes(selectedLibrary.totalSizeBytes ?? 0)}</span>
                </div>

                {/* Quick Library Switcher if more than 1 library exists */}
                {libraries.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-border-subtle">
                    <label className="text-[11px] font-semibold text-text-secondary block mb-1.5">
                      Switch Media Library:
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {libraries.map((lib) => {
                        const isSelected = lib.id === selectedLibraryId;
                        return (
                          <button
                            key={lib.id}
                            type="button"
                            onClick={() => {
                              selectLibrary(lib.id);
                            }}
                            className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition cursor-pointer ${
                              isSelected
                                ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                                : "border border-border-subtle bg-bg-input text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            <span className="truncate">{lib.name}</span>
                            {isSelected && <Check size={14} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings Navigation Menu */}
            <div className="mt-4 space-y-1">
              <label className="text-[11px] font-semibold text-text-secondary block px-1 mb-1">
                Application Settings
              </label>

              <Link
                href="/settings/preferences"
                onClick={() => setOpenForPath(null)}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-medium transition ${
                  pathname === "/settings/preferences"
                    ? "bg-accent-active-bg text-accent font-semibold"
                    : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
                }`}
              >
                <Palette size={16} />
                <div className="flex flex-col">
                  <span className="font-semibold text-text-primary">Appearance & Preferences</span>
                  <span className="text-[10px] text-text-secondary">Themes, accent colors, and grid sizing</span>
                </div>
              </Link>

              {isAdmin && (
                <>
                  <Link
                    href="/settings/libraries"
                    onClick={() => setOpenForPath(null)}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-medium transition ${
                      pathname === "/settings/libraries" || pathname === "/settings"
                        ? "bg-accent-active-bg text-accent font-semibold"
                        : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
                    }`}
                  >
                    <HardDrive size={16} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-text-primary">Media Libraries</span>
                      <span className="text-[10px] text-text-secondary">Manage storage roots and directories</span>
                    </div>
                  </Link>

                  <Link
                    href="/settings/tasks"
                    onClick={() => setOpenForPath(null)}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-medium transition ${
                      pathname === "/settings/tasks"
                        ? "bg-accent-active-bg text-accent font-semibold"
                        : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
                    }`}
                  >
                    <Settings size={16} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-text-primary">Background Tasks</span>
                      <span className="text-[10px] text-text-secondary">Scan queue and indexing progress</span>
                    </div>
                  </Link>

                  <Link
                    href="/settings/users"
                    onClick={() => setOpenForPath(null)}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-medium transition ${
                      pathname === "/settings/users"
                        ? "bg-accent-active-bg text-accent font-semibold"
                        : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
                    }`}
                  >
                    <Users size={16} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-text-primary">User Management</span>
                      <span className="text-[10px] text-text-secondary">Admin & Viewer accounts</span>
                    </div>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
