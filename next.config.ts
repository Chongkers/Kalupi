import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // A package-lock.json in the home folder otherwise gets picked as the root
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// withSerwist keeps esbuild out of the server bundle; it builds the service worker (src/app/serwist)
export default withSerwist(nextConfig);