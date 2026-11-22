import fs from "node:fs";
import path from "node:path";
import exifr from "exifr";
import sharp from "sharp";
import { resolveLibraryFile } from "./library-files";
import { IMAGE_CONTENT_TYPES } from "./gallery";

export function isOrientationRotated90(orientation: unknown): boolean {
  if (typeof orientation === "number") {
    // 5: Mirror horizontal and rotate 270 CW
    // 6: Rotate 90 CW
    // 7: Mirror horizontal and rotate 90 CW
    // 8: Rotate 270 CW
    return (
      orientation === 5 ||
      orientation === 6 ||
      orientation === 7 ||
      orientation === 8
    );
  }
  if (typeof orientation === "string") {
    const trimmed = orientation.trim();
    if (/^[5-8]$/.test(trimmed)) return true;
    if (/rotate\s*(90|270)/i.test(trimmed)) return true;
    if (/transpose|transverse/i.test(trimmed)) return true;
  }
  return false;
}

export interface FormattedPhotoMetadata {
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  megapixels: string | null;
  aspectRatio: string | null;
  colorSpace: string | null;

  // Date & Time
  capturedAt: string | null;
  modifiedAt: string | null;

  // Camera & Lens
  cameraMake: string | null;
  cameraModel: string | null;
  lensMake: string | null;
  lensModel: string | null;

  // Exposure
  focalLength: string | null;
  focalLength35mm: string | null;
  aperture: string | null;
  shutterSpeed: string | null;
  iso: number | null;
  exposureCompensation: string | null;
  flash: string | null;

  // GPS & Location
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  locationString: string | null;
  googleMapsUrl: string | null;
  openStreetMapUrl: string | null;

  // Tags & IPTC / XMP
  title: string | null;
  description: string | null;
  keywords: string[];
  artist: string | null;
  copyright: string | null;
  software: string | null;

  // Manual User Metadata & Tags
  userMetadata?: {
    isFavorite: boolean;
    caption: string | null;
    rating: number;
    tags: { id: number; name: string }[];
    people?: { id: number; name: string }[];
    isCaptionEdited?: boolean;
    isRatingEdited?: boolean;
    isTagsEdited?: boolean;
    isPeopleEdited?: boolean;
  };
}

function formatExposureTime(n: unknown): string | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1) return `${n.toFixed(1).replace(/\.0$/, "")}s`;
  const denom = Math.round(1 / n);
  return `1/${denom}s`;
}

function formatFNumber(n: unknown): string | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return `f/${n.toFixed(1).replace(/\.0$/, "")}`;
}

function formatFocalLength(n: unknown): string | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return `${Math.round(n)}mm`;
}

function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function formatAspectRatio(w: number, h: number): string | null {
  if (!w || !h || w <= 0 || h <= 0) return null;
  const divisor = gcd(w, h);
  const ratioW = Math.round(w / divisor);
  const ratioH = Math.round(h / divisor);

  // If numbers are too large to be an intuitive aspect ratio, approximate standard ratios
  if (ratioW > 25 || ratioH > 25) {
    const val = w / h;
    if (Math.abs(val - 1) < 0.02) return "1:1";
    if (Math.abs(val - 1.333) < 0.05) return val > 1 ? "4:3" : "3:4";
    if (Math.abs(val - 1.5) < 0.05) return val > 1 ? "3:2" : "2:3";
    if (Math.abs(val - 1.777) < 0.05) return val > 1 ? "16:9" : "9:16";
    return `${(w / h).toFixed(2)}:1`;
  }

  return `${ratioW}:${ratioH}`;
}

function extractString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof val === "object" && val !== null && "value" in val) {
    const inner = String((val as { value: unknown }).value).trim();
    return inner.length > 0 ? inner : null;
  }
  return String(val).trim();
}

function extractKeywords(raw: Record<string, unknown>): string[] {
  const results = new Set<string>();

  const candidates = [
    raw.Keywords,
    raw.XPKeywords,
    raw.subject,
    raw.LastKeywordXMP,
    raw.LastKeywordIPTC,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const str = extractString(item);
        if (str) {
          // Skip if this is actually a people tag (handled by extractPeople)
          if (!/^(people|person)[/|:]/i.test(str)) {
            results.add(str);
          }
        }
      }
    } else if (typeof candidate === "string") {
      const parts = candidate.split(/[,;]/);
      for (const part of parts) {
        const str = part.trim();
        if (str && !/^(people|person)[/|:]/i.test(str)) {
          results.add(str);
        }
      }
    }
  }

  return Array.from(results);
}

