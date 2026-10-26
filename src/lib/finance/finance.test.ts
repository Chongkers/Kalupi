// Balances, budget, guardrail and list helpers: the numbers the dashboard shows.
import { describe, expect, it } from "vitest";
import { accountBalances, availableBalance } from "./balances";
import { spentByCategory, summarizeBudget } from "./budget";
import { guardrailWarnings } from "./guardrail";
import { dailyTotals, filterTransactions, groupByDay, inAndOut } from "./list";
import type { Transaction, TransactionType } from "./types";

let seq = 0;
function tx(type: TransactionType, amount: number, fields: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    type,
    amount,
    account_id: "cash",
    to_account_id: null,
    category_id: type === "income" || type === "expense" ? "food" : null,
    tracker_id: type === "contribution" || type === "withdrawal" ? "trip" : null,
    occurred_on: "2026-10-10",
    note: null,
    source: "manual",
    created_at: `2026-10-10T00:00:${String(seq).padStart(2, "0")}Z`,
    ...fields,
  };
}

describe("balances", () => {
  const transactions = [
    tx("income", 100000, { category_id: "salary" }),
    tx("expense", 25000),
    tx("transfer", 30000, { to_account_id: "gcash" }),
    tx("contribution", 10000),
    tx("withdrawal", 4000),
  ];

  it("derives each account: income − expense ± transfers; tracker money stays in the account", () => {
    const balances = accountBalances(transactions);
    expect(balances.get("cash")).toBe(100000 - 25000 - 30000);
    expect(balances.get("gcash")).toBe(30000);
  });

  it("takes money set aside for trackers out of available", () => {
    expect(availableBalance(transactions)).toBe(75000 - (10000 - 4000));
  });
});

describe("summarizeBudget", () => {
  const categories = [
    { id: "food", name: "Food" },
    { id: "fare", name: "Fare" },
    { id: "fun", name: "Fun" },
  ];
  const items = [
    { category_id: "food", limit_amount: 500000 },
    { category_id: "fare", limit_amount: 100000 },
  ];
  const month = [
    tx("expense", 300000, { category_id: "food" }),
    tx("expense", 120000, { category_id: "fare" }),
    tx("expense", 50000, { category_id: "fun" }), // no limit, still counts toward the total
    tx("income", 999999, { category_id: "salary" }),
  ];

  it("counts all expenses against the sum of the limits", () => {
    const summary = summarizeBudget(items, categories, month);
    expect(summary.totalLimit).toBe(600000);
    expect(summary.categoryTotal).toBe(600000);
    expect(summary.customTotal).toBe(false);
    expect(summary.totalSpent).toBe(470000);
    expect(summary.percentUsed).toBe(78);
  });

  it("puts the most-used category first and flags overspending", () => {
    const [first, second] = summarizeBudget(items, categories, month).lines;
    expect(first).toMatchObject({ categoryId: "fare", spent: 120000, remaining: -20000, over: true });
    expect(second).toMatchObject({ categoryId: "food", over: false, remaining: 200000 });
  });

  it("uses a custom overall limit instead of the sum when set", () => {
    const summary = summarizeBudget(items, categories, month, 1000000);
    expect(summary.totalLimit).toBe(1000000);
    expect(summary.customTotal).toBe(true);
    expect(summary.categoryTotal).toBe(600000);
    expect(summary.percentUsed).toBe(47);
  });

  it("ignores an empty or zero custom limit", () => {
    expect(summarizeBudget(items, categories, month, null).totalLimit).toBe(600000);
    expect(summarizeBudget(items, categories, month, 0).customTotal).toBe(false);
  });

  it("works with only an overall limit and no categories", () => {
    const summary = summarizeBudget([], categories, month, 400000);
    expect(summary.lines).toEqual([]);
    expect(summary.percentUsed).toBe(118);
  });

  it("is 0% with no limit at all", () => {
    expect(summarizeBudget([], categories, month).percentUsed).toBe(0);
  });

  it("sums spending per category, expenses only", () => {
    const spent = spentByCategory(month);
    expect(spent.get("food")).toBe(300000);
    expect(spent.has("salary")).toBe(false);
  });
});

