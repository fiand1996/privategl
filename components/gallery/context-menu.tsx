"use client";

import { useEffect, useRef } from "react";
import {
  Copy,
  Download,
  Eye,
  FolderInput,
  Heart,
  Pencil,
  Trash2,
} from "lucide-react";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  position: ContextMenuPosition | null;
  selectedCount: number;
  canOpen?: boolean;
  canDownload?: boolean;
  canRename?: boolean;
  onOpen?: () => void;
  onDownload?: () => void;
  onFavorite?: () => void;
  onRename?: () => void;
  onCopy: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({
  position,
  selectedCount,
  canOpen = false,
  canDownload = false,
  canRename = false,
  onOpen,
  onDownload,
  onFavorite,
  onRename,
  onCopy,
  onMove,
  onDelete,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("pointerdown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, position]);

  if (!position) return null;

  // Keep menu within viewport
  const left = Math.min(position.x, window.innerWidth - 200);
  const top = Math.min(position.y, window.innerHeight - 220);

  return (
    <div
      ref={menuRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 w-48 overflow-hidden rounded-2xl border border-border-strong bg-bg-card-subtle/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
        {selectedCount} item(s) selected
      </div>

      <div className="h-px bg-border-subtle my-1" />

      {canOpen && onOpen && (
        <button
          type="button"
          onClick={() => {
            onOpen();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-text-primary transition hover:bg-bg-hover cursor-pointer"
        >
          <Eye size={15} className="text-text-muted" />
          <span>Open</span>
        </button>
      )}

      {canDownload && onDownload && (
        <button
          type="button"
          onClick={() => {
            onDownload();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-text-primary transition hover:bg-bg-hover cursor-pointer"
        >
          <Download size={15} className="text-text-muted" />
          <span>Download</span>
        </button>
      )}

      {onFavorite && (
        <button
          type="button"
          onClick={() => {
            onFavorite();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10 cursor-pointer"
        >
          <Heart size={15} className="text-rose-400" />
          <span>Toggle Favorite</span>
        </button>
      )}

      {canRename && onRename && (
        <button
          type="button"
          onClick={() => {
            onRename();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-text-primary transition hover:bg-bg-hover cursor-pointer"
        >
          <Pencil size={15} className="text-accent" />
          <span>Rename</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          onCopy();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-text-primary transition hover:bg-bg-hover cursor-pointer"
      >
        <Copy size={15} className="text-accent" />
        <span>Copy</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onMove();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-text-primary transition hover:bg-bg-hover cursor-pointer"
      >
        <FolderInput size={15} className="text-accent" />
        <span>Move</span>
      </button>

      <div className="h-px bg-border-subtle my-1" />

      <button
        type="button"
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-500/10 cursor-pointer"
      >
        <Trash2 size={15} />
        <span>Delete</span>
      </button>
    </div>
  );
}