function extractPeople(raw: Record<string, unknown>): string[] {
  const results = new Set<string>();

  const addName = (val: unknown) => {
    if (!val) return;
    const str = extractString(val);
    if (!str) return;

    // Remove any prefix like "people/", "person/", "people|", "people:"
    const clean = str.replace(/^(people|person)[/|:]\s*/i, "").trim();
    if (clean && clean.length > 0 && !clean.includes("/")) {
      results.add(clean);
    }
  };

  // 1. Direct IPTC / XMP PersonInImage standard (Lightroom, Adobe Bridge, Photo Mechanic, ExifTool)
  const personCandidates = [
    raw.PersonInImage,
    raw["PersonInImage"],
    raw["Iptc4xmpExt:PersonInImage"],
    raw["iptc4xmpExt:PersonInImage"],
    raw.Persons,
    raw.People,
  ];

  for (const candidate of personCandidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      for (const item of candidate) addName(item);
    } else if (typeof candidate === "string") {
      for (const part of candidate.split(/[,;]/)) addName(part);
    }
  }

  // 2. Metadata Working Group (MWG) Face Regions (Picasa, Lightroom, DigiKam, Google Photos, Windows Photo)
  const regionInfo = (raw.RegionInfo ||
    raw["mwg-rs:RegionInfo"] ||
    raw.Regions) as Record<string, unknown> | undefined;

  if (regionInfo && typeof regionInfo === "object") {
    const list = (regionInfo.RegionList ||
      regionInfo.Regions ||
      regionInfo) as unknown;
    if (Array.isArray(list)) {
      for (const reg of list) {
        if (reg && typeof reg === "object") {
          const name =
            (reg as { Name?: unknown; PersonDisplayName?: unknown }).Name ||
            (reg as { Name?: unknown; PersonDisplayName?: unknown })
              .PersonDisplayName;
          addName(name);
        }
      }
    }
  }

  // 3. HierarchicalSubject or CatalogSets (Lightroom/DigiKam: "People|John Doe")
  const hierarchicalCandidates = [
    raw.HierarchicalSubject,
    raw["lr:hierarchicalSubject"],
    raw.CatalogSets,
  ];

  for (const candidate of hierarchicalCandidates) {
    if (!candidate) continue;
    const items = Array.isArray(candidate) ? candidate : [candidate];
    for (const item of items) {
      const str = extractString(item);
      if (str && /^(people|person)[/|:]/i.test(str)) {
        addName(str);
      }
    }
  }

  // 4. Keywords or Subject with people/ prefix
  const keywordCandidates = [raw.Keywords, raw.subject, raw.XPKeywords];
  for (const candidate of keywordCandidates) {
    if (!candidate) continue;
    const items = Array.isArray(candidate)
      ? candidate
      : typeof candidate === "string"
        ? candidate.split(/[,;]/)
        : [];
    for (const item of items) {
      const str = extractString(item);
      if (str && /^(people|person)[/|:]/i.test(str)) {
        addName(str);
      }
    }
  }

  return Array.from(results);
}

