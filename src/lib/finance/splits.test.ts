import { describe, expect, it } from "vitest";
import { owedTotals, personBalances, reminderText, spendingView, splitEntries, splitEvenly, type ShareInput } from "./splits";
import type { Transaction } from "./types";

const tx = (id: string, type: Transaction["type"], amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id,
  type,
  amount,
  account_id: "cash",
  to_account_id: null,
  category_id: type === "expense" || type === "income" ? "food" : null,
  tracker_id: null,
  occurred_on: "2026-10-24",
  note: null,
  source: "manual",
  created_at: `2026-10-24T0${id.length}:00:00Z`,
  ...extra,
});

const share = (id: string, person: string, amount: number, extra: Partial<ShareInput> = {}): ShareInput => ({
  id,
  person_id: person,
  transaction_id: null,
  category_id: null,
  amount,
  occurred_on: "2026-10-24",
  note: null,
  tracker_id: "trip",
  created_at: "2026-10-24T00:00:00Z",
  ...extra,
});

describe("splitEvenly", () => {
  it("adds up exactly, leftover centavos going to the first parts", () => {
    expect(splitEvenly(100000, 4)).toEqual([25000, 25000, 25000, 25000]);
    expect(splitEvenly(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(splitEvenly(100000, 3).reduce((a, b) => a + b)).toBe(100000);
    expect(splitEvenly(500, 0)).toEqual([]);
  });
});

describe("balances", () => {
  it("sums each person's shares and totals both directions", () => {
    const balances = personBalances([share("a", "enzo", 25000), share("b", "enzo", -10000), share("c", "law", -5000)]);
    expect(balances.get("enzo")).toBe(15000);
    expect(balances.get("law")).toBe(-5000);
    expect(owedTotals(balances.values())).toEqual({ owedToYou: 15000, youOwe: 5000 });
  });
});

describe("spendingView", () => {
  it("counts only your share of a bill you paid for others", () => {
    const bill = tx("bill", "expense", 100000);
    const view = spendingView([bill], [share("s1", "enzo", 25000, { transaction_id: "bill" }), share("s2", "law", 25000, { transaction_id: "bill" })]);
    expect(view).toHaveLength(1);
    expect(view[0].amount).toBe(50000);
  });

  it("adds your share of a bill a friend paid as an expense in its category", () => {
    const view = spendingView([], [share("s1", "enzo", -30000, { category_id: "food", note: "Dinner" })]);
    expect(view).toEqual([expect.objectContaining({ id: "s1", type: "expense", amount: 30000, category_id: "food", note: "Dinner" })]);
  });

  it("leaves paybacks and other transactions alone", () => {
    const payback = tx("pay", "settle_in", 25000, { tracker_id: "trip" });
    const salary = tx("sal", "income", 900000);
    const view = spendingView([payback, salary], [share("s1", "enzo", -25000, { transaction_id: "pay" })]);
    expect(view).toEqual([payback, salary]);
  });
});

describe("splitEntries", () => {
  it("groups shares into bills and paybacks, newest first", () => {
    const bill = tx("bill", "expense", 90000, { note: "Dinner", tracker_id: "trip" });
    const payback = tx("payback", "settle_in", 30000, { note: "Enzo paid you back", occurred_on: "2026-10-25", tracker_id: "trip" });
    const entries = splitEntries(
      [
        share("s1", "enzo", 30000, { transaction_id: "bill" }),
        share("s2", "law", 30000, { transaction_id: "bill" }),
        share("s3", "enzo", -30000, { transaction_id: "payback" }),
        share("s4", "law", -12000, { category_id: "food", note: "Taxi", occurred_on: "2026-10-23" }),
        share("s5", "law", 5000, { transaction_id: "deleted" }),
      ],
      [bill, payback],
    );

    expect(entries.map((e) => [e.id, e.kind])).toEqual([
      ["payback", "paid-you-back"],
      ["bill", "you-paid"],
      ["s4", "they-paid"],
    ]);
    expect(entries[1]).toMatchObject({ amount: 90000, yourShare: 30000, accountId: "cash" });
    expect(entries[1].people).toHaveLength(2);
    expect(entries[2]).toMatchObject({ amount: 12000, yourShare: 12000, note: "Taxi" });
  });
});

describe("reminderText", () => {
  it("words it by who owes whom", () => {
    expect(reminderText("Enzo", 25000, "Boracay trip")).toContain("you owe me ₱250.00 for Boracay trip");
    expect(reminderText("Enzo", -25000, "Boracay trip")).toContain("I still owe you ₱250.00");
  });
});
