"use client";

import { type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { LibraryProvider } from "./library-context";
import { SettingsProvider } from "./settings-context";
import { GallerySidebar } from "./gallery-sidebar";
import { UploadProvider } from "./upload-context";
import { UploadProgressWidget } from "./upload-progress-widget";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SettingsProvider>
        <LibraryProvider>
          <UploadProvider>
            <div className="min-h-screen bg-bg-app text-text-primary lg:pl-64 pb-20 lg:pb-0">
              <GallerySidebar />
              <main className="min-h-screen">{children}</main>
              <UploadProgressWidget />
            </div>
          </UploadProvider>
        </LibraryProvider>
      </SettingsProvider>
    </SessionProvider>
  );
}