describe("guardrailWarnings", () => {
  const budget = summarizeBudget(
    [{ category_id: "food", limit_amount: 100000 }],
    [{ id: "food", name: "Food" }],
    [tx("expense", 90000, { category_id: "food" })],
  );

  it("is quiet when everything fits", () => {
    expect(guardrailWarnings({ amount: 5000, categoryId: "food", budget, available: 50000 })).toEqual([]);
  });

  it("warns about the category, the month total and the available balance", () => {
    const warnings = guardrailWarnings({ amount: 60000, categoryId: "food", budget, available: 50000 });
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toContain("Food goes over its ₱1,000.00 limit by ₱500.00");
    expect(warnings[2]).toContain("₱100.00 more than your available balance");
  });

  it("doesn't count an edited expense twice", () => {
    // Editing the existing ₱900 food expense up to ₱950: still under the ₱1,000 limit
    const original = { amount: 90000, categoryId: "food", sameMonth: true };
    expect(guardrailWarnings({ amount: 95000, categoryId: "food", budget, available: 10000, original })).toEqual([]);
  });

  it("checks only the balance when there's no budget", () => {
    expect(guardrailWarnings({ amount: 100, categoryId: "food", budget: null, available: 50 })).toHaveLength(1);
  });
});

describe("list helpers", () => {
  it("adds up money in and out, skipping opening balances and transfers", () => {
    const result = inAndOut(
      [
        tx("income", 1000, { category_id: "salary" }),
        tx("income", 50000, { category_id: "opening" }),
        tx("expense", 300),
        tx("transfer", 999, { to_account_id: "gcash" }),
      ],
      "opening",
    );
    expect(result).toEqual({ moneyIn: 1000, moneyOut: 300 });
  });

  it("groups newest day first, newest entry first", () => {
    const a = tx("expense", 1, { occurred_on: "2026-10-01" });
    const b = tx("expense", 2, { occurred_on: "2026-10-03" });
    const c = tx("expense", 3, { occurred_on: "2026-10-03" });
    const groups = groupByDay([a, b, c]);
    expect(groups.map((g) => g.date)).toEqual(["2026-10-03", "2026-10-01"]);
    expect(groups[0].items.map((t) => t.id)).toEqual([c.id, b.id]);
  });

  it("puts each day's total in its slot", () => {
    const days = dailyTotals(
      [
        tx("expense", 100, { occurred_on: "2026-10-01" }),
        tx("expense", 250, { occurred_on: "2026-10-01" }),
        tx("expense", 70, { occurred_on: "2026-10-31" }),
        tx("income", 5000, { occurred_on: "2026-10-02", category_id: "salary" }),
      ],
      "expense",
      31,
    );
    expect(days).toHaveLength(31);
    expect(days[0]).toBe(350);
    expect(days[1]).toBe(0);
    expect(days[30]).toBe(70);
  });

  it("filters by type, account (either side of a transfer) and search text", () => {
    const lunch = tx("expense", 1, { note: "Jollibee lunch" });
    const move = tx("transfer", 2, { account_id: "bpi", to_account_id: "cash" });
    const pay = tx("income", 3, { category_id: "salary", account_id: "bpi" });
    const lookups = {
      categories: [
        { id: "food", name: "Food" },
        { id: "salary", name: "Salary" },
      ],
      accounts: [
        { id: "cash", name: "Wallet" },
        { id: "bpi", name: "BPI" },
      ],
    };
    const all = [lunch, move, pay];
    expect(filterTransactions(all, { type: "income" }, lookups)).toEqual([pay]);
    expect(filterTransactions(all, { accountId: "cash" }, lookups)).toEqual([lunch, move]);
    expect(filterTransactions(all, { search: "jolli" }, lookups)).toEqual([lunch]);
    expect(filterTransactions(all, { search: "salary" }, lookups)).toEqual([pay]);
    expect(filterTransactions(all, { search: "wallet" }, lookups)).toEqual([lunch, move]);
  });
});
