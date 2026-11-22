"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface Library {
  id: number;
  name: string;
  rootPath?: string;
  imageCount?: number;
  folderCount?: number;
  totalSizeBytes?: number;
  createdAt?: string;
  lastScanAt?: string | null;
}

interface LibraryContextValue {
  libraries: Library[];
  selectedLibraryId: number | null;
  selectedLibrary: Library | null;
  loading: boolean;
  error: string;
  selectLibrary: (id: number) => void;
  refreshLibraries: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshLibraries = useCallback(async () => {
    try {
      const response = await fetch("/api/libraries", { cache: "no-store" });
      const data = (await response.json()) as {
        libraries?: Library[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Libraries could not be loaded.");
      }
      const list = data.libraries ?? [];
      setLibraries(list);
      setError("");

      const stored = window.localStorage.getItem("gallery-library-id");
      const storedId = stored ? Number(stored) : null;
      const validSelected =
        storedId !== null && list.some((lib) => lib.id === storedId)
          ? storedId
          : (list[0]?.id ?? null);

      setSelectedLibraryId(validSelected);
      if (validSelected !== null) {
        window.localStorage.setItem("gallery-library-id", String(validSelected));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Libraries could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/libraries", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        const data = (await response.json()) as {
          libraries?: Library[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Libraries could not be loaded.");
        }
        const list = data.libraries ?? [];
        setLibraries(list);
        setError("");

        const stored = window.localStorage.getItem("gallery-library-id");
        const storedId = stored ? Number(stored) : null;
        const validSelected =
          storedId !== null && list.some((lib) => lib.id === storedId)
            ? storedId
            : (list[0]?.id ?? null);

        setSelectedLibraryId(validSelected);
        if (validSelected !== null) {
          window.localStorage.setItem("gallery-library-id", String(validSelected));
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Libraries could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectLibrary = useCallback((id: number) => {
    window.localStorage.setItem("gallery-library-id", String(id));
    setSelectedLibraryId(id);
  }, []);

  const selectedLibrary =
    libraries.find((lib) => lib.id === selectedLibraryId) ?? null;

  return (
    <LibraryContext.Provider
      value={{
        libraries,
        selectedLibraryId,
        selectedLibrary,
        loading,
        error,
        selectLibrary,
        refreshLibraries,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used within a LibraryProvider");
  }
  return context;
}
