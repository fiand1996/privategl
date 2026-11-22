"use client";

import Link from "next/link";
import {
  CheckSquare,
  ChevronRight,
  FolderPlus,
  Home,
  Square,
} from "lucide-react";
import React from "react";

export interface BreadcrumbItem {
  name: string;
  path: string;
}

interface FolderBreadcrumbsProps {
  breadcrumbs: BreadcrumbItem[];
  folderCount: number;
  imageCount: number;
  isAdmin: boolean;
  isAllSelected: boolean;
  hasItems: boolean;
  uploadMenuNode?: React.ReactNode;
  onToggleSelectAll: () => void;
  onOpenCreateFolder: () => void;
}

export function FolderBreadcrumbs({
  breadcrumbs,
  folderCount,
  imageCount,
  isAdmin,
  isAllSelected,
  hasItems,
  uploadMenuNode,
  onToggleSelectAll,
  onOpenCreateFolder,
}: FolderBreadcrumbsProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Breadcrumb Path & Stats */}
      <div className="flex flex-col gap-1.5">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted"
        >
          <Link
            href="/folder"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            <Home size={14} />
            <span>Root</span>
          </Link>

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.path} className="flex items-center gap-1.5">
                <ChevronRight size={13} className="text-text-muted" />
                {isLast ? (
                  <span className="font-semibold text-text-primary px-2 py-1">
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    href={`/folder?path=${encodeURIComponent(crumb.path)}`}
                    className="rounded-lg px-2 py-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
                  >
                    {crumb.name}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 pl-2 text-[11px] text-text-secondary">
          <span>{folderCount} folders</span>
          <span>·</span>
          <span>{imageCount} photos</span>
        </div>
      </div>

      {/* Action Buttons: Upload, New Folder, Select All */}
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && uploadMenuNode}

        {isAdmin && (
          <button
            type="button"
            onClick={onOpenCreateFolder}
            className="flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-bg-hover cursor-pointer"
          >
            <FolderPlus size={14} className="text-accent" />
            <span>New Folder</span>
          </button>
        )}

        {hasItems && (
          <button
            type="button"
            onClick={onToggleSelectAll}
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              isAllSelected
                ? "border-accent bg-accent/15 text-accent"
                : "border-border-subtle bg-bg-card text-foreground hover:bg-bg-hover"
            }`}
          >
            {isAllSelected ? (
              <CheckSquare size={14} className="text-accent" />
            ) : (
              <Square size={14} className="text-text-secondary" />
            )}
            <span>
              {isAllSelected ? "Deselect All" : "Select All (Ctrl+A)"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
