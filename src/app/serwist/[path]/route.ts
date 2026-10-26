import { createSerwistRoute } from "@serwist/turbopack";

// Builds src/app/sw.ts into /serwist/sw.js at build time, with the list of files to precache.
// Only GET and generateStaticParams are exported: Cache Components rejects the segment config
// (dynamic, revalidate) the helper also returns, and the fixed file list prerenders anyway.
const { GET, generateStaticParams } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  // A new revision each build, so the offline page refreshes with each release
  additionalPrecacheEntries: [{ url: "/~offline", revision: crypto.randomUUID() }],
  // Native esbuild (a dev dependency) instead of the wasm build, on every platform including Vercel
  useNativeEsbuild: true,
});

export { GET, generateStaticParams };
