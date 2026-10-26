"use client";

import { Check, CloudOff, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSyncStatus } from "@/lib/local/hooks";
import { dismissFailed, syncNow } from "@/lib/local/sync";
import { cn } from "@/lib/utils";

const changes = (n: number) => `${n} ${n === 1 ? "change" : "changes"}`;

/** Synced / Syncing / Offline · N changes waiting / N changes couldn't sync. Tap for details. */
export function SyncStatus({ className }: { className?: string }) {
  const { online, syncing, pending, failed, error, lastSyncedAt } = useSyncStatus();

  const state = failed.length > 0 ? "failed" : !online ? "offline" : syncing || pending > 0 ? "syncing" : error ? "retrying" : "synced";

  const label = {
    failed: `${changes(failed.length)} couldn't sync`,
    offline: pending > 0 ? `Offline · ${changes(pending)} waiting` : "Offline",
    syncing: pending > 0 ? `Syncing ${changes(pending)}` : "Syncing…",
    retrying: "Retrying soon",
    synced: "Synced",
  }[state];

  const Icon = { failed: TriangleAlert, offline: CloudOff, syncing: LoaderCircle, retrying: CloudOff, synced: Check }[state];

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          state === "synced" && "bg-mint text-mint-foreground",
          (state === "offline" || state === "retrying" || state === "syncing") && "bg-muted text-muted-foreground",
          state === "failed" && "bg-destructive/10 text-destructive",
          className,
        )}
      >
        <Icon className={cn("size-3.5", state === "syncing" && "animate-spin")} />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-3 text-sm">
        {state === "offline" && <p>You&apos;re offline. Keep logging; changes are saved on this device and sync when you reconnect.</p>}
        {state === "retrying" && <p>Couldn&apos;t reach the server ({error}). Kalupi will try again shortly.</p>}
        {(state === "synced" || state === "syncing") && (
          <p className="text-muted-foreground">
            {lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}.` : "Syncing with the server."}
          </p>
        )}
        {failed.length > 0 && (
          <>
            <p>The server refused these changes, so they were undone on this device:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
              {failed.slice(0, 5).map((entry) => (
                <li key={entry.seq}>
                  {entry.table.replace("_", " ")}: {entry.failed}
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" onClick={() => void dismissFailed()}>
              Dismiss
            </Button>
          </>
        )}
        {online && state !== "syncing" && (
          <Button size="sm" onClick={() => void syncNow()}>
            Sync now
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