export async function getPhotoMetadata(
  libraryId: number,
  filePath: string,
): Promise<FormattedPhotoMetadata> {
  const absolutePath = resolveLibraryFile(libraryId, filePath);
  const stats = await fs.promises.stat(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = IMAGE_CONTENT_TYPES[ext] || "application/octet-stream";

  let rawExif: Record<string, unknown> = {};
  let gpsData: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  } | null = null;

  try {
    const fileBuffer = await fs.promises.readFile(absolutePath);

    try {
      rawExif =
        (await exifr.parse(fileBuffer, {
          tiff: true,
          xmp: true,
          icc: true,
          iptc: true,
          jfif: true,
          mergeOutput: true,
        })) || {};
    } catch (err) {
      console.warn(`Failed to parse EXIF for ${filePath}:`, err);
    }

    try {
      gpsData = await exifr.gps(fileBuffer);
    } catch {}
  } catch (err) {
    console.warn(`Failed to read file for EXIF parsing ${filePath}:`, err);
  }

  // Dimensions & image metadata fallback
  let orientation = rawExif.Orientation ?? rawExif.orientation;

  let width =
    typeof rawExif.ExifImageWidth === "number"
      ? rawExif.ExifImageWidth
      : typeof rawExif.ImageWidth === "number"
        ? rawExif.ImageWidth
        : null;

  let height =
    typeof rawExif.ExifImageHeight === "number"
      ? rawExif.ExifImageHeight
      : typeof rawExif.ImageHeight === "number"
        ? rawExif.ImageHeight
        : null;

  let colorSpace =
    extractString(rawExif.ColorSpace) ||
    extractString(rawExif.ProfileDescription);

  if (!width || !height) {
    try {
      const sharpMeta = await sharp(absolutePath).metadata();
      width = sharpMeta.width ?? null;
      height = sharpMeta.height ?? null;
      if (!orientation && sharpMeta.orientation) {
        orientation = sharpMeta.orientation;
      }
      if (!colorSpace && sharpMeta.space) {
        colorSpace = sharpMeta.space.toUpperCase();
      }
    } catch {}
  }

  // Adjust dimensions for rotated orientation (EXIF 5, 6, 7, 8 swap width and height visually)
  if (width && height && isOrientationRotated90(orientation)) {
    const temp = width;
    width = height;
    height = temp;
  }

  // Camera & Lens
  const cameraMake = extractString(rawExif.Make);
  let cameraModel = extractString(rawExif.Model);
  if (
    cameraMake &&
    cameraModel &&
    cameraModel.toLowerCase().startsWith(cameraMake.toLowerCase())
  ) {
    cameraModel = cameraModel.slice(cameraMake.length).trim();
  }

  const lensMake = extractString(rawExif.LensMake);
  const lensModel =
    extractString(rawExif.LensModel) || extractString(rawExif.Lens);

  // Exposure
  const focalLength = formatFocalLength(rawExif.FocalLength);
  const focalLength35mm = formatFocalLength(rawExif.FocalLengthIn35mmFormat);
  const aperture = formatFNumber(rawExif.FNumber);
  const shutterSpeed = formatExposureTime(rawExif.ExposureTime);
  const iso =
    typeof rawExif.ISO === "number" && Number.isFinite(rawExif.ISO)
      ? rawExif.ISO
      : null;

  let exposureCompensation: string | null = null;
  if (
    typeof rawExif.ExposureBiasValue === "number" &&
    Number.isFinite(rawExif.ExposureBiasValue)
  ) {
    const val = rawExif.ExposureBiasValue;
    exposureCompensation = `${val > 0 ? "+" : ""}${val.toFixed(1)} EV`;
  }

  let flash: string | null = null;
  if (typeof rawExif.Flash === "string") {
    flash = rawExif.Flash;
  } else if (typeof rawExif.Flash === "number") {
    flash = (rawExif.Flash & 1) !== 0 ? "Fired" : "Did not fire";
  }

  // Date
  let capturedAt: string | null = null;
  const rawDate =
    rawExif.DateTimeOriginal || rawExif.CreateDate || rawExif.ModifyDate;
  if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
    capturedAt = rawDate.toISOString();
  } else if (typeof rawDate === "string") {
    try {
      const parsed = new Date(rawDate);
      if (!Number.isNaN(parsed.getTime())) {
        capturedAt = parsed.toISOString();
      }
    } catch {}
  }

  // GPS
  const latitude =
    gpsData?.latitude ??
    (typeof rawExif.latitude === "number" ? rawExif.latitude : null);
  const longitude =
    gpsData?.longitude ??
    (typeof rawExif.longitude === "number" ? rawExif.longitude : null);
  const altitude =
    gpsData?.altitude ??
    (typeof rawExif.altitude === "number"
      ? Math.round(rawExif.altitude)
      : null);

  let locationString: string | null = null;
  let googleMapsUrl: string | null = null;
  let openStreetMapUrl: string | null = null;

  if (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    locationString = formatCoordinates(latitude, longitude);
    googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    openStreetMapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
  }

  // Megapixels & Aspect ratio
  let megapixels: string | null = null;
  let aspectRatio: string | null = null;
  if (width && height) {
    megapixels = `${((width * height) / 1000000).toFixed(1)} MP`;
    aspectRatio = formatAspectRatio(width, height);
  }

  return {
    fileName: path.posix.basename(filePath),
    filePath,
    fileSizeBytes: stats.size,
    mimeType,
    width,
    height,
    megapixels,
    aspectRatio,
    colorSpace: colorSpace || "sRGB",

    capturedAt,
    modifiedAt: stats.mtime.toISOString(),

    cameraMake,
    cameraModel,
    lensMake,
    lensModel,

    focalLength,
    focalLength35mm,
    aperture,
    shutterSpeed,
    iso,
    exposureCompensation,
    flash,

    latitude,
    longitude,
    altitude,
    locationString,
    googleMapsUrl,
    openStreetMapUrl,

    title:
      extractString(rawExif.title) || extractString(rawExif.ImageDescription),
    description:
      extractString(rawExif.description) || extractString(rawExif.Caption),
    keywords: extractKeywords(rawExif),
    artist: extractString(rawExif.Artist) || extractString(rawExif.Byline),
    copyright: extractString(rawExif.Copyright),
    software: extractString(rawExif.Software),
  };
}

