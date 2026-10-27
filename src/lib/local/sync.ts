// Outbox sync (docs/erd.md, Sync):
//   push: send local changes to Supabase in the order they were made
//   pull: fetch rows whose updated_at is newer than the last pull, including soft-deleted ones
// Conflicts resolve as last write wins: whatever reaches the server last.
import { createClient } from "@/lib/supabase/client";
import { db, getMeta, rowKey, setMeta, SYNCED_TABLES, type OutboxEntry, type SyncedTable } from "./db";

const PAGE_SIZE = 1000;
// Re-read a little before the cursor: rows committed slightly out of order still get picked up
const CURSOR_OVERLAP_MS = 2 * 60 * 1000;
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

// PostgREST "table not in schema cache" and Postgres "relation does not exist"
const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"]);

const CONFLICT_TARGET: Partial<Record<SyncedTable, string>> = {
  tracker_members: "tracker_id,user_id",
};

// ---------------------------------------------------------------------------
// Status, for the indicator (read with useSyncStatus)
// ---------------------------------------------------------------------------

export type SyncStatus = {
  online: boolean;
  syncing: boolean;
  /** ISO time of the last complete push + pull */
  lastSyncedAt: string | null;
  /** Last network or server problem, cleared by the next good sync */
  error: string | null;
};

let status: SyncStatus = { online: true, syncing: false, lastSyncedAt: null, error: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener());
}

export const syncStatusStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => status,
};

// ---------------------------------------------------------------------------
// Running a sync
// ---------------------------------------------------------------------------

let running: Promise<void> | null = null;
let again = false;
let stopped = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryCount = 0;

/** Push then pull. Safe to call often: overlapping calls collapse into one follow-up run. */
export function syncNow(): Promise<void> {
  if (stopped) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await withLock(runOnce);
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

let debounce: ReturnType<typeof setTimeout> | undefined;
/** Call after a local write: syncs shortly after, batching quick edits together. */
export function scheduleSync(delayMs = 400) {
  clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), delayMs);
}

/**
 * For logout: no more syncs until the page reloads. Waits for a running one, so a pull that's
 * still in flight can't write the user's rows back after the device is wiped.
 */
export async function stopSync() {
  stopped = true;
  again = false;
  clearTimeout(debounce);
  clearTimeout(retryTimer);
  await running;
}

// Only one tab syncs at a time
async function withLock(fn: () => Promise<void>) {
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request("kalupi-sync", fn);
  } else {
    await fn();
  }
}

async function runOnce() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setStatus({ online: false, syncing: false });
    return;
  }
  setStatus({ online: true, syncing: true });
  clearTimeout(retryTimer);

  try {
    await push();
    await pull();
    retryCount = 0;
    setStatus({ syncing: false, lastSyncedAt: new Date().toISOString(), error: null });
    await setMeta("lastSyncedAt", new Date().toISOString());
  } catch (error) {
    // Network or server hiccup: try again with growing gaps
    const delay = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
    retryCount += 1;
    retryTimer = setTimeout(() => void syncNow(), delay);
    setStatus({ syncing: false, error: message(error) });
  }
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

class TransientError extends Error {}

async function push() {
  const supabase = createClient();

  for (;;) {
    const entry = await db.outbox.orderBy("seq").filter((e) => !e.failed).first();
    if (!entry) return;

    // updated_at is the sync cursor, so only the server's clock may set it
    const payload: Record<string, unknown> = { ...entry.row };
    delete payload.updated_at;
    const { data, error, status: httpStatus } = await supabase
      .from(entry.table)
      .upsert(payload, { onConflict: CONFLICT_TARGET[entry.table] ?? "id" })
      .select()
      .maybeSingle();

    if (error) {
      if (isTransient(httpStatus, error)) {
        await db.outbox.update(entry.seq!, { attempts: entry.attempts + 1 });
        throw new TransientError(error.message);
      }
      // Rejected for good (permission, constraint): park it and restore the server's version
      await db.outbox.update(entry.seq!, { failed: error.message, attempts: entry.attempts + 1 });
      await restoreFromServer(entry);
      continue;
    }

    await db.transaction("rw", db.outbox, db.table(entry.table), async () => {
      await db.outbox.delete(entry.seq!);
      // Keep the server copy (it has the real updated_at), unless the row changed again meanwhile
      const stillPending = await db.outbox.where("key").equals(entry.key).filter((e) => !e.failed).count();
      if (data && !stillPending) await db.table(entry.table).put(data);
    });
  }
}

