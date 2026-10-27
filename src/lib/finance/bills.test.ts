import { describe, expect, it } from "vitest";
import {
  billsDue,
  dueDateIn,
  dueLabel,
  endAfterPayments,
  firstDueMonth,
  isDueIn,
  needsConfirming,
  paymentsLeft,
  scheduleLabel,
  unpaidTotal,
  type Bill,
  type BillPayment,
} from "./bills";

const bill = (fields: Partial<Bill> = {}): Bill => ({
  id: "rent",
  name: "Rent",
  amount: 500000,
  category_id: "housing",
  account_id: null,
  due_day: 15,
  starts_on: "2026-09-01",
  ends_on: null,
  archived_at: null,
  ...fields,
});

const payment = (bill_id: string, month: string, transaction_id: string | null = "t1"): BillPayment => ({
  id: `${bill_id}:${month}`,
  bill_id,
  month,
  transaction_id,
});

describe("dueDateIn", () => {
  it("uses the due day, or the month's last day when the month is shorter", () => {
    expect(dueDateIn(15, "2026-10-01")).toBe("2026-10-15");
    expect(dueDateIn(31, "2026-09-01")).toBe("2026-09-30");
    expect(dueDateIn(30, "2026-02-01")).toBe("2026-02-28");
    expect(dueDateIn(29, "2028-02-01")).toBe("2028-02-29");
    expect(dueDateIn(1, "2026-10-01")).toBe("2026-10-01");
  });
});

describe("isDueIn", () => {
  it("covers the months from start to end, and nothing once archived", () => {
    const loan = bill({ starts_on: "2026-10-01", ends_on: "2026-12-01" });
    expect(isDueIn(loan, "2026-09-01")).toBe(false);
    expect(isDueIn(loan, "2026-10-01")).toBe(true);
    expect(isDueIn(loan, "2026-12-01")).toBe(true);
    expect(isDueIn(loan, "2027-01-01")).toBe(false);
    expect(isDueIn({ ...loan, archived_at: "2026-10-20T00:00:00Z" }, "2026-10-01")).toBe(false);
  });
});

describe("billsDue", () => {
  it("knows upcoming, due today and paid", () => {
    const october = { starts_on: "2026-10-01" };
    const bills = [
      bill(october),
      bill({ ...october, id: "net", name: "Internet", due_day: 25 }),
      bill({ ...october, id: "load", name: "Load", due_day: 10 }),
    ];
    const dues = billsDue(bills, [payment("load", "2026-10-01")], "2026-10-15");
    expect(dues.map((d) => [d.bill.id, d.status, d.daysAway])).toEqual([
      ["rent", "due", 0],
      ["net", "upcoming", 10],
      ["load", "paid", -5],
    ]);
  });

  it("keeps an unconfirmed bill from last month as overdue, first in line", () => {
    const dues = billsDue([bill({ due_day: 28 })], [], "2026-10-05");
    expect(dues.map((d) => [d.month, d.status, d.daysAway])).toEqual([
      ["2026-09-01", "overdue", -7],
      ["2026-10-01", "upcoming", 23],
    ]);
  });

  it("drops earlier months once they're paid or skipped", () => {
    const dues = billsDue([bill({ due_day: 28 })], [payment("rent", "2026-09-01", null)], "2026-10-05");
    expect(dues.map((d) => d.month)).toEqual(["2026-10-01"]);
  });

  it("doesn't reach back before the bill started", () => {
    expect(billsDue([bill({ starts_on: "2026-10-01", due_day: 1 })], [], "2026-10-20").map((d) => d.month)).toEqual(["2026-10-01"]);
  });

  it("only carries last month over, not older ones", () => {
    const dues = billsDue([bill({ starts_on: "2026-07-01", due_day: 28 })], [], "2026-10-05");
    expect(dues.map((d) => d.month)).toEqual(["2026-09-01", "2026-10-01"]);
  });

  it("sums what's still owed and picks what needs confirming", () => {
    const october = { starts_on: "2026-10-01" };
    const dues = billsDue(
      [bill(october), bill({ ...october, id: "net", amount: 150000, due_day: 25 }), bill({ ...october, id: "load", amount: 9000, due_day: 1 })],
      [payment("load", "2026-10-01", null)],
      "2026-10-15",
    );
    expect(unpaidTotal(dues)).toBe(650000);
    expect(needsConfirming(dues).map((d) => d.bill.id)).toEqual(["rent"]);
  });
});

describe("firstDueMonth", () => {
  it("starts this month if the day hasn't passed, otherwise next month", () => {
    expect(firstDueMonth(20, "2026-10-15")).toBe("2026-10-01");
    expect(firstDueMonth(15, "2026-10-15")).toBe("2026-10-01");
    expect(firstDueMonth(10, "2026-10-15")).toBe("2026-11-01");
    expect(firstDueMonth(31, "2026-09-30")).toBe("2026-09-01");
  });
});

describe("installments", () => {
  it("ends after N payments", () => {
    expect(endAfterPayments("2026-10-01", 3)).toBe("2026-12-01");
    expect(endAfterPayments("2026-10-15", 1)).toBe("2026-10-01");
  });

  it("counts payments left", () => {
    const plan = { ends_on: "2026-12-01" };
    expect(paymentsLeft(plan, "2026-10-01", false)).toBe(3);
    expect(paymentsLeft(plan, "2026-10-01", true)).toBe(2);
    expect(paymentsLeft(plan, "2027-01-01", false)).toBe(0);
    expect(paymentsLeft({ ends_on: null }, "2026-10-01", false)).toBeNull();
  });
});

describe("labels", () => {
  it("describes when it's due", () => {
    expect(dueLabel({ status: "due", daysAway: 0 })).toBe("Due today");
    expect(dueLabel({ status: "upcoming", daysAway: 1 })).toBe("Due tomorrow");
    expect(dueLabel({ status: "upcoming", daysAway: 6 })).toBe("Due in 6 days");
    expect(dueLabel({ status: "overdue", daysAway: -1 })).toBe("1 day overdue");
    expect(dueLabel({ status: "overdue", daysAway: -3 })).toBe("3 days overdue");
  });

  it("describes the schedule", () => {
    expect(scheduleLabel(1)).toBe("Every 1st");
    expect(scheduleLabel(2)).toBe("Every 2nd");
    expect(scheduleLabel(11)).toBe("Every 11th");
    expect(scheduleLabel(22)).toBe("Every 22nd");
    expect(scheduleLabel(23)).toBe("Every 23rd");
    expect(scheduleLabel(31)).toBe("Last day of the month");
  });
});
