"use client";

import { logout as serverLogout } from "@/lib/auth/actions";
import { clearLocalData, db } from "@/lib/local/db";
import { stopSync } from "@/lib/local/sync";
import { disablePush } from "@/lib/push/client";

// ---------------------------------------------------------------------------
// Logging-out flag, read by LocalDataProvider (useSyncExternalStore) to hide the app.
// Without it, the screens see the emptied database mid-logout and open the setup wizard.
// ---------------------------------------------------------------------------

let loggingOut = false;
const listeners = new Set<() => void>();

export const loggingOutStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => loggingOut,
};

function setLoggingOut(value: boolean) {
  loggingOut = value;
  listeners.forEach((listener) => listener());
}

/** Clears this device's copy of the data (it belongs to whoever is logged in), then logs out. */
export async function logOutOfDevice() {
  const unsent = await db.outbox.filter((e) => !e.failed).count();
  if (unsent > 0) {
    const sure = window.confirm(
      `${unsent} ${unsent === 1 ? "change hasn't" : "changes haven't"} synced yet and will be lost if you log out. Log out anyway?`,
    );
    if (!sure) return;
  }

  setLoggingOut(true);
  await stopSync();
  // Bill reminders belong to whoever was logged in
  await disablePush().catch(() => {});
  try {
    await serverLogout();
  } catch {
    // Couldn't reach the server: still logged in, so put the app back as it was
    window.alert("Can't log out right now. Check your connection and try again.");
    window.location.reload();
    return;
  }
  await clearLocalData();
  // Full reload, so nothing from this user stays in memory either
  window.location.replace("/login?notice=logged-out");
}
