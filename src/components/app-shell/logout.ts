"use client";

import { logout as serverLogout } from "@/lib/auth/actions";
import { clearLocalData, db } from "@/lib/local/db";

/** Clears this device's copy of the data (it belongs to whoever is logged in), then logs out. */
export async function logOutOfDevice() {
  const unsent = await db.outbox.filter((e) => !e.failed).count();
  if (unsent > 0) {
    const sure = window.confirm(
      `${unsent} ${unsent === 1 ? "change hasn't" : "changes haven't"} synced yet and will be lost if you log out. Log out anyway?`,
    );
    if (!sure) return;
  }
  await clearLocalData();
  await serverLogout();
}
