// Dates are plain "YYYY-MM-DD" strings, the same as Postgres `date` columns (occurred_on, budgets.month).
// "Today" is always today in Manila, whatever timezone the phone or server is set to.
// Manila has no daylight saving, so day math in UTC below is safe.

export const TIME_ZONE = "Asia/Manila";

/** A calendar date, e.g. "2026-10-22". */
export type DateString = string;

// en-CA formats as YYYY-MM-DD
const isoInManila = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Manila: "2026-10-22". */
export function today(now: Date = new Date()): DateString {
  return isoInManila.format(now);
}

function parts(date: DateString) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function toDateString(utc: Date): DateString {
  return utc.toISOString().slice(0, 10);
}

/** "2026-10-22" → "2026-10-01". This is the `month` value stored on budgets. */
export function monthStart(date: DateString = today()): DateString {
  return `${date.slice(0, 7)}-01`;
}

/** "2026-10-22" → "2026-10-31". Handles leap years. */
export function monthEnd(date: DateString = today()): DateString {
  const { year, month } = parts(date);
  // Day 0 of next month = last day of this month
  return toDateString(new Date(Date.UTC(year, month, 0)));
}

/** Month start shifted by n months: ("2026-10-01", -1) → "2026-09-01". For the History month picker. */
export function addMonths(date: DateString, n: number): DateString {
  const { year, month } = parts(date);
  return toDateString(new Date(Date.UTC(year, month - 1 + n, 1)));
}

/** Days in the month, and which day `date` is: ("2026-10-22") → { day: 22, of: 31 }. For "day 22 of 31". */
export function dayOfMonth(date: DateString = today()) {
  return { day: parts(date).day, of: parts(monthEnd(date)).day };
}

const monthLabel = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
const shortDayLabel = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });

function asUtc(date: DateString) {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

/** "2026-10-01" → "October 2026". */
export function formatMonth(date: DateString): string {
  return monthLabel.format(asUtc(date));
}

/** "2026-10-22" → "Today", "Yesterday", or "Oct 20". For transaction lists grouped by day. */
export function formatDay(date: DateString, now: DateString = today()): string {
  if (date === now) return "Today";
  if (date === toDateString(new Date(asUtc(now).getTime() - 86_400_000))) return "Yesterday";
  return shortDayLabel.format(asUtc(date));
}
