import type { BudgetItem, Category, Transaction } from "./types";

type SpendInput = Pick<Transaction, "type" | "amount" | "category_id">;

/** Category id → total spent, over expense transactions only. Pass one month's transactions. */
export function spentByCategory(transactions: SpendInput[]): Map<string, number> {
  const spent = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === "expense" && t.category_id) {
      spent.set(t.category_id, (spent.get(t.category_id) ?? 0) + t.amount);
    }
  }
  return spent;
}

export type BudgetLine = {
  categoryId: string;
  name: string;
  limit: number;
  spent: number;
  /** Negative when over */
  remaining: number;
  over: boolean;
};

export type BudgetSummary = {
  lines: BudgetLine[];
  /** The custom overall limit when set, otherwise the sum of the category limits */
  totalLimit: number;
  /** True when totalLimit is the user's own number rather than the category sum */
  customTotal: boolean;
  /** Sum of the category limits, shown next to a custom total */
  categoryTotal: number;
  /** All expenses in the month, including categories without a limit (docs/erd.md) */
  totalSpent: number;
  /** 0–100+, rounded; 0 when there's no limit */
  percentUsed: number;
};

/** One line per budgeted category, most-used first, plus month totals. Pass `customTotal` to override the sum. */
export function summarizeBudget(
  items: Pick<BudgetItem, "category_id" | "limit_amount">[],
  categories: Pick<Category, "id" | "name">[],
  monthTransactions: SpendInput[],
  customTotal?: number | null,
): BudgetSummary {
  const spent = spentByCategory(monthTransactions);
  const names = new Map(categories.map((c) => [c.id, c.name]));

  const lines = items
    .map((item) => {
      const used = spent.get(item.category_id) ?? 0;
      return {
        categoryId: item.category_id,
        name: names.get(item.category_id) ?? "Unknown",
        limit: item.limit_amount,
        spent: used,
        remaining: item.limit_amount - used,
        over: used > item.limit_amount,
      };
    })
    .sort((a, b) => ratio(b) - ratio(a));

  const categoryTotal = lines.reduce((sum, l) => sum + l.limit, 0);
  const totalLimit = customTotal && customTotal > 0 ? customTotal : categoryTotal;
  let totalSpent = 0;
  for (const amount of spent.values()) totalSpent += amount;

  return {
    lines,
    totalLimit,
    customTotal: !!customTotal && customTotal > 0,
    categoryTotal,
    totalSpent,
    percentUsed: totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0,
  };
}

function ratio(line: Pick<BudgetLine, "spent" | "limit">) {
  return line.limit > 0 ? line.spent / line.limit : line.spent > 0 ? Infinity : 0;
}
