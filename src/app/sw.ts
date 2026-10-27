/// <reference lib="webworker" />
// Service worker, bundled by src/app/serwist/[path]/route.ts and served at /serwist/sw.js.
// Precaches the app's JS and CSS so every screen opens offline; data comes from IndexedDB, not here.
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheableResponsePlugin, CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Auth links and the worker itself must always hit the network
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/serwist/")),
      handler: new NetworkOnly(),
    },
    // Screenshot scan (src/lib/scan/ocr.ts): the OCR worker, engine and language file. Versioned
    // URLs that never change, so keep them once downloaded and scanning works offline.
    {
      matcher: ({ url, sameOrigin }) =>
        (sameOrigin && url.pathname.startsWith("/tesseract/")) ||
        (url.hostname === "cdn.jsdelivr.net" && /^\/npm\/(tesseract\.js|@tesseract\.js-data)/.test(url.pathname)),
      handler: new CacheFirst({
        cacheName: "ocr",
        // Status 0: worker importScripts from the CDN come back opaque
        plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 16 })],
      }),
    },
    // Pages: network first, the saved copy when offline. One copy per page, whatever its ?query
    // (/transactions?month=… and /transactions/edit?id=… render from local data on the device).
    // Matches by URL shape, not request.mode, so pages pre-saved by the app (CACHE_URLS) land here too.
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        request.method === "GET" &&
        request.headers.get("RSC") !== "1" &&
        !url.pathname.startsWith("/_next/") &&
        !/\.[a-z0-9]+$/i.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 4,
        matchOptions: { ignoreSearch: true },
        plugins: [
          new ExpirationPlugin({ maxEntries: 64 }),
          // Don't save the login page under an app URL when a logged-out visit gets redirected
          { cacheWillUpdate: async ({ response }) => (response.ok && !response.redirected ? response : null) },
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: "/~offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();

// ---------------------------------------------------------------------------
// Bill reminders (v1.0.4): shown when the daily cron pushes "due today".
// Payload: { title, body, url, tag }. Tapping it opens the bill's pay dialog.
// ---------------------------------------------------------------------------

type PushPayload = { title?: string; body?: string; url?: string; tag?: string };

self.addEventListener("push", (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Kalupi", {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url ?? "/bills" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string })?.url ?? "/bills", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse an open Kalupi window if there is one
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        await open.navigate(url);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
