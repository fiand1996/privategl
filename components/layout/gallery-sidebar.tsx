"use client";

import {
  Compass,
  Folder,
  FolderArchive,
  HardDrive,
  Images,
  LogOut,
  Settings,
  Shield,
  User,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLibrary } from "./library-context";

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
  const { selectedLibrary } = useLibrary();
  const { data: session } = useSession();

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
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border-subtle bg-bg-surface/95 px-2 backdrop-blur-xl lg:hidden"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isCurrent(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 text-xs font-medium transition ${
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
        {isAdmin && (
          <Link
            href="/settings"
            className={`flex flex-col items-center gap-1 rounded-xl p-2 text-xs font-medium transition ${
              pathname.startsWith("/settings")
                ? "text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Settings size={19} strokeWidth={1.8} />
            <span>Settings</span>
          </Link>
        )}
      </nav>
    </>
  );
}
