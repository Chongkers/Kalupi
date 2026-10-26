import { describe, expect, it } from "vitest";
import { addMonths, dayOfMonth, formatDay, formatMonth, monthEnd, monthStart, today } from "./dates";

describe("today", () => {
  it("is the date in Manila, not UTC", () => {
    // 2026-10-22 17:00 UTC is already 01:00 on the 23rd in Manila (UTC+8)
    expect(today(new Date("2026-10-22T17:00:00Z"))).toBe("2026-10-23");
    expect(today(new Date("2026-10-22T15:59:59Z"))).toBe("2026-10-22");
  });
});

describe("month helpers", () => {
  it("finds the first and last day", () => {
    expect(monthStart("2026-10-22")).toBe("2026-10-01");
    expect(monthEnd("2026-10-22")).toBe("2026-10-31");
    expect(monthEnd("2026-09-05")).toBe("2026-09-30");
  });

  it("handles February and leap years", () => {
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
  });

  it("moves across year boundaries", () => {
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-10-01", -13)).toBe("2025-09-01");
  });

  it("knows which day of how many", () => {
    expect(dayOfMonth("2026-10-24")).toEqual({ day: 24, of: 31 });
    expect(dayOfMonth("2026-02-01")).toEqual({ day: 1, of: 28 });
  });
});

describe("labels", () => {
  it("names the month", () => {
    expect(formatMonth("2026-10-01")).toBe("October 2026");
  });

  it("says Today and Yesterday, then the date", () => {
    expect(formatDay("2026-10-24", "2026-10-24")).toBe("Today");
    expect(formatDay("2026-10-23", "2026-10-24")).toBe("Yesterday");
    expect(formatDay("2026-09-30", "2026-10-01")).toBe("Yesterday");
    expect(formatDay("2026-10-20", "2026-10-24")).toBe("Oct 20");
  });
});
