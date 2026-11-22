"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Camera,
  Heart,
  Loader2,
  MapPin,
  Star,
  Tag,
  User,
  Users,
} from "lucide-react";
import { galleryImageUrl } from "@/lib/gallery-image-url";
import type { ExploreSummary } from "@/lib/database";

interface ExploreHubViewProps {
  summary: ExploreSummary | null;
  loading: boolean;
  error: string;
  libraryId: number;
}

export function ExploreHubView({
  summary,
  loading,
  error,
  libraryId,
}: ExploreHubViewProps) {
  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="size-8 animate-spin text-accent mx-auto mb-3" />
        <p className="text-xs text-text-secondary">Loading Explore collections...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-400">
        {error}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-10">
      {/* 1. Smart Quick Collections */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          Smart Collections
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Favorites Card */}
          <Link
            href="/explore?collection=favorites"
            className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl border border-border-subtle bg-bg-card p-4 transition duration-300 hover:border-rose-500/40 hover:shadow-lg hover:shadow-rose-500/10"
          >
            {summary.smartCollections.favorites.coverPath ? (
              <Image
                src={galleryImageUrl(
                  summary.smartCollections.favorites.coverPath,
                  libraryId,
                  undefined,
                  undefined,
                  400,
                )}
                alt="Favorites cover"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-bg-hover" />
            )}
            <div className="relative z-10 flex size-9 items-center justify-center rounded-xl bg-black/60 border border-white/10 text-rose-400 backdrop-blur-md shadow-md">
              <Heart size={18} className="fill-current" />
            </div>
            {/* Inward bottom gradient matching Album and Folder cards */}
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-12 pb-3 px-4 pointer-events-none">
              <div className="text-base font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] group-hover:text-rose-300 transition">
                Favorites
              </div>
              <div className="mt-0.5 text-xs font-medium text-white/85 drop-shadow">
                {summary.smartCollections.favorites.count} photo
                {summary.smartCollections.favorites.count === 1 ? "" : "s"}
              </div>
            </div>
          </Link>

          {/* Top Rated Card */}
          <Link
            href="/explore?collection=top-rated"
            className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl border border-border-subtle bg-bg-card p-4 transition duration-300 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10"
          >
            {summary.smartCollections.topRated.coverPath ? (
              <Image
                src={galleryImageUrl(
                  summary.smartCollections.topRated.coverPath,
                  libraryId,
                  undefined,
                  undefined,
                  400,
                )}
                alt="Top Rated cover"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-bg-hover" />
            )}
            <div className="relative z-10 flex size-9 items-center justify-center rounded-xl bg-black/60 border border-white/10 text-amber-400 backdrop-blur-md shadow-md">
              <Star size={18} className="fill-current" />
            </div>
            {/* Inward bottom gradient matching Album and Folder cards */}
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-12 pb-3 px-4 pointer-events-none">
              <div className="text-base font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] group-hover:text-amber-300 transition">
                Top Rated
              </div>
              <div className="mt-0.5 text-xs font-medium text-white/85 drop-shadow">
                {summary.smartCollections.topRated.count} photo
                {summary.smartCollections.topRated.count === 1 ? "" : "s"} (4–5 stars)
              </div>
            </div>
          </Link>

          {/* Places / Geotagged Card */}
          <Link
            href="/explore?collection=places"
            className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl border border-border-subtle bg-bg-card p-4 transition duration-300 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10"
          >
            {summary.smartCollections.places.coverPath ? (
              <Image
                src={galleryImageUrl(
                  summary.smartCollections.places.coverPath,
                  libraryId,
                  undefined,
                  undefined,
                  400,
                )}
                alt="Places cover"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-bg-hover" />
            )}
            <div className="relative z-10 flex size-9 items-center justify-center rounded-xl bg-black/60 border border-white/10 text-emerald-400 backdrop-blur-md shadow-md">
              <MapPin size={18} />
            </div>
            {/* Inward bottom gradient matching Album and Folder cards */}
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-12 pb-3 px-4 pointer-events-none">
              <div className="text-base font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] group-hover:text-emerald-300 transition">
                Places & GPS
              </div>
              <div className="mt-0.5 text-xs font-medium text-white/85 drop-shadow">
                {summary.smartCollections.places.count} geotagged photo
                {summary.smartCollections.places.count === 1 ? "" : "s"}
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* 2. People (Circular Profile Bubbles) */}
      {summary.people && summary.people.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              People ({summary.people.length})
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {summary.people.map((person) => (
              <Link
                key={person.id}
                href={`/explore?person=${encodeURIComponent(person.name)}`}
                className="group flex flex-col items-center gap-2.5 text-center"
              >
                <div className="relative size-20 sm:size-24 overflow-hidden rounded-full border-2 border-border-subtle bg-bg-card transition duration-300 group-hover:scale-105 group-hover:border-accent group-hover:shadow-lg group-hover:shadow-accent/20">
                  {person.coverPath ? (
                    <Image
                      src={galleryImageUrl(
                        person.coverPath,
                        libraryId,
                        undefined,
                        undefined,
                        260,
                      )}
                      alt={person.name}
                      fill
                      unoptimized
                      sizes="96px"
                      className="object-cover transition duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-bg-card-subtle text-text-secondary">
                      <User size={32} />
                    </div>
                  )}
                </div>
                <div className="w-full px-1">
                  <div className="truncate text-xs font-semibold text-foreground capitalize group-hover:text-accent transition">
                    {person.name}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {person.count} photo{person.count === 1 ? "" : "s"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. Tags & Topics */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-accent" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            Tags & Topics ({summary.tags.length})
          </h3>
        </div>

        {summary.tags.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {summary.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/explore?tag=${encodeURIComponent(tag.name)}`}
                className="group relative flex h-28 flex-col justify-end overflow-hidden rounded-2xl border border-border-subtle bg-bg-card p-3 transition duration-300 hover:border-accent/50 hover:shadow-lg"
              >
                {tag.coverPath ? (
                  <Image
                    src={galleryImageUrl(
                      tag.coverPath,
                      libraryId,
                      undefined,
                      undefined,
                      400,
                    )}
                    alt={tag.name}
                    fill
                    unoptimized
                    sizes="260px"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-bg-input" />
                )}
                {/* Inward bottom shadow gradient for clear text readability */}
                <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="truncate text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] group-hover:text-accent transition">
                    #{tag.name}
                  </div>
                  <div className="text-[11px] font-medium text-white/85 drop-shadow">
                    {tag.count} photo{tag.count === 1 ? "" : "s"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border-subtle bg-bg-card/50 p-8 text-center text-xs text-text-muted">
            No tags found. Add tags to photos or scan files containing embedded keywords.
          </div>
        )}
      </section>

      {/* 3. Cameras & Equipment */}
      {summary.cameras.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Cameras & Equipment ({summary.cameras.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {summary.cameras.map((cam, idx) => (
              <Link
                key={idx}
                href={`/explore?camera=${encodeURIComponent(cam.displayName)}`}
                className="group relative flex h-24 items-center gap-3.5 overflow-hidden rounded-2xl border border-border-subtle bg-bg-card p-3 transition duration-300 hover:border-accent/50"
              >
                {cam.coverPath ? (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border-subtle">
                    <Image
                      src={galleryImageUrl(
                        cam.coverPath,
                        libraryId,
                        undefined,
                        undefined,
                        160,
                      )}
                      alt={cam.displayName}
                      fill
                      unoptimized
                      sizes="160px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-bg-hover text-text-muted">
                    <Camera size={24} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground group-hover:text-accent transition">
                    {cam.displayName}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {cam.count} photo{cam.count === 1 ? "" : "s"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 4. Years Archives */}
      {summary.years.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Timeline Archives ({summary.years.length})
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {summary.years.map((y) => (
              <Link
                key={y.year}
                href={`/explore?year=${encodeURIComponent(y.year)}`}
                className="group relative flex h-24 flex-col justify-end overflow-hidden rounded-2xl border border-border-subtle bg-bg-card p-3 transition duration-300 hover:border-amber-400/50"
              >
                {y.coverPath && (
                  <Image
                    src={galleryImageUrl(
                      y.coverPath,
                      libraryId,
                      undefined,
                      undefined,
                      400,
                    )}
                    alt={y.year}
                    fill
                    unoptimized
                    sizes="260px"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                )}
                {/* Inward bottom shadow gradient for clear text readability */}
                <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] group-hover:text-amber-300 transition">
                    {y.year}
                  </div>
                  <div className="text-[11px] font-medium text-white/85 drop-shadow">
                    {y.count} photo{y.count === 1 ? "" : "s"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
