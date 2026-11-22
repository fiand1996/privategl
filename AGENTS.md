<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Private Gallery — Agent Architecture & Engineering Guidelines

This document provides essential architectural context for AI agents working on this codebase.

---

## 1. Project Overview & Philosophy

- **Domain:** A directory-based local photo & media gallery server.
- **Media-First, Not a Detached File Manager:** Photos remain in their original directories on disk. SQLite indexes them for fast search, timeline dates, and album views.
- **Language & Localization:** All UI text, tooltips, dialogs, comments, and documentation MUST strictly remain in **English (EN)**.
- **Design System:** Structured multi-theme and multi-accent architecture powered by semantic CSS variables (`app/globals.css`). Supports Sleek Dark (default), OLED Black, Clean Light, Midnight Slate, and Warm Amber, paired with accents (Ice Blue, Emerald, Purple, Rose, Amber, Bubblegum Pink).

---

## 2. Directory & Component Structure Conventions

Strict separation of concerns MUST be maintained:

- **`components/` (All React Components):**
  - `components/layout/` : AppShell, Sidebar, Header, `LibraryContext`, and `SettingsContext`.
  - `components/gallery/` : PhotoCard, AlbumCard, LightboxModal, PhotoInfoPanel, GridControls, ContextMenu, JustifiedPhotoGrid, dialogs.
  - `components/search/` : Global search popup.
  - `components/pages/` : Clean page wrappers (`PhotosView`, `AlbumsPage`, `FolderPage`, `ExplorePage`).
  - `components/folder/` : Modular folder view components (`FolderActionBar`, `FolderBreadcrumbs`, `FolderGridItem`, `FolderUpload`, `CreateFolderModal`).
  - `components/albums/` : Modular album view components (`AlbumActionBar`, `AlbumsListView`, `AlbumDetailView`, `CreateAlbumModal`).
  - `components/explore/` : Modular explore view components (`ExploreActionBar`, `ExploreHubView`, `ExploreFilteredView`).
  - `components/settings/` : Modular settings views (`SettingsNav`, `LibrariesView`, `PreferencesView`, `TasksView`, `UsersView`).
  - **Rule:** ALL `.tsx` files belong in `components/` or `app/`. **NEVER place `.tsx` component files in `lib/`!**

- **`lib/` (Strictly Pure TypeScript / Backend Logic):**
  - Only `.ts` files belong in `lib/`.
  - `lib/schema.ts` : Drizzle SQLite schema definition (all 11 tables).
  - `lib/db/` : Modular domain database modules (`client.ts`, `libraries.ts`, `tasks.ts`, `gallery.ts`, `albums.ts`, `settings.ts`, `metadata.ts`, `explore.ts`, `users.ts`, `backup.ts`, `index.ts`).
  - `lib/database.ts` : Unified barrel re-export (`export * from "./db"`) for 100% backward-compatible imports.
  - `lib/scanner.ts` : Recursive directory scanner & metadata extractor.
  - `lib/scan-runner.ts` : In-process asynchronous task runner.
  - `lib/gallery-actions.ts` : Safe file operations (delete, move, copy) with direct atomic SQLite synchronization.
  - `lib/gallery-metadata.ts` : On-demand EXIF, GPS, camera, lens, and IPTC/XMP metadata extractor.
  - `lib/gallery-image-url.ts` : Image caching URL generator with file versioning.
  - `lib/library-files.ts` : Safe path traversal resolution within library roots.

- **`app/` (Next.js App Router):**
  - Route endpoints (`/api/*`), modular subroutes (`/settings/libraries`, `/settings/preferences`, `/settings/tasks`, `/settings/users`), and page entrypoints that mount the respective components wrapped in `AppShell`.

---

## 3. Database & Background Scanning Architecture

- **Database:** SQLite file located at `data/gallery.sqlite` accessed via `better-sqlite3` and `drizzle-orm`.
- **Drizzle Migrations:**
  - Managed via Drizzle Kit in `drizzle/` (`pnpm db:generate`, `pnpm db:migrate`).
  - Executed automatically at server startup in-process via `migrate()` inside `lib/db/client.ts`.
  - Configured with optimized SQLite pragmas: WAL journal mode, `foreign_keys = ON`, `busy_timeout = 5000`, and memory temp store.
  - **Schema Mutation Rule:** Whenever `lib/schema.ts` is modified, agents MUST generate the corresponding migration using `pnpm exec drizzle-kit generate --name <descriptive_name>`. **NEVER** write manual raw SQL DDL (`CREATE TABLE`, `ALTER TABLE`) inside runtime application code (`lib/db/client.ts`, etc.)!
- **In-Process Scanner:**
  - When a user triggers "Scan Now" via `POST /api/tasks`, `triggerScanQueue()` from `lib/scan-runner.ts` executes the scan in the background within the server process.
  - **Do NOT** require users to run a separate terminal worker command.
