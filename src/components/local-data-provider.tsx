"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, RefreshCw } from "lucide-react";
import { loggingOutStore } from "@/components/app-shell/logout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { clearLocalData, db, getMeta, setMeta } from "@/lib/local/db";
import { ensureMonthBudget } from "@/lib/local/mutations";
import { syncNow } from "@/lib/local/sync";
import { createClient } from "@/lib/supabase/client";

type Phase = "loading" | "ready" | "needs-network";

const SYNC_EVERY_MS = 30_000;

// Saved for offline use as soon as the app is ready, not just when first visited
const APP_ROUTES = [
  "/",
  "/add",
  "/transactions",
  "/transactions/edit",
  "/budgets",
  "/trackers",
  "/trackers/view",
  "/history",
  "/settings",
  "/settings/accounts",
  "/settings/categories",
  "/settings/presets",
];

function saveScreensForOffline() {
  if (!("serviceWorker" in navigator) || !navigator.onLine) return;
  void navigator.serviceWorker.ready.then((registration) =>
    registration.active?.postMessage({ type: "CACHE_URLS", payload: { urlsToCache: APP_ROUTES } }),
  );
}

/**
 * Opens the on-device database for the logged-in user and keeps it synced.
 * Children render once local data is ready (after the first download on a new device).
 */
export function LocalDataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("loading");

  // Works out where this device stands; the caller applies the result
  const prepare = useCallback(async (): Promise<Phase | "login"> => {
    const owner = await getMeta<{ userId: string; email: string }>("owner");

    // Reads the session from cookies; no network needed unless the token must refresh
    const { data } = await createClient()
      .auth.getSession()
      .catch(() => ({ data: { session: null } }));
    const user = data.session?.user;

    if (!user) {
      // Offline with an expired token: trust the last user who synced on this device
      if (!navigator.onLine && owner) return (await getMeta("pulledOnce")) ? "ready" : "needs-network";
      return "login";
    }

    if (owner && owner.userId !== user.id) await clearLocalData();
    await setMeta("owner", { userId: user.id, email: user.email ?? "" });

    if (!(await getMeta("pulledOnce"))) {
      if (!navigator.onLine) return "needs-network";
      await syncNow();
      if (!(await getMeta("pulledOnce"))) return "needs-network";
    }
    return "ready";
  }, []);

  const start = useCallback(
    () =>
      prepare().then((next) => {
        if (next === "login") return router.replace("/login");
        setPhase(next);
        if (next === "ready") {
          void syncNow().then(() => ensureMonthBudget());
          saveScreensForOffline();
        }
      }),
    [prepare, router],
  );

  useEffect(() => {
    void start();
  }, [start]);

  // Keep syncing: when the connection returns, when the app comes back to the front, and every 30s
  useEffect(() => {
    if (phase !== "ready") return;
    const sync = () => void syncNow().then(() => ensureMonthBudget());
    const onVisible = () => document.visibilityState === "visible" && sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => document.visibilityState === "visible" && sync(), SYNC_EVERY_MS);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [phase]);

  const loggingOut = useSyncExternalStore(loggingOutStore.subscribe, loggingOutStore.get, () => false);
  const accountCount = useLiveQuery(() => db.accounts.filter((a) => !a.deleted_at).count(), [], -1);
  // Before setup, every page sends you to the dashboard, where the startup wizard opens
  const wrongPlace = phase === "ready" && !loggingOut && accountCount === 0 && pathname !== "/";

  useEffect(() => {
    if (wrongPlace) router.replace("/");
  }, [wrongPlace, router]);

  if (phase === "needs-network") {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
        <CloudOff className="size-10 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Connect to load your data</h2>
          <p className="text-sm text-muted-foreground">
            Kalupi needs the internet once on this device to download your accounts. After that it works offline.
          </p>
        </div>
        <Button
          onClick={() => {
            setPhase("loading");
            void start();
          }}
        >
          <RefreshCw /> Try again
        </Button>
      </div>
    );
  }

  if (phase === "loading" || loggingOut || accountCount < 0 || wrongPlace) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return children;
}
