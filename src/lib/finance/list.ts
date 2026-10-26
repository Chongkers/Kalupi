import type { DateString } from "@/lib/dates";
import type { Transaction, TransactionType } from "./types";

export type TransactionFilters = {
  type?: TransactionType | "all";
  accountId?: string;
  categoryId?: string;
  /** Matched against the note and the category / account names */
  search?: string;
};

type Named = { id: string; name: string };

export function filterTransactions<T extends Transaction>(
  transactions: T[],
  filters: TransactionFilters,
  lookups: { categories: Named[]; accounts: Named[] },
): T[] {
  const query = filters.search?.trim().toLowerCase();
  const categoryNames = new Map(lookups.categories.map((c) => [c.id, c.name.toLowerCase()]));
  const accountNames = new Map(lookups.accounts.map((a) => [a.id, a.name.toLowerCase()]));

  return transactions.filter((t) => {
    if (filters.type && filters.type !== "all" && t.type !== filters.type) return false;
    if (filters.accountId && t.account_id !== filters.accountId && t.to_account_id !== filters.accountId) return false;
    if (filters.categoryId && t.category_id !== filters.categoryId) return false;
    if (query) {
      const haystack = [
        t.note ?? "",
        t.category_id ? categoryNames.get(t.category_id) : "",
        accountNames.get(t.account_id),
        t.to_account_id ? accountNames.get(t.to_account_id) : "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** Newest day first; within a day, newest entry first. */
export function groupByDay<T extends Pick<Transaction, "occurred_on" | "created_at">>(
  transactions: T[],
): { date: DateString; items: T[] }[] {
  const sorted = [...transactions].sort(
    (a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at),
  );
  const groups: { date: DateString; items: T[] }[] = [];
  for (const t of sorted) {
    const last = groups.at(-1);
    if (last?.date === t.occurred_on) last.items.push(t);
    else groups.push({ date: t.occurred_on, items: [t] });
  }
  return groups;
}

/** Money in and out over a set of transactions. Opening balances aren't income, so pass their category to skip them. */
export function inAndOut(transactions: Pick<Transaction, "type" | "amount" | "category_id">[], skipCategoryId?: string) {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const t of transactions) {
    if (t.type === "income" && t.category_id !== skipCategoryId) moneyIn += t.amount;
    if (t.type === "expense") moneyOut += t.amount;
  }
  return { moneyIn, moneyOut };
}

/** One total per day of the month (index 0 = day 1) for one transaction type. For the dashboard mini charts. */
export function dailyTotals(
  transactions: Pick<Transaction, "type" | "amount" | "category_id" | "occurred_on">[],
  type: "income" | "expense",
  daysInMonth: number,
  skipCategoryId?: string,
): number[] {
  const totals = new Array<number>(daysInMonth).fill(0);
  for (const t of transactions) {
    if (t.type !== type || (skipCategoryId && t.category_id === skipCategoryId)) continue;
    totals[Number(t.occurred_on.slice(8, 10)) - 1] += t.amount;
  }
  return totals;
}
