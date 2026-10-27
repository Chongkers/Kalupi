"use client";

import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { monthEnd, monthStart, today, type DateString } from "@/lib/dates";
import { accountBalances, availableBalance } from "@/lib/finance/balances";
import { billsDue } from "@/lib/finance/bills";
import { DEFAULT_PRESET_ORDER, isPresetOrder, orderPresets } from "@/lib/finance/presets";
import { summarizeBudget } from "@/lib/finance/budget";
import { owedTotals, personBalances, spendingView, splitEntries } from "@/lib/finance/splits";
import { trackerMembers, type ProgressRow } from "@/lib/finance/trackers";
import { OPENING_BALANCE, type Account, type Category, type Transaction } from "@/lib/finance/types";
import { db, getMeta } from "./db";
import { syncStatusStore } from "./sync";

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);

/**
 * Everything the money screens share, from the local database: accounts with balances,
 * categories, transactions and this month's budget. Re-renders whenever any of it changes.
 * undefined while the first read is in progress.
 */
export function useOverview() {
  return useLiveQuery(async () => {
    const now = today();
    const month = monthStart(now);
    const [accountRows, categoryRows, transactionRows, budgets, presetRows, shareRows, billRows, billPaymentRows, savedOrder] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.presets.toArray(),
      db.split_shares.toArray(),
      db.bills.toArray(),
      db.bill_payments.toArray(),
      getMeta("presetOrder"),
    ]);

    const accounts: Account[] = live(accountRows).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const categories: Category[] = live(categoryRows).sort((a, b) => a.name.localeCompare(b.name));
    const transactions: Transaction[] = live(transactionRows).sort(
      (a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at),
    );

    const presetOrder = isPresetOrder(savedOrder) ? savedOrder : DEFAULT_PRESET_ORDER;

    const monthBudgetRow = budgets.find((b) => b.month === month && !b.deleted_at);
    const items = monthBudgetRow ? live(await db.budget_items.where("budget_id").equals(monthBudgetRow.id).toArray()) : [];
    const monthBudget = monthBudgetRow
      ? { id: monthBudgetRow.id, items, totalLimit: monthBudgetRow.total_limit ?? null }
      : null;

    const balances = accountBalances(transactions);
    const end = monthEnd(now);
    const monthTransactions = transactions.filter((t) => t.occurred_on >= month && t.occurred_on <= end);
    // Budget and in/out totals count your share of split bills only (v1.0.3)
    const spending = spendingView(transactions, live(shareRows));
    const monthSpending = spending.filter((t) => t.occurred_on >= month && t.occurred_on <= end);

    return {
      today: now,
      accounts: accounts.map((a) => ({ ...a, archived: !!a.archived_at, balance: balances.get(a.id) ?? 0 })),
      categories,
      openingBalanceId: categories.find((c) => c.kind === "income" && c.name === OPENING_BALANCE)?.id,
      transactions,
      monthTransactions,
      /** Transactions as the budget sees them; not for balances or lists */
      spending,
      monthSpending,
      available: availableBalance(transactions),
      monthBudget,
      budget: monthBudget ? summarizeBudget(monthBudget.items, categories, monthSpending, monthBudget.totalLimit) : null,
      /** Picked in Settings → Presets; remembered on this device */
      presetOrder,
      presets: orderPresets(live(presetRows), presetOrder, transactions),
      /** Every bill, ended ones included (v1.0.4) */
      bills: live(billRows).sort((a, b) => a.due_day - b.due_day || a.name.localeCompare(b.name)),
      /** This month's bills (and last month's unconfirmed ones) with their status */
      billDues: billsDue(live(billRows), live(billPaymentRows), now),
    };
  });
}

export type Overview = NonNullable<ReturnType<typeof useOverview>>;

/** Display name and email for the account menu, cached so they show offline too. */
export function useLocalProfile() {
  return useLiveQuery(async () => {
    const owner = await getMeta<{ userId: string; email: string }>("owner");
    const displayName = await getMeta<string | null>("displayName");
    const avatarUrl = (await getMeta<string | null>("avatarUrl")) ?? null;
    const email = owner?.email ?? "";
    return { email, displayName: displayName || email.split("@")[0] || "You", hasDisplayName: !!displayName, avatarUrl };
  });
}

