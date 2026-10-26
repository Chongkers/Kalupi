import type { MetadataRoute } from "next";

// Makes Kalupi installable: Android "Install app", iOS Safari → Share → Add to Home Screen
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kalupi",
    short_name: "Kalupi",
    description: "Budget and savings tracker that works offline",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f7fe",
    theme_color: "#f8f7fe",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
