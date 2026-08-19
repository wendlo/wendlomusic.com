import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js stops inferring it from an unrelated
  // parent-directory lockfile (~/package-lock.json). Without this, the build
  // warns and could resolve modules against the wrong root.
  turbopack: {
    root: path.join(__dirname),
  },
  // The embedded Sanity Studio bundle (sanity / next-sanity) and its
  // styled-components dependency ship ESM that Turbopack must transpile in the
  // app graph; without this the build fails resolving `swr`'s default export.
  transpilePackages: ['sanity', 'next-sanity', '@sanity/vision', 'styled-components'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
    ],
  },
};

export default nextConfig;
