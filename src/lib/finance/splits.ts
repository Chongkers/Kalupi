// Settle-up trackers (v1.0.2, docs/erd.md "Settle-up"). Shares say what each person owes you
// (+) or you owe them (−). Your budget counts only your own share of a bill, while account
// balances follow the money that actually moved.
import { formatPeso } from "@/lib/money";
import type { Transaction } from "./types";

export type ShareInput = {
  id: string;
  person_id: string;
  transaction_id: string | null;
  category_id: string | null;
  amount: number;
  occurred_on: string;
  note: string | null;
  tracker_id: string;
  created_at: string;
};

/** Split `total` centavos into `count` parts that add up exactly; the first parts take the leftover centavos. */
export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Person id → what they owe you (+) or you owe them (−). */
export function personBalances(shares: Pick<ShareInput, "person_id" | "amount">[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const s of shares) balances.set(s.person_id, (balances.get(s.person_id) ?? 0) + s.amount);
  return balances;
}

/** Totals across everyone: what you're owed and what you owe, both positive. */
export function owedTotals(balances: Iterable<number>): { owedToYou: number; youOwe: number } {
  let owedToYou = 0;
  let youOwe = 0;
  for (const b of balances) {
    if (b > 0) owedToYou += b;
    else youOwe -= b;
  }
  return { owedToYou, youOwe };
}

/**
 * Transactions as your budget sees them: an expense you paid for others counts only your share,
 * and a bill a friend paid adds your share as an expense (it has no account; never use these
 * rows for balances). Paybacks aren't spending or income, so they pass through untouched.
 */
export function spendingView<T extends Transaction>(transactions: T[], shares: ShareInput[]): Transaction[] {
  const othersShare = new Map<string, number>();
  const friendPaid: Transaction[] = [];
  for (const s of shares) {
    if (s.transaction_id && s.amount > 0) {
      othersShare.set(s.transaction_id, (othersShare.get(s.transaction_id) ?? 0) + s.amount);
    } else if (!s.transaction_id && s.category_id && s.amount < 0) {
      friendPaid.push({
        id: s.id,
        type: "expense",
        amount: -s.amount,
        account_id: "",
        to_account_id: null,
        category_id: s.category_id,
        tracker_id: s.tracker_id,
        occurred_on: s.occurred_on,
        note: s.note,
        source: "manual",
        created_at: s.created_at,
      });
    }
  }

  const view: Transaction[] = transactions.map((t) => {
    const others = t.type === "expense" ? othersShare.get(t.id) : undefined;
    return others ? { ...t, amount: Math.max(0, t.amount - others) } : t;
  });
  return [...view, ...friendPaid];
}

/** A message to paste into Messenger. */
export function reminderText(name: string, balance: number, trackerName: string): string {
  return balance > 0
    ? `Hi ${name}! Friendly reminder: you owe me ${formatPeso(balance)} for ${trackerName}. Thanks!`
    : `Hi ${name}! I still owe you ${formatPeso(-balance)} for ${trackerName}. I'll send it soon.`;
}

export type SplitEntry = {
  /** The transaction id, or the share id for a bill a friend paid */
  id: string;
  kind: "you-paid" | "they-paid" | "paid-you-back" | "you-paid-back";
  note: string | null;
  occurred_on: string;
  created_at: string;
  /** You paid: the full bill. They paid: your share. Paybacks: the amount. */
  amount: number;
  /** Your part of the bill (bills only) */
  yourShare: number | null;
  accountId: string | null;
  /** Who's involved and how much each owes (+) or is owed (−) because of this entry */
  people: { personId: string; amount: number }[];
};

/** Bills and paybacks on one settle-up tracker, newest first. */
export function splitEntries(
  shares: ShareInput[],
  transactions: Pick<Transaction, "id" | "type" | "amount" | "account_id" | "note" | "occurred_on" | "created_at">[],
): SplitEntry[] {
  const byTransaction = new Map(transactions.map((t) => [t.id, t]));
  const entries = new Map<string, SplitEntry>();

  for (const s of shares) {
    const t = s.transaction_id ? byTransaction.get(s.transaction_id) : undefined;
    if (s.transaction_id && !t) continue; // its transaction was deleted
    const key = t?.id ?? s.id;
    let entry = entries.get(key);
    if (!entry) {
      const kind: SplitEntry["kind"] = !t
        ? "they-paid"
        : t.type === "settle_in"
          ? "paid-you-back"
          : t.type === "settle_out"
            ? "you-paid-back"
            : "you-paid";
      entry = {
        id: key,
        kind,
        note: t?.note ?? s.note,
        occurred_on: t?.occurred_on ?? s.occurred_on,
        created_at: t?.created_at ?? s.created_at,
        amount: t ? t.amount : -s.amount,
        yourShare: kind === "they-paid" ? -s.amount : kind === "you-paid" ? t!.amount : null,
        accountId: t?.account_id ?? null,
        people: [],
      };
      entries.set(key, entry);
    }
    entry.people.push({ personId: s.person_id, amount: s.amount });
    if (entry.kind === "you-paid") entry.yourShare! -= s.amount;
  }

  return [...entries.values()].sort(
    (a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at),
  );
}
