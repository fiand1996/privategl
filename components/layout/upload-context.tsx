"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface UploadQueueItem {
  id: string;
  file: File;
  relativePath: string;
  libraryId: number;
  targetFolder: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export interface UploadCompletedFolderInfo {
  libraryId: number;
  folderPath: string;
  timestamp: number;
}

interface UploadContextType {
  queue: UploadQueueItem[];
  isUploading: boolean;
  isWidgetOpen: boolean;
  setIsWidgetOpen: (open: boolean) => void;
  lastCompletedFolder: UploadCompletedFolderInfo | null;
  enqueueUpload: (
    libraryId: number,
    targetFolder: string,
    items: { file: File; relativePath: string }[],
  ) => void;
  clearFinished: () => void;
  cancelAll: () => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

const MAX_CONCURRENCY = 2;

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isWidgetOpen, setIsWidgetOpen] = useState(true);
  const [lastCompletedFolder, setLastCompletedFolder] =
    useState<UploadCompletedFolderInfo | null>(null);

  // Use refs for the running worker loop to avoid stale closures
  const queueRef = useRef<UploadQueueItem[]>([]);
  const activeCountRef = useRef(0);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const processQueueRef = useRef<() => void>(() => {});

  // Keep queueRef in sync with state
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const updateItemStatus = useCallback(
    (
      id: string,
      status: UploadQueueItem["status"],
      error?: string,
    ) => {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status, error } : item,
        ),
      );
    },
    [],
  );

  const processQueue = useCallback(() => {
    while (activeCountRef.current < MAX_CONCURRENCY) {
      const nextItem = queueRef.current.find(
        (item) => item.status === "pending",
      );
      if (!nextItem) break;

      // Mark as uploading immediately in ref & state
      nextItem.status = "uploading";
      activeCountRef.current += 1;
      updateItemStatus(nextItem.id, "uploading");

      const controller = new AbortController();
      abortControllersRef.current.set(nextItem.id, controller);

      const formData = new FormData();
      formData.append("libraryId", String(nextItem.libraryId));
      formData.append("targetFolder", nextItem.targetFolder);
      formData.append("files", nextItem.file);
      formData.append("paths", nextItem.relativePath);

      fetch("/api/gallery/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })
        .then(async (res) => {
          const json = (await res.json()) as {
            success?: boolean;
            skipped?: { path: string; reason: string }[];
            error?: string;
          };

          if (!res.ok) {
            throw new Error(json.error || `Upload failed (HTTP ${res.status}).`);
          }

          if (json.skipped && json.skipped.length > 0) {
            const reason = json.skipped[0]?.reason || "File skipped.";
            updateItemStatus(nextItem.id, "error", reason);
          } else {
            updateItemStatus(nextItem.id, "success");
            setLastCompletedFolder({
              libraryId: nextItem.libraryId,
              folderPath: nextItem.targetFolder,
              timestamp: Date.now(),
            });
          }
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) {
            updateItemStatus(nextItem.id, "error", "Upload cancelled.");
          } else {
            const msg = err instanceof Error ? err.message : "Upload error.";
            updateItemStatus(nextItem.id, "error", msg);
          }
        })
        .finally(() => {
          abortControllersRef.current.delete(nextItem.id);
          activeCountRef.current -= 1;
          processQueueRef.current();
        });
    }
  }, [updateItemStatus]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  const enqueueUpload = useCallback(
    (
      libraryId: number,
      targetFolder: string,
      items: { file: File; relativePath: string }[],
    ) => {
      if (items.length === 0) return;

      const newQueueItems: UploadQueueItem[] = items.map((item) => ({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file: item.file,
        relativePath: item.relativePath,
        libraryId,
        targetFolder,
        status: "pending",
      }));

      setQueue((prev) => [...prev, ...newQueueItems]);
      setIsWidgetOpen(true);
    },
    [],
  );

  // Trigger processQueue whenever new pending items exist and capacity allows
  useEffect(() => {
    const hasPending = queue.some((item) => item.status === "pending");
    if (hasPending && activeCountRef.current < MAX_CONCURRENCY) {
      processQueue();
    }
  }, [queue, processQueue]);

  const clearFinished = useCallback(() => {
    setQueue((prev) =>
      prev.filter(
        (item) => item.status === "pending" || item.status === "uploading",
      ),
    );
  }, []);

  const cancelAll = useCallback(() => {
    abortControllersRef.current.forEach((ctrl) => ctrl.abort());
    abortControllersRef.current.clear();
    setQueue([]);
    activeCountRef.current = 0;
  }, []);

  const isUploading = useMemo(
    () =>
      queue.some(
        (item) => item.status === "pending" || item.status === "uploading",
      ),
    [queue],
  );

  // Prevent accidental tab close or page reload while uploads are active
  useEffect(() => {
    if (!isUploading) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isUploading]);

  const value = useMemo(
    () => ({
      queue,
      isUploading,
      isWidgetOpen,
      setIsWidgetOpen,
      lastCompletedFolder,
      enqueueUpload,
      clearFinished,
      cancelAll,
    }),
    [
      queue,
      isUploading,
      isWidgetOpen,
      lastCompletedFolder,
      enqueueUpload,
      clearFinished,
      cancelAll,
    ],
  );

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
}