/** Online / syncing / last synced, plus how many changes are waiting or were refused. */
export function useSyncStatus() {
  const status = useSyncExternalStore(syncStatusStore.subscribe, syncStatusStore.get, syncStatusStore.get);
  const counts = useLiveQuery(async () => {
    const entries = await db.outbox.toArray();
    return { pending: entries.filter((e) => !e.failed).length, failed: entries.filter((e) => e.failed) };
  });
  return { ...status, pending: counts?.pending ?? 0, failed: counts?.failed ?? [] };
}

/** One month for History: its transactions, budget and totals. `month` is the first day ("2026-09-01"). */
export function useMonth(month: DateString) {
  return useLiveQuery(async () => {
    const end = monthEnd(month);
    const [transactionRows, budgets, categoryRows, shareRows] = await Promise.all([
      db.transactions.where("occurred_on").between(month, end, true, true).toArray(),
      db.budgets.toArray(),
      db.categories.toArray(),
      db.split_shares.toArray(),
    ]);
    const categories: Category[] = live(categoryRows).sort((a, b) => a.name.localeCompare(b.name));
    const transactions: Transaction[] = live(transactionRows);
    const monthShares = live(shareRows).filter((s) => s.occurred_on >= month && s.occurred_on <= end);
    const spending = spendingView(transactions, monthShares);
    const budgetRow = budgets.find((b) => b.month === month && !b.deleted_at);
    const items = budgetRow ? live(await db.budget_items.where("budget_id").equals(budgetRow.id).toArray()) : [];
    return {
      month,
      transactions,
      /** As the budget sees them: your share of split bills only */
      spending,
      categories,
      budgetRow: budgetRow ? { id: budgetRow.id, items, totalLimit: budgetRow.total_limit ?? null } : null,
      budget: budgetRow ? summarizeBudget(items, categories, spending, budgetRow.total_limit) : null,
    };
  }, [month]);
}

/** Trackers you're a member of, with everyone's totals. Others' totals are cached from the last sync. */
export function useTrackers() {
  return useLiveQuery(async () => {
    const owner = await getMeta<{ userId: string }>("owner");
    const me = owner?.userId ?? "";
    const [trackerRows, memberRows, transactionRows, progress, peopleRows, shareRows] = await Promise.all([
      db.trackers.toArray(),
      db.tracker_members.toArray(),
      db.transactions.toArray(),
      getMeta<ProgressRow[]>("trackerProgress"),
      db.split_people.toArray(),
      db.split_shares.toArray(),
    ]);
    const members = live(memberRows);
    const mine = new Map(members.filter((m) => m.user_id === me).map((m) => [m.tracker_id, m.role]));
    const entries = live(transactionRows).filter((t) => t.tracker_id && t.user_id === me);
    const shares = live(shareRows);

    const trackers = live(trackerRows)
      .filter((t) => mine.has(t.id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((t) => {
        const common = { ...t, archived: !!t.archived_at, myRole: mine.get(t.id)! };
        const myEntries = entries
          .filter((e) => e.tracker_id === t.id)
          .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at));

        if (t.kind === "split") {
          const trackerShares = shares.filter((s) => s.tracker_id === t.id);
          const balances = personBalances(trackerShares);
          // Removed people keep their name on past bills
          const everyone = peopleRows.filter((p) => p.tracker_id === t.id);
          const people = live(everyone)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((p) => ({ id: p.id, name: p.name, balance: balances.get(p.id) ?? 0 }));
          return {
            ...common,
            kind: "split" as const,
            people,
            names: new Map(everyone.map((p) => [p.id, p.name])),
            ...owedTotals(people.map((p) => p.balance)),
            entries: splitEntries(trackerShares, myEntries),
          };
        }

        const { members: people, total } = trackerMembers(t.id, me, members, progress ?? [], entries);
        return {
          ...common,
          kind: "goal" as const,
          target_amount: t.target_amount ?? 0,
          members: people,
          total,
          myEntries,
        };
      });
    return { me, today: today(), trackers };
  });
}

export type TrackerView = NonNullable<ReturnType<typeof useTrackers>>["trackers"][number];
export type GoalTrackerView = Extract<TrackerView, { kind: "goal" }>;
export type SplitTrackerView = Extract<TrackerView, { kind: "split" }>;
