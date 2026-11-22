import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  serverExternalPackages: ["exifr", "better-sqlite3", "sharp"],
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    proxyClientMaxBodySize: "250mb",
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/photos",
        permanent: false,
      },
      {
        source: "/settings",
        destination: "/settings/libraries",
        permanent: false,
      },
    ];
  },
  // Fallback configuration for Next.js Image Optimization.
  // Note: Most components use `<Image ... unoptimized />` because thumbnails are
  // already resized and cached as WebP directly via Sharp at `/api/gallery/image`.
  // This block acts as a safety allowlist if any `<Image />` is rendered without `unoptimized`.
  images: {
    localPatterns: [{ pathname: "/api/gallery/image" }],
    qualities: [60, 75, 80, 85],
    minimumCacheTTL: 2_592_000,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
