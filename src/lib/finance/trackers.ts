// Tracker progress (docs/erd.md, "Derived values"): contributions − withdrawals, over every member.
// Members can't read each other's transactions, so other people's totals come from the server's
// tracker_progress() (cached on the device); your own come from your local entries, so they
// update instantly, even offline.
import { dayOfMonth, type DateString } from "@/lib/dates";
import type { Transaction } from "./types";

/** One row of public.tracker_progress(). */
export type ProgressRow = {
  tracker_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
  /** null for someone who left but still has contributions on the tracker */
  role: "owner" | "editor" | null;
  net_amount: number;
};

export type TrackerMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: "owner" | "editor" | null;
  net: number;
  isMe: boolean;
};

type EntryInput = Pick<Transaction, "type" | "amount" | "tracker_id">;

/** Your own contributions − withdrawals on one tracker. */
export function myNet(trackerId: string, transactions: EntryInput[]): number {
  let net = 0;
  for (const t of transactions) {
    if (t.tracker_id !== trackerId) continue;
    if (t.type === "contribution") net += t.amount;
    if (t.type === "withdrawal") net -= t.amount;
  }
  return net;
}

/** Everyone on the tracker with their totals, you first, then biggest contributor. */
export function trackerMembers(
  trackerId: string,
  me: string,
  memberRows: { tracker_id: string; user_id: string; role: "owner" | "editor" }[],
  progress: ProgressRow[],
  myTransactions: EntryInput[],
): { members: TrackerMember[]; total: number } {
  const fromServer = progress.filter((p) => p.tracker_id === trackerId);
  const byUser = new Map<string, TrackerMember>();

  for (const m of memberRows.filter((m) => m.tracker_id === trackerId)) {
    byUser.set(m.user_id, { userId: m.user_id, name: "Member", avatarUrl: null, role: m.role, net: 0, isMe: m.user_id === me });
  }
  for (const p of fromServer) {
    const existing = byUser.get(p.user_id);
    byUser.set(p.user_id, {
      userId: p.user_id,
      name: p.display_name || "Member",
      avatarUrl: p.avatar_url ?? null,
      role: existing?.role ?? p.role,
      net: p.net_amount,
      isMe: p.user_id === me,
    });
  }

  const mine = byUser.get(me);
  if (mine) {
    mine.net = myNet(trackerId, myTransactions);
    mine.name = "You";
  }

  const members = [...byUser.values()]
    .filter((m) => m.role !== null || m.net !== 0)
    .sort((a, b) => Number(b.isMe) - Number(a.isMe) || b.net - a.net);
  return { members, total: members.reduce((sum, m) => sum + m.net, 0) };
}

/** Whole days from `today` until `target` (negative once it's past). */
export function daysUntil(target: DateString, today: DateString): number {
  return Math.round((Date.parse(target) - Date.parse(today)) / 86_400_000);
}

/** How much to put in each month to hit the target on time, or null without a date or once reached. */
export function monthlyNeeded(remaining: number, target: DateString | null, today: DateString): number | null {
  if (!target || remaining <= 0) return null;
  const days = daysUntil(target, today);
  if (days <= 0) return remaining;
  const months = Math.max(1, days / (dayOfMonth(today).of || 30));
  return Math.ceil(remaining / months);
}
