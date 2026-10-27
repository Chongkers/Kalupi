"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanScreenshot } from "@/components/finance/scan-screenshot";
import { TransactionForm } from "@/components/finance/transaction-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverview } from "@/lib/local/hooks";

// ---------------------------------------------------------------------------
// Whether the Add entry modal is open, shared by the buttons that open it (bottom bar, dashboard)
// and the one modal in the app layout. `mounted` is false until the app's data is ready.
// ---------------------------------------------------------------------------

let state = { open: false, mounted: false };
const listeners = new Set<() => void>();

function set(patch: Partial<typeof state>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

const addEntryStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
};

const serverState = { open: false, mounted: false };
const useAddEntry = () => useSyncExternalStore(addEntryStore.subscribe, addEntryStore.get, () => serverState);

/**
 * Scan a screenshot, then the entry form. Used by the modal and the /add page. Starts empty after
 * every save: pages are kept when you navigate away (cacheComponents), so /add would otherwise come
 * back with the last entry still filled in.
 */
export function AddEntryForm({ onSaved }: { onSaved?: () => void }) {
  const [round, setRound] = useState(0);
  const router = useRouter();
  return (
    <AddEntryFields
      key={round}
      onSaved={() => {
        setRound((r) => r + 1);
        if (onSaved) onSaved();
        else router.push("/transactions");
      }}
    />
  );
}

function AddEntryFields({ onSaved }: { onSaved: () => void }) {
  const overview = useOverview();
  const [scanned, setScanned] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <ScanScreenshot onAmount={setScanned} />
      {overview ? (
        <TransactionForm
          accounts={overview.accounts}
          categories={overview.categories}
          available={overview.available}
          budget={overview.budget}
          today={overview.today}
          scannedAmount={scanned}
          presets={overview.presets}
          onSaved={onSaved}
        />
      ) : (
        <Skeleton className="h-[32rem] w-full" />
      )}
    </div>
  );
}

/** The Add entry modal. Rendered once, inside LocalDataProvider so it only exists once data is ready. */
export function AddEntryDialog() {
  const { open } = useAddEntry();

  useEffect(() => {
    set({ mounted: true });
    return () => set({ mounted: false, open: false });
  }, []);

  return (
    <Dialog open={open} onOpenChange={(o) => set({ open: o })}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto p-5 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Add entry</DialogTitle>
          <DialogDescription>Log money in, out, or between accounts</DialogDescription>
        </DialogHeader>
        {/* Unmounted when closed, so each opening starts with an empty form */}
        {open && (
          <AddEntryForm
            onSaved={() => {
              set({ open: false });
              toast.success("Entry saved");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A link to /add that opens the modal instead once the app is ready. */
export function AddEntryLink(props: Omit<React.ComponentProps<typeof Link>, "href">) {
  const { mounted } = useAddEntry();
  return (
    <Link
      href="/add"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!mounted || event.defaultPrevented) return;
        event.preventDefault();
        set({ open: true });
      }}
    />
  );
}
