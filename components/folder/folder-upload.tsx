"use client";

import { ChevronDown, FolderUp, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUpload } from "@/components/layout/upload-context";

export interface UploadFileItem {
  file: File;
  relativePath: string;
}

export async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<UploadFileItem[]> {
  const results: UploadFileItem[] = [];
  const items = Array.from(dataTransfer.items || []);

  type FileSystemEntry = {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    file?: (callback: (file: File) => void) => void;
    createReader?: () => {
      readEntries: (callback: (entries: FileSystemEntry[]) => void) => void;
    };
  };

  async function traverseEntry(entry: FileSystemEntry, currentPath: string): Promise<void> {
    if (entry.isFile && entry.file) {
      await new Promise<void>((resolve) => {
        entry.file!((file: File) => {
          results.push({
            file,
            relativePath: currentPath ? `${currentPath}/${file.name}` : file.name,
          });
          resolve();
        });
      });
    } else if (entry.isDirectory && entry.createReader) {
      const dirReader = entry.createReader();
      const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      const readEntries = async (): Promise<void> => {
        return new Promise<void>((resolve) => {
          dirReader.readEntries(async (entries: FileSystemEntry[]) => {
            if (entries.length === 0) {
              resolve();
            } else {
              for (const child of entries) {
                await traverseEntry(child, nextPath);
              }
              await readEntries();
              resolve();
            }
          });
        });
      };
      await readEntries();
    }
  }

  const entries: FileSystemEntry[] = [];
  for (const item of items) {
    if (typeof (item as unknown as { webkitGetAsEntry?: () => FileSystemEntry }).webkitGetAsEntry === "function") {
      const entry = (item as unknown as { webkitGetAsEntry: () => FileSystemEntry }).webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }

  if (entries.length > 0) {
    for (const entry of entries) {
      await traverseEntry(entry, "");
    }
  } else {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      results.push({ file, relativePath: file.name });
    }
  }

  return results;
}

interface UseFolderUploadOptions {
  libraryId: number;
  folderPath: string;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function useFolderUpload({
  libraryId,
  folderPath,
  onSuccess,
}: UseFolderUploadOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const uploadMenuRef = useRef<HTMLDivElement>(null);

  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { enqueueUpload, isUploading } = useUpload();

  // Close upload menu on outside click
  useEffect(() => {
    if (!uploadMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!uploadMenuRef.current?.contains(e.target as Node)) {
        setUploadMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [uploadMenuOpen]);

  const startUpload = useCallback(
    (items: UploadFileItem[]) => {
      if (items.length === 0) return;
      enqueueUpload(libraryId, folderPath, items);
      onSuccess(`Queued ${items.length} photo(s) for upload.`);
    },
    [enqueueUpload, folderPath, libraryId, onSuccess],
  );

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const items: UploadFileItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      items.push({ file, relativePath: file.name });
    }
    startUpload(items);
    e.target.value = "";
  };

  const handleDirectorySelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const items: UploadFileItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rel = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name;
      items.push({ file, relativePath: rel });
    }
    startUpload(items);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!e.dataTransfer) return;
    const items = await extractFilesFromDataTransfer(e.dataTransfer);
    if (items.length > 0) {
      startUpload(items);
    }
  };

  const UploadMenu = (
    <div ref={uploadMenuRef} className="relative">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        onChange={handleFilesSelected}
        className="hidden"
      />
      <input
        ref={dirInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in WebKit/Blink
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleDirectorySelected}
        className="hidden"
      />

      <button
        type="button"
        disabled={isUploading}
        onClick={() => setUploadMenuOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
      >
        <Upload size={14} />
        <span>Upload</span>
        <ChevronDown size={13} className="opacity-70" />
      </button>

      {uploadMenuOpen && (
        <div className="absolute right-0 top-full mt-2 z-30 w-44 overflow-hidden rounded-2xl border border-border-strong bg-bg-card-subtle/98 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            onClick={() => {
              setUploadMenuOpen(false);
              fileInputRef.current?.click();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-foreground transition hover:bg-bg-hover cursor-pointer"
          >
            <Upload size={14} className="text-accent" />
            <span>Upload Files</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadMenuOpen(false);
              dirInputRef.current?.click();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-foreground transition hover:bg-bg-hover cursor-pointer"
          >
            <FolderUp size={14} className="text-accent" />
            <span>Upload Folder</span>
          </button>
        </div>
      )}
    </div>
  );

  return {
    uploading: isUploading,
    uploadProgress: { current: 0, total: 0 },
    isDragging,
    setIsDragging,
    handleDrop,
    UploadMenu,
    UploadProgressToast: null,
  };
}
