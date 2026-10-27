import { describe, expect, it } from "vitest";
import { isPresetOrder, orderPresets } from "./presets";

const presets = [
  { name: "Fare", created_at: "2026-10-02T00:00:00Z" },
  { name: "Coffee", created_at: "2026-10-01T00:00:00Z" },
  { name: "Lunch", created_at: "2026-10-03T00:00:00Z" },
];
const logged = (note: string, source = "preset") => ({ source, note });
const names = (list: { name: string }[]) => list.map((p) => p.name);

describe("orderPresets", () => {
  it("sorts by when they were added", () => {
    expect(names(orderPresets(presets, "first", []))).toEqual(["Coffee", "Fare", "Lunch"]);
    expect(names(orderPresets(presets, "latest", []))).toEqual(["Lunch", "Fare", "Coffee"]);
  });

  it("puts the most logged first, counting only entries logged from a preset", () => {
    const transactions = [logged("Coffee"), logged("Fare"), logged("Fare"), logged("Coffee", "manual"), logged("Coffee", "manual")];
    expect(names(orderPresets(presets, "frequent", transactions))).toEqual(["Fare", "Coffee", "Lunch"]);
  });

  it("breaks ties newest first", () => {
    expect(names(orderPresets(presets, "frequent", []))).toEqual(["Lunch", "Fare", "Coffee"]);
  });

  it("leaves the list it was given alone", () => {
    orderPresets(presets, "latest", []);
    expect(names(presets)).toEqual(["Fare", "Coffee", "Lunch"]);
  });
});

describe("isPresetOrder", () => {
  it("accepts only the known orders", () => {
    expect(isPresetOrder("frequent")).toBe(true);
    expect(isPresetOrder("alphabetical")).toBe(false);
    expect(isPresetOrder(undefined)).toBe(false);
  });
});