export interface ScannedEmbeddedMetadata {
  width: number | null;
  height: number | null;
  capturedAt: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  focalLength: string | null;
  focalLength35mm: string | null;
  aperture: string | null;
  shutterSpeed: string | null;
  iso: number | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  embeddedCaption: string | null;
  embeddedRating: number | null;
  embeddedKeywords: string[];
  embeddedPeople: string[];
}

export async function extractEmbeddedPhotoData(
  absolutePath: string,
): Promise<ScannedEmbeddedMetadata> {
  let rawExif: Record<string, unknown> = {};
  let gpsData: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  } | null = null;

  try {
    rawExif =
      (await exifr.parse(absolutePath, {
        tiff: true,
        xmp: true,
        icc: true,
        iptc: true,
        jfif: true,
        mergeOutput: true,
      })) || {};
  } catch {}

  try {
    gpsData = await exifr.gps(absolutePath);
  } catch {}

  let orientation = rawExif.Orientation ?? rawExif.orientation;

  let width =
    typeof rawExif.ExifImageWidth === "number"
      ? rawExif.ExifImageWidth
      : typeof rawExif.ImageWidth === "number"
        ? rawExif.ImageWidth
        : null;

  let height =
    typeof rawExif.ExifImageHeight === "number"
      ? rawExif.ExifImageHeight
      : typeof rawExif.ImageHeight === "number"
        ? rawExif.ImageHeight
        : null;

  if (!width || !height) {
    try {
      const sharpMeta = await sharp(absolutePath).metadata();
      width = sharpMeta.width ?? null;
      height = sharpMeta.height ?? null;
      if (!orientation && sharpMeta.orientation) {
        orientation = sharpMeta.orientation;
      }
    } catch {}
  }

  // Adjust dimensions for rotated orientation (EXIF 5, 6, 7, 8 swap width and height visually)
  if (width && height && isOrientationRotated90(orientation)) {
    const temp = width;
    width = height;
    height = temp;
  }

  const cameraMake = extractString(rawExif.Make);
  let cameraModel = extractString(rawExif.Model);
  if (
    cameraMake &&
    cameraModel &&
    cameraModel.toLowerCase().startsWith(cameraMake.toLowerCase())
  ) {
    cameraModel = cameraModel.slice(cameraMake.length).trim();
  }

  const lensModel =
    extractString(rawExif.LensModel) || extractString(rawExif.Lens);

  const focalLength = formatFocalLength(rawExif.FocalLength);
  const focalLength35mm = formatFocalLength(rawExif.FocalLengthIn35mmFormat);
  const aperture = formatFNumber(rawExif.FNumber);
  const shutterSpeed = formatExposureTime(rawExif.ExposureTime);
  const iso =
    typeof rawExif.ISO === "number" && Number.isFinite(rawExif.ISO)
      ? rawExif.ISO
      : null;

  let capturedAt: string | null = null;
  const rawDate =
    rawExif.DateTimeOriginal || rawExif.CreateDate || rawExif.ModifyDate;
  if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
    capturedAt = rawDate.toISOString();
  } else if (typeof rawDate === "string") {
    try {
      const parsed = new Date(rawDate);
      if (!Number.isNaN(parsed.getTime())) {
        capturedAt = parsed.toISOString();
      }
    } catch {}
  }

  const latitude =
    gpsData?.latitude ??
    (typeof rawExif.latitude === "number" ? rawExif.latitude : null);
  const longitude =
    gpsData?.longitude ??
    (typeof rawExif.longitude === "number" ? rawExif.longitude : null);
  const altitude =
    gpsData?.altitude ??
    (typeof rawExif.altitude === "number"
      ? Math.round(rawExif.altitude)
      : null);

  const embeddedCaption =
    extractString(rawExif.title) ||
    extractString(rawExif.ImageDescription) ||
    extractString(rawExif.description) ||
    extractString(rawExif.Caption);

  let embeddedRating: number | null = null;
  if (typeof rawExif.Rating === "number" && Number.isFinite(rawExif.Rating)) {
    embeddedRating = Math.max(0, Math.min(5, Math.round(rawExif.Rating)));
  }

  const embeddedKeywords = extractKeywords(rawExif);
  const embeddedPeople = extractPeople(rawExif);

  return {
    width,
    height,
    capturedAt,
    cameraMake,
    cameraModel,
    lensModel,
    focalLength,
    focalLength35mm,
    aperture,
    shutterSpeed,
    iso,
    latitude,
    longitude,
    altitude,
    embeddedCaption,
    embeddedRating,
    embeddedKeywords,
    embeddedPeople,
  };
}
