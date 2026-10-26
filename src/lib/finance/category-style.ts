// Icons and colors for categories and accounts (v1.0.1). Categories store an icon and color key
// the user picked; when they haven't, one is guessed from the name so every category has a look.
// Keys only here; src/components/finance/category-icon.tsx turns them into SVG icons.
import type { AccountKind, CategoryKind } from "./types";

/** The eight category colors, in the palette's fixed order (globals.css --cat-*). */
export const CATEGORY_COLORS = ["blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red"] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** Icons a category can use (lucide names). */
export const CATEGORY_ICONS = [
  "utensils",
  "coffee",
  "cup-soda",
  "shopping-cart",
  "bus",
  "car",
  "fuel",
  "plane",
  "zap",
  "wifi",
  "smartphone",
  "house",
  "heart-pulse",
  "pill",
  "dumbbell",
  "shopping-bag",
  "shirt",
  "gift",
  "clapperboard",
  "gamepad",
  "music",
  "book-open",
  "graduation-cap",
  "baby",
  "paw-print",
  "receipt",
  "briefcase",
  "laptop",
  "coins",
  "hand-coins",
  "piggy-bank",
  "wallet",
  "tag",
  "ellipsis",
] as const;
export type CategoryIconKey = (typeof CATEGORY_ICONS)[number];

export type CategoryStyle = { icon: CategoryIconKey; color: CategoryColor };

// Checked in order; the first match wins. Covers the 12 starter categories and common custom ones.
const RULES: [RegExp, CategoryIconKey, CategoryColor][] = [
  [/opening balance/i, "wallet", "violet"],
  [/salary|sweldo|payroll|wage/i, "briefcase", "green"],
  [/freelance|side ?(gig|hustle)|commission|project/i, "laptop", "aqua"],
  [/allowance|baon/i, "hand-coins", "green"],
  [/interest|dividend|invest/i, "coins", "yellow"],
  [/milk ?tea|soda|drinks?|boba/i, "cup-soda", "magenta"],
  [/coffee|cafe|kape/i, "coffee", "orange"],
  [/grocer|market|palengke|supermarket/i, "shopping-cart", "green"],
  [/food|dining|meal|lunch|dinner|breakfast|snack|eat/i, "utensils", "orange"],
  [/fuel|gas(oline)?|diesel/i, "fuel", "red"],
  [/grab|taxi|car|parking|toll/i, "car", "blue"],
  [/transport|fare|jeep|bus|commute|mrt|lrt|train|tricycle/i, "bus", "blue"],
  [/travel|trip|flight|vacation|hotel/i, "plane", "aqua"],
  [/internet|wifi|wi-fi|fiber/i, "wifi", "blue"],
  [/load|phone|mobile|data/i, "smartphone", "violet"],
  [/utilit|electric|meralco|water|bill/i, "zap", "yellow"],
  [/housing|rent|house|home|condo|dorm/i, "house", "violet"],
  [/medicine|pharma|drugstore|vitamin/i, "pill", "red"],
  [/health|medical|doctor|hospital|dental|clinic/i, "heart-pulse", "red"],
  [/gym|fitness|sport|workout/i, "dumbbell", "aqua"],
  [/cloth|apparel|shoes|fashion/i, "shirt", "magenta"],
  [/shop|mall|lazada|shopee/i, "shopping-bag", "magenta"],
  [/gift|birthday|christmas|pasalubong/i, "gift", "red"],
  [/game|gaming|steam/i, "gamepad", "violet"],
  [/music|spotify|concert/i, "music", "magenta"],
  [/entertain|movie|cinema|netflix|stream|fun/i, "clapperboard", "aqua"],
  [/tuition|school|education|course|class/i, "graduation-cap", "blue"],
  [/book/i, "book-open", "blue"],
  [/baby|kid|child/i, "baby", "magenta"],
  [/pet|dog|cat|vet/i, "paw-print", "orange"],
  [/sav(e|ing)|emergency fund/i, "piggy-bank", "green"],
  [/subscription|fee|tax/i, "receipt", "yellow"],
  [/^other$/i, "ellipsis", "violet"],
];

// Keywords must start a word, so "Healthcare" isn't "car" and "Competition" isn't "pet"
const anchored = new Map<RegExp, RegExp>();
function startsWord(pattern: RegExp) {
  let result = anchored.get(pattern);
  if (!result) anchored.set(pattern, (result = new RegExp(`\b(?:${pattern.source})`, pattern.flags)));
  return result;
}

/** A stable color for names no rule knows, so the same name always gets the same color. */
function colorFromName(name: string): CategoryColor {
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

/** The category's icon and color: what the user picked, else a guess from its name. */
export function categoryStyle(category: {
  name: string;
  kind?: CategoryKind;
  icon?: string | null;
  color?: string | null;
}): CategoryStyle {
  const rule = RULES.find(([pattern]) => startsWord(pattern).test(category.name));
  const guessed: CategoryStyle = rule
    ? { icon: rule[1], color: rule[2] }
    : { icon: category.kind === "income" ? "coins" : "tag", color: colorFromName(category.name) };

  return {
    icon: isIcon(category.icon) ? category.icon : guessed.icon,
    color: isColor(category.color) ? category.color : guessed.color,
  };
}

export function isIcon(value: unknown): value is CategoryIconKey {
  return typeof value === "string" && (CATEGORY_ICONS as readonly string[]).includes(value);
}

export function isColor(value: unknown): value is CategoryColor {
  return typeof value === "string" && (CATEGORY_COLORS as readonly string[]).includes(value);
}

/** Each account type has a fixed icon and color. */
export const ACCOUNT_STYLES: Record<AccountKind, { icon: "banknote" | "landmark" | "smartphone"; color: CategoryColor }> = {
  cash: { icon: "banknote", color: "green" },
  bank: { icon: "landmark", color: "blue" },
  ewallet: { icon: "smartphone", color: "violet" },
};
