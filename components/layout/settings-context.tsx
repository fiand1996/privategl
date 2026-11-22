"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { GridSize, GallerySort } from "@/components/gallery/grid-controls";

export type ThemePreset =
  | "sleek-dark"
  | "oled-black"
  | "slate-dark"
  | "clean-light";

export type AccentColor =
  | "blue"
  | "pink"
  | "emerald"
  | "amber"
  | "purple"
  | "rose";

export interface AppSettings {
  defaultGridSize: GridSize;
  defaultSort: GallerySort;
  theme: ThemePreset;
  accentColor: AccentColor;
  [key: string]: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultGridSize: "medium",
  defaultSort: "modified-desc",
  theme: "sleek-dark",
  accentColor: "blue",
};

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  updateSetting: (key: string, value: string) => Promise<void>;
  updateSettings: (newSettings: Record<string, string>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

function applyThemeAndAccent(theme: string, accent: string) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-accent", accent);
  if (theme === "clean-light") {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }
}

function getCachedInitialSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const cachedGrid = window.localStorage.getItem("gallery-default-grid-size");
    const cachedSort = window.localStorage.getItem("gallery-default-sort");
    const cachedTheme = window.localStorage.getItem(
      "gallery-theme",
    ) as ThemePreset | null;
    const cachedAccent = window.localStorage.getItem(
      "gallery-accent",
    ) as AccentColor | null;

    const theme: ThemePreset =
      cachedTheme === "sleek-dark" ||
      cachedTheme === "oled-black" ||
      cachedTheme === "slate-dark" ||
      cachedTheme === "clean-light"
        ? cachedTheme
        : "sleek-dark";

    const accentColor: AccentColor =
      cachedAccent === "blue" ||
      cachedAccent === "pink" ||
      cachedAccent === "emerald" ||
      cachedAccent === "amber" ||
      cachedAccent === "purple" ||
      cachedAccent === "rose"
        ? cachedAccent
        : "blue";

    applyThemeAndAccent(theme, accentColor);

    return {
      defaultGridSize:
        cachedGrid === "small" ||
        cachedGrid === "medium" ||
        cachedGrid === "large"
          ? cachedGrid
          : "medium",
      defaultSort:
        cachedSort === "modified-desc" ||
        cachedSort === "name-asc" ||
        cachedSort === "name-desc"
          ? cachedSort
          : "modified-desc",
      theme,
      accentColor,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() =>
    getCachedInitialSettings(),
  );
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as {
        settings?: Record<string, string>;
      };
      if (data.settings) {
        const theme: ThemePreset =
          data.settings.theme === "sleek-dark" ||
          data.settings.theme === "oled-black" ||
          data.settings.theme === "slate-dark" ||
          data.settings.theme === "clean-light"
            ? (data.settings.theme as ThemePreset)
            : "sleek-dark";
        const accentColor: AccentColor =
          data.settings.accentColor === "blue" ||
          data.settings.accentColor === "pink" ||
          data.settings.accentColor === "emerald" ||
          data.settings.accentColor === "amber" ||
          data.settings.accentColor === "purple" ||
          data.settings.accentColor === "rose"
            ? (data.settings.accentColor as AccentColor)
            : "blue";

        const merged: AppSettings = {
          defaultGridSize:
            data.settings.defaultGridSize === "small" ||
            data.settings.defaultGridSize === "medium" ||
            data.settings.defaultGridSize === "large"
              ? data.settings.defaultGridSize
              : "medium",
          defaultSort:
            data.settings.defaultSort === "modified-desc" ||
            data.settings.defaultSort === "name-asc" ||
            data.settings.defaultSort === "name-desc"
              ? data.settings.defaultSort
              : "modified-desc",
          theme,
          accentColor,
          ...data.settings,
        };
        setSettings(merged);
        applyThemeAndAccent(theme, accentColor);
        // Sync local cache
        try {
          window.localStorage.setItem(
            "gallery-default-grid-size",
            merged.defaultGridSize,
          );
          window.localStorage.setItem(
            "gallery-default-sort",
            merged.defaultSort,
          );
          window.localStorage.setItem("gallery-theme", theme);
          window.localStorage.setItem("gallery-accent", accentColor);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/settings", { cache: "no-store" })
      .then(async (response) => {
        if (!active || !response.ok) return;
        const data = (await response.json()) as {
          settings?: Record<string, string>;
        };
        if (data.settings && active) {
          const theme: ThemePreset =
            data.settings.theme === "sleek-dark" ||
            data.settings.theme === "oled-black" ||
            data.settings.theme === "slate-dark" ||
            data.settings.theme === "clean-light"
              ? (data.settings.theme as ThemePreset)
              : "sleek-dark";
          const accentColor: AccentColor =
            data.settings.accentColor === "blue" ||
            data.settings.accentColor === "pink" ||
            data.settings.accentColor === "emerald" ||
            data.settings.accentColor === "amber" ||
            data.settings.accentColor === "purple" ||
            data.settings.accentColor === "rose"
              ? (data.settings.accentColor as AccentColor)
              : "blue";

          const merged: AppSettings = {
            defaultGridSize:
              data.settings.defaultGridSize === "small" ||
              data.settings.defaultGridSize === "medium" ||
              data.settings.defaultGridSize === "large"
                ? data.settings.defaultGridSize
                : "medium",
            defaultSort:
              data.settings.defaultSort === "modified-desc" ||
              data.settings.defaultSort === "name-asc" ||
              data.settings.defaultSort === "name-desc"
                ? data.settings.defaultSort
                : "modified-desc",
            theme,
            accentColor,
            ...data.settings,
          };
          setSettings(merged);
          applyThemeAndAccent(theme, accentColor);
          try {
            window.localStorage.setItem(
              "gallery-default-grid-size",
              merged.defaultGridSize,
            );
            window.localStorage.setItem(
              "gallery-default-sort",
              merged.defaultSort,
            );
            window.localStorage.setItem("gallery-theme", theme);
            window.localStorage.setItem("gallery-accent", accentColor);
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback(
    async (newSettings: Record<string, string>) => {
      // Optimistic update
      setSettings((prev) => {
        const next = { ...prev, ...newSettings };
        if (newSettings.defaultGridSize) {
          next.defaultGridSize = newSettings.defaultGridSize as GridSize;
          try {
            window.localStorage.setItem(
              "gallery-default-grid-size",
              newSettings.defaultGridSize,
            );
          } catch {
            // ignore
          }
        }
        if (newSettings.defaultSort) {
          next.defaultSort = newSettings.defaultSort as GallerySort;
          try {
            window.localStorage.setItem(
              "gallery-default-sort",
              newSettings.defaultSort,
            );
          } catch {
            // ignore
          }
        }
        if (newSettings.theme) {
          next.theme = newSettings.theme as ThemePreset;
          try {
            window.localStorage.setItem("gallery-theme", newSettings.theme);
          } catch {
            // ignore
          }
        }
        if (newSettings.accentColor) {
          next.accentColor = newSettings.accentColor as AccentColor;
          try {
            window.localStorage.setItem(
              "gallery-accent",
              newSettings.accentColor,
            );
          } catch {
            // ignore
          }
        }
        applyThemeAndAccent(next.theme, next.accentColor);
        return next;
      });

      // Persist to SQLite Database via API
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: newSettings }),
        });
      } catch {
        // ignore network error
      }
    },
    [],
  );

  const updateSetting = useCallback(
    async (key: string, value: string) => {
      await updateSettings({ [key]: value });
    },
    [updateSettings],
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSetting,
        updateSettings,
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within a SettingsProvider");
  }
  return context;
}