function isTransient(httpStatus: number, error: { code?: string; message: string }) {
  // status 0 = the request never reached the server; 401 = session expired, fixed by a token refresh
  return httpStatus === 0 || httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500 || !error.code;
}

async function restoreFromServer(entry: OutboxEntry) {
  const supabase = createClient();
  const query = supabase.from(entry.table).select();
  const member = entry.row as { tracker_id: string; user_id: string };
  const isMember = entry.table === "tracker_members";

  const { data } = isMember
    ? await query.eq("tracker_id", member.tracker_id).eq("user_id", member.user_id).maybeSingle()
    : await query.eq("id", entry.key).maybeSingle();

  const table = db.table(entry.table);
  if (data) await table.put(data);
  else await table.delete(isMember ? [member.tracker_id, member.user_id] : entry.key);
}

/** Changes Supabase refused. Shown by the sync indicator; dismissing removes them. */
export async function dismissFailed() {
  await db.outbox.filter((e) => !!e.failed).delete();
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

async function pull() {
  const supabase = createClient();

  for (const table of SYNCED_TABLES) {
    const cursorKey = `cursor:${table}`;
    const cursor = await getMeta<string>(cursorKey);
    const since = cursor ? new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString() : null;
    let newest = cursor ?? null;

    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase.from(table).select().order("updated_at").range(from, from + PAGE_SIZE - 1);
      if (since) query = query.gt("updated_at", since);
      const { data, error, status: httpStatus } = await query;
      // A table this app version knows but the database doesn't have yet (its migration hasn't
      // been run): skip it so everything else still syncs. It's picked up once the table exists.
      if (error && MISSING_TABLE_CODES.has(error.code ?? "")) {
        console.warn(`Sync: skipping ${table}; run its migration in Supabase.`);
        break;
      }
      if (error) throw isTransient(httpStatus, error) ? new TransientError(error.message) : new Error(error.message);
      if (!data?.length) break;

      await db.transaction("rw", db.outbox, db.table(table), async () => {
        const pending = new Set(
          (await db.outbox.filter((e) => e.table === table && !e.failed).toArray()).map((e) => e.key),
        );
        // Don't overwrite rows the user changed here and hasn't sent yet
        await db.table(table).bulkPut(data.filter((row) => !pending.has(rowKey(table, row))));
      });

      newest = data[data.length - 1].updated_at;
      if (data.length < PAGE_SIZE) break;
    }

    if (newest) await setMeta(cursorKey, newest);
  }

  // Shared tracker totals: members can't read each other's transactions, so the server sums them.
  // Cached so tracker screens work offline.
  const progress = await supabase.rpc("tracker_progress");
  if (!progress.error) await setMeta("trackerProgress", progress.data ?? []);

  // Display name for the account menu (profiles aren't a synced table)
  const owner = await getMeta<{ userId: string }>("owner");
  if (owner) {
    const { data } = await supabase.from("profiles").select("*").eq("id", owner.userId).maybeSingle();
    if (data) {
      await setMeta("displayName", data.display_name);
      await setMeta("avatarUrl", data.avatar_url ?? null);
    }
  }
  await setMeta("pulledOnce", true);
}

/**
 * Pull these tables from the start on the next sync. Needed after joining a tracker: its rows
 * (and the other members') are older than this device's cursor, so a normal pull would skip them.
 */
export async function resyncTables(tables: SyncedTable[]) {
  await db.meta.bulkDelete(tables.map((table) => `cursor:${table}`));
  await syncNow();
}

function message(error: unknown) {
  if (error instanceof TypeError) return "Can't reach the server";
  return error instanceof Error ? error.message : "Sync failed";
}
