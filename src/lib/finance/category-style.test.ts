import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICONS, categoryStyle } from "./category-style";

describe("categoryStyle", () => {
  it.each([
    ["Food & Dining", "utensils", "orange"],
    ["Transportation", "bus", "blue"],
    ["Utilities", "zap", "yellow"],
    ["Housing", "house", "violet"],
    ["Healthcare", "heart-pulse", "red"],
    ["Shopping", "shopping-bag", "magenta"],
    ["Entertainment", "clapperboard", "aqua"],
    ["Other", "ellipsis", "violet"],
    ["Salary", "briefcase", "green"],
    ["Freelance", "laptop", "aqua"],
    ["Opening balance", "wallet", "violet"],
  ])("gives the starter category %s its own look", (name, icon, color) => {
    expect(categoryStyle({ name })).toEqual({ icon, color });
  });

  it.each([
    ["Milk tea", "cup-soda"],
    ["Coffee", "coffee"],
    ["Groceries", "shopping-cart"],
    ["Load", "smartphone"],
    ["Rent", "house"],
    ["Grab rides", "car"],
    ["Tuition", "graduation-cap"],
  ])("guesses an icon for custom names like %s", (name, icon) => {
    expect(categoryStyle({ name }).icon).toBe(icon);
  });

  it("matches keywords at the start of a word only", () => {
    expect(categoryStyle({ name: "Healthcare" }).icon).toBe("heart-pulse");
    expect(categoryStyle({ name: "Competition" }).icon).toBe("tag");
    expect(categoryStyle({ name: "Scatter" }).icon).toBe("tag");
  });

  it("uses what the user picked over the guess", () => {
    expect(categoryStyle({ name: "Food", icon: "gift", color: "blue" })).toEqual({ icon: "gift", color: "blue" });
    expect(categoryStyle({ name: "Food", color: "green" })).toEqual({ icon: "utensils", color: "green" });
  });

  it("ignores icon or color values it doesn't know", () => {
    expect(categoryStyle({ name: "Food", icon: "rocket", color: "teal" })).toEqual({ icon: "utensils", color: "orange" });
  });

  it("falls back to a tag (or coins for income) with a color that's stable for the name", () => {
    const first = categoryStyle({ name: "Zxqv", kind: "expense" });
    expect(first.icon).toBe("tag");
    expect(CATEGORY_COLORS).toContain(first.color);
    expect(categoryStyle({ name: "Zxqv", kind: "expense" })).toEqual(first);
    expect(categoryStyle({ name: "Zxqv", kind: "income" }).icon).toBe("coins");
  });

  it("only offers icon keys the database accepts", () => {
    for (const icon of CATEGORY_ICONS) expect(icon).toMatch(/^[a-z0-9-]{1,40}$/);
    for (const color of CATEGORY_COLORS) expect(color).toMatch(/^[a-z]{1,20}$/);
  });
});
