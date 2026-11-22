# Private Gallery — System Architecture

This document outlines the system architecture, core modules, data flow, and database design of **Private Gallery**.

---

## 🏛️ High-Level Architecture

Private Gallery is structured around a clear separation of concerns between Next.js App Router endpoints, backend services, SQLite persistence, and efficient on-demand image processing.

```
┌──────────────────────────────────────────────────────────────┐
│                     Client (Browser / UI)                    │
│      Next.js App Router / React 19 / Tailwind CSS v4         │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP / JSON / WebP Streams
┌──────────────────────────────▼───────────────────────────────┐
│                    Next.js Server API                        │
│   /api/gallery/*  │  /api/tasks  │  /api/albums  │  /api/auth  │
└──────┬───────────────────────┬───────────────────────┬───────┘
       │                       │                       │
       ▼                       ▼                       ▼
┌──────────────┐       ┌───────────────┐       ┌───────────────┐
│ Disk Scanner │       │ Sharp Caching │       │ Drizzle ORM   │
│  (Recursive) │       │ WebP Pipeline │       │ SQLite Engine │
└──────────────┘       └───────────────┘       └───────────────┘
       │                       │                       │
       └───────────────────────┼───────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Local Storage / Disk                      │
│        Original Media Files & SQLite Database (`data/`)      │
└──────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Core Architectural Modules

### 1. Database & Persistence Layer (`lib/schema.ts`, `lib/database.ts`)
- **Engine**: SQLite accessed via `better-sqlite3` and `drizzle-orm`.
- **Tables**:
  - `libraries`: Root directory paths registered by users.
  - `library_entries`: Indexed files and folders with modification times, sizes, and relative paths.
  - `albums`: Custom collections or folder-backed album groups.
  - `album_entries`: Mapping of entries to albums.
  - `scan_tasks`: Background scanner task status and logs.
  - `tags` / `photo_tags`: Metadata tagging system.

### 2. In-Process Background Scanner (`lib/scanner.ts`, `lib/scan-runner.ts`)
- **Design**: Asynchronous background task runner triggered via `POST /api/tasks`.
- **Behavior**: Recursively traverses registered library roots, extracts file stats and extensions, and performs batched insertions into SQLite without blocking the main event loop.

### 3. Optimized Image Caching (`lib/gallery-image-url.ts`, `/api/gallery/image/route.ts`)
- **Pipeline**: Uses `sharp` to process original media files into responsive WebP thumbnails with standard server buckets (`w=160`, `w=260`, `w=400`, `w=640`, `w=1200`).
- **Caching**: Stored on disk in `data/thumbnails/` and served with HTTP `304 Not Modified` response validation using `ETag`.

### 4. Direct Action Synchronization (`lib/gallery-actions.ts`)
- **Design**: File operations (`delete`, `move`, `copy`, `rename`) executed in the UI perform atomic updates on both the physical disk and the SQLite database simultaneously. No manual rescan required.

### 5. Horizontal Justified Layout (`components/gallery/justified-photo-grid.tsx`)
- **Design**: Implements row-by-row justified layouts (Immich / Google Photos style) that preserve original photo aspect ratios without vertical masonry jumps during pagination. Synchronized row heights correspond directly to Album and Folder square card heights across Small, Medium, and Large grid sizes.

### 6. Semantic Theming & Accent Architecture (`app/globals.css`)
- **Design**: Entire application surfaces, typography, borders, and interactive elements are driven strictly by semantic CSS variables (`--bg-app`, `--bg-card`, `--text-primary`, `--accent`, `--accent-foreground`, etc.).
- **Capabilities**: Supports on-the-fly switching between 5 distinct themes (Sleek Dark, OLED Black, Clean Light, Midnight Slate, Warm Amber) and 6 vibrant accent palettes (Ice Blue, Emerald, Purple, Rose, Amber, Bubblegum Pink) persisted via `SettingsContext` and SQLite user preferences without visual layout jumps or unreadable contrast states.

### 7. Online Database Backups & Snapshots (`lib/db/backup.ts`, `/api/settings/backup`)
- **Design**: Executes safe, online SQLite snapshots using `better-sqlite3.backup()` that checkpoint WAL journals without downtime or blocking client requests.
- **Capabilities**: Snapshots are persisted in `data/backups/`, supporting list views, on-demand browser downloads, deletion, and atomic restoration with automatic pre-restore safety copies.

---

## 🔄 Request Lifecycle

1. **Client Request**: User navigates to Photos, Album, or Folder view.
2. **API Dispatch**: Next.js App Router endpoint validates session authentication and queries Drizzle ORM.
3. **Thumbnail Stream**: Grid components request sized WebP thumbnails through `/api/gallery/image`. The caching engine checks disk cache or generates via `sharp`.
4. **Metadata Extraction**: On-demand EXIF, camera, lens, and GPS data are extracted via `exifr` with orientation-aware dimension handling.
