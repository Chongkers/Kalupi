import { describe, expect, it } from "vitest";
import { noSpendStreak } from "./month-stats";

describe("noSpendStreak", () => {
  // Index 0 = day 1
  it("counts zero-spend days back from today", () => {
    expect(noSpendStreak([500, 0, 0, 0, 0], 5)).toBe(4);
  });

  it("is zero when today already has spending", () => {
    expect(noSpendStreak([0, 0, 120], 3)).toBe(0);
  });

  it("stops at the start of the month", () => {
    expect(noSpendStreak([0, 0, 0, 0], 4)).toBe(4);
  });

  it("ignores days after today", () => {
    expect(noSpendStreak([0, 0, 900, 900], 2)).toBe(2);
  });
});
