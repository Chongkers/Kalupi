// Monthly bills (v1.0.4). A bill is a reminder: on its due date it shows up to be confirmed in one
// tap, which logs a normal expense. Nothing here touches balances; it only works out what's due.
import { addMonths, dayOfMonth, monthStart, type DateString } from "@/lib/dates";

export type Bill = {
  id: string;
  name: string;
  amount: number;
  category_id: string;
  account_id: string | null;
  /** 1–31; past the end of a short month means its last day */
  due_day: number;
  /** First month it's due (first day of the month) */
  starts_on: DateString;
  /** Last month it's due; null = until ended */
  ends_on: DateString | null;
  archived_at: string | null;
};

export type BillPayment = {
  id: string;
  bill_id: string;
  month: DateString;
  /** The logged expense; null = skipped that month */
  transaction_id: string | null;
};

export type BillStatus = "paid" | "skipped" | "overdue" | "due" | "upcoming";

export type BillDue = {
  bill: Bill;
  month: DateString;
  dueOn: DateString;
  status: BillStatus;
  /** Days from today to the due date; negative when overdue */
  daysAway: number;
  payment: BillPayment | null;
};

/** The bill's due date in a month: day 31 in a 30-day month is the 30th. */
export function dueDateIn(dueDay: number, month: DateString): DateString {
  const day = Math.min(dueDay, dayOfMonth(month).of);
  return `${month.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

/** Whether the bill is due at all in that month. */
export function isDueIn(bill: Pick<Bill, "starts_on" | "ends_on" | "archived_at">, month: DateString): boolean {
  if (bill.archived_at) return false;
  return month >= monthStart(bill.starts_on) && (!bill.ends_on || month <= monthStart(bill.ends_on));
}

const daysBetween = (from: DateString, to: DateString) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * This month's bills with their status, most urgent first, plus last month's if it was never
 * confirmed or skipped (so a missed bill doesn't quietly disappear when the month turns).
 * Older months drop off rather than piling up.
 */
export function billsDue(bills: Bill[], payments: BillPayment[], today: DateString, lookbackMonths = 1): BillDue[] {
  const current = monthStart(today);
  const byKey = new Map(payments.map((p) => [`${p.bill_id}:${p.month}`, p]));
  const result: BillDue[] = [];

  for (const bill of bills) {
    for (let back = lookbackMonths; back >= 0; back--) {
      const month = addMonths(current, -back);
      if (!isDueIn(bill, month)) continue;
      const dueOn = dueDateIn(bill.due_day, month);
      const payment = byKey.get(`${bill.id}:${month}`) ?? null;
      const daysAway = daysBetween(today, dueOn);
      const status: BillStatus = payment
        ? payment.transaction_id
          ? "paid"
          : "skipped"
        : daysAway < 0
          ? "overdue"
          : daysAway === 0
            ? "due"
            : "upcoming";
      // Earlier months only matter while they're still open
      if (month !== current && status !== "overdue") continue;
      result.push({ bill, month, dueOn, status, daysAway, payment });
    }
  }

  const rank: Record<BillStatus, number> = { overdue: 0, due: 1, upcoming: 2, paid: 3, skipped: 4 };
  return result.sort((a, b) => rank[a.status] - rank[b.status] || a.dueOn.localeCompare(b.dueOn) || a.bill.name.localeCompare(b.bill.name));
}

/** Bills waiting to be confirmed (due today or overdue). */
export const needsConfirming = (dues: BillDue[]) => dues.filter((d) => d.status === "due" || d.status === "overdue");

/** Money still owed on bills this month and earlier: for "After bills" and "Safe to spend". */
export function unpaidTotal(dues: BillDue[]): number {
  return dues.filter((d) => d.status === "due" || d.status === "overdue" || d.status === "upcoming").reduce((sum, d) => sum + d.bill.amount, 0);
}

/** For installments: the last month when it ends after `count` payments starting in `startMonth`. */
export function endAfterPayments(startMonth: DateString, count: number): DateString {
  return addMonths(monthStart(startMonth), Math.max(1, count) - 1);
}

/** How many payments are left, counting this month if it isn't settled yet; null = no end. */
export function paymentsLeft(bill: Pick<Bill, "ends_on">, fromMonth: DateString, settledThisMonth: boolean): number | null {
  if (!bill.ends_on) return null;
  const end = monthStart(bill.ends_on);
  let count = 0;
  for (let m = monthStart(fromMonth); m <= end; m = addMonths(m, 1)) count++;
  return Math.max(0, count - (settledThisMonth ? 1 : 0));
}

/** "Due today", "Due tomorrow", "Due in 5 days", "2 days overdue", "Paid", "Skipped". */
export function dueLabel(due: Pick<BillDue, "status" | "daysAway">): string {
  switch (due.status) {
    case "paid":
      return "Paid";
    case "skipped":
      return "Skipped";
    case "due":
      return "Due today";
    case "overdue":
      return `${-due.daysAway} ${due.daysAway === -1 ? "day" : "days"} overdue`;
    default:
      return due.daysAway === 1 ? "Due tomorrow" : `Due in ${due.daysAway} days`;
  }
}

/** "every month on the 15th", "last day of the month". */
export function scheduleLabel(dueDay: number): string {
  if (dueDay >= 31) return "Last day of the month";
  const suffix = dueDay % 10 === 1 && dueDay !== 11 ? "st" : dueDay % 10 === 2 && dueDay !== 12 ? "nd" : dueDay % 10 === 3 && dueDay !== 13 ? "rd" : "th";
  return `Every ${dueDay}${suffix}`;
}

/** A new bill's first month: this month if its day hasn't passed yet, otherwise next month. */
export function firstDueMonth(dueDay: number, today: DateString): DateString {
  const current = monthStart(today);
  return dueDateIn(dueDay, current) >= today ? current : addMonths(current, 1);
}