- **Direct Action Synchronization:**
  - File operations (`delete`, `move`, `copy`, `rename`) executed in Folder view update the physical disk AND mutate the SQLite database atomically in `lib/gallery-actions.ts`.
  - No manual rescan is needed for actions performed within the web interface.
- **Online Database Backups & Snapshots:**
  - Online SQLite backups are performed via `better-sqlite3`'s native `.backup()` method in `lib/db/backup.ts`.
  - Automatically checkpoints WAL pages into clean, standalone, defragmented `.sqlite` snapshots in `data/backups/`.
  - Supported actions: creation, on-demand browser download, deletion, and safe atomic restoration with automatic pre-restore safety snapshots.

---

## 4. Coding & React 19 Standards

- **Zero Lint & Type Errors:**
  - Always verify with `pnpm lint` and `pnpm exec tsc --noEmit`.
- **Compiler Rule (`react-hooks/set-state-in-effect`):**
  - Do NOT call `setState` synchronously within the body of a `useEffect`. Use component `key` props to reset state upon ID changes or compute derived values.
- **Unified Lightbox:**
  - Use `components/gallery/lightbox-modal.tsx` rather than reimplementing photo viewers across individual pages.

---

## 5. Performance & Image Caching Architecture

- **Server-Side WebP Thumbnails:**
  - All grid thumbnails (`PhotoCard`, `AlbumCard`, `FolderGridItem`, search results) request sized thumbnails via `galleryImageUrl(..., width)` mapped to normalized server buckets (`w=160`, `w=260`, `w=400`, `w=640`, `w=1200`).
  - `/api/gallery/image/route.ts` generates disk-cached WebP thumbnails in `data/thumbnails/` using `sharp` (down from ~15 MB raw to ~15 KB WebP, a 99% reduction).
  - Lightbox modal views omit `width` to stream the full-resolution original image.
  - Supports HTTP `304 Not Modified` via `ETag` and `If-None-Match`.
- **Responsive Photo Layouts:**
  - `JustifiedPhotoGrid` implements a row-by-row horizontal justified layout (Google Photos / Immich style) that preserves natural image aspect ratios and avoids vertical masonry pagination jumps. Used in Photos, Album Detail, and Explore Filtered views.
  - `PhotoCard` supports `aspectRatio="justified"` (with dynamic width/height per row) and `aspectRatio="square"` (fixed 1:1 tile, used in Folder view and Album cards).
  - All views use `contentVisibility: "auto"` for maximum performance with large catalogs.
- **EXIF Orientation & Metadata Accuracy:**
  - Dimension extraction in `lib/gallery-metadata.ts` checks EXIF `Orientation` (tags 5, 6, 7, 8) via `isOrientationRotated90`. Rotated images swap `width` and `height` to ensure upright portrait photos are never cropped into landscape slots.
  - Client-side `onMeasureAspectRatio` in `PhotoCard` provides real-time self-correction upon image load.

---

## 6. Design System & Theming Architecture

- **Semantic CSS Token Philosophy:**
  - **Zero Hardcoded Colors:** NEVER use raw hex values (`#...`) or hardcoded palette utility classes (e.g., `bg-zinc-900`, `text-zinc-100`, `bg-black/95`, `border-zinc-800`) in components or pages.
  - All surface colors, borders, typography, and interactive states MUST use semantic tokens defined in `app/globals.css`:
    - **Backgrounds:** `bg-bg-app`, `bg-bg-card`, `bg-bg-sidebar`, `bg-bg-input`, `bg-bg-hover`
    - **Borders:** `border-border-subtle`, `border-border-strong`
    - **Typography:** `text-text-primary`, `text-text-secondary`, `text-text-muted`
    - **Accents:** `bg-accent`, `text-accent`, `border-accent`, `bg-accent-hover`, `bg-accent-muted`, `border-accent-border`
    - **Accent Text (`text-accent-foreground`):** Used inside accent-filled buttons and active tabs to ensure accessible, high-contrast text across all accents (e.g., Bubblegum Pink, Emerald) and themes (Clean Light vs. Sleek Dark).
- **Themes & Accents:**
  - **Supported Themes:** `sleek-dark` (default), `oled-black`, `clean-light`, `midnight-slate`, `warm-amber`.
  - **Supported Accents:** `ice-blue` (default), `emerald`, `purple`, `rose`, `amber`, `bubblegum-pink`.
  - Driven by `data-theme="..."` and `data-accent="..."` attributes on `<html>`, maintained through `SettingsContext` and persisted in user preferences.
- **Photo Overlay Rule:**
  - Text placed directly over dark photo gradient overlays (`bg-gradient-to-t from-black/95`) MUST use explicit white text with drop shadows (`text-white drop-shadow`, `text-white/85 drop-shadow`), NOT semantic tokens like `text-text-secondary` or `text-zinc-300` which turn dark in light mode.
