// Reading a Tarsi backup (Tarsi → Settings → Export, a .csv) and turning it into a Kalupi import plan.
// One CSV holds every record type in one wide table; `recordType` says which columns matter.
// Only accounts, expenses and income are imported; anything else is counted and reported as skipped.
// Pure functions: the plan is applied by importTarsi() in src/lib/local/mutations.ts.
import { today as manilaToday, type DateString } from "@/lib/dates";
import type { AccountKind, CategoryKind } from "@/lib/finance/types";
import { formatPeso } from "@/lib/money";

/** RFC 4180 CSV: quoted fields, "" escapes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell !== ""));
}

export type TarsiAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  /** Current balance in centavos */
  balance: number;
  archived: boolean;
  createdAt: string | null;
};

export type TarsiEntry = {
  id: string;
  type: "income" | "expense";
  /** Centavos */
  amount: number;
  accountId: string;
  /** Tarsi's category key ("food", "allowance"); "" when it had none */
  category: string;
  date: DateString;
  note: string | null;
  createdAt: string | null;
};

export type TarsiBackup = {
  exportedAt: string | null;
  accounts: TarsiAccount[];
  entries: TarsiEntry[];
  /** Record types that aren't imported, with how many there were */
  skipped: Record<string, number>;
};

export class TarsiFormatError extends Error {}

const toCentavos = (value: string) => Math.round(Number(value) * 100);

function accountKind(icon: string, template: string, name: string): AccountKind {
  const text = `${icon} ${template} ${name}`.toLowerCase();
  if (/gcash|maya|paymaya|grabpay|shopeepay|coins\.ph|e-?wallet|phone/.test(text)) return "ewallet";
  if (/cash|wallet|money|coin/.test(text) && !/business|bank/.test(text)) return "cash";
  return "bank";
}

/** Read the CSV. Throws TarsiFormatError when it isn't a Tarsi backup. */
export function readTarsiBackup(text: string): TarsiBackup {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ""));
  if (!header?.includes("recordType") || !header.includes("amount") || !header.includes("accountId")) {
    throw new TarsiFormatError("This doesn't look like a Tarsi backup. Export it from Tarsi as a .csv and try again.");
  }
  const col = new Map(header.map((name, i) => [name, i]));
  const get = (row: string[], name: string) => (row[col.get(name) ?? -1] ?? "").trim();

  const backup: TarsiBackup = { exportedAt: null, accounts: [], entries: [], skipped: {} };

  for (const row of rows) {
    const type = get(row, "recordType");
    if (type === "metadata") {
      backup.exportedAt = get(row, "exportedAt") || null;
    } else if (type === "account") {
      backup.accounts.push({
        id: get(row, "id"),
        name: get(row, "name") || "Account",
        kind: accountKind(get(row, "icon"), get(row, "bankAccountTemplateId"), get(row, "name")),
        balance: toCentavos(get(row, "balance") || "0"),
        archived: !!get(row, "archivedAt"),
        createdAt: get(row, "createdAt") || null,
      });
    } else if (type === "expense" || type === "income") {
      // Planned (not yet real) entries aren't money that moved
      if (get(row, "planned") === "true") {
        backup.skipped[`planned ${type}`] = (backup.skipped[`planned ${type}`] ?? 0) + 1;
        continue;
      }
      const amount = toCentavos(get(row, "amount"));
      const date = get(row, "date");
      if (!(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        backup.skipped[`unreadable ${type}`] = (backup.skipped[`unreadable ${type}`] ?? 0) + 1;
        continue;
      }
      backup.entries.push({
        id: get(row, "id"),
        type,
        amount,
        accountId: get(row, "accountId"),
        // Expenses carry `category`; income carries `tagId`
        category: (type === "expense" ? get(row, "category") : get(row, "tagId") || get(row, "category")).toLowerCase(),
        date,
        note: get(row, "note") || get(row, "notes") || null,
        createdAt: get(row, "createdAt") || null,
      });
    } else if (type) {
      backup.skipped[type] = (backup.skipped[type] ?? 0) + 1;
    }
  }
  return backup;
}

// Tarsi keys that have a Kalupi starter category. Anything else becomes its own category.
const KNOWN: Record<CategoryKind, Record<string, string>> = {
  expense: {
    food: "Food & Dining",
    dining: "Food & Dining",
    transport: "Transportation",
    transportation: "Transportation",
    utilities: "Utilities",
    housing: "Housing",
    rent: "Housing",
    health: "Healthcare",
    healthcare: "Healthcare",
    shopping: "Shopping",
    entertainment: "Entertainment",
    other: "Other",
    "": "Other",
  },
  income: {
    salary: "Salary",
    freelance: "Freelance",
    other: "Other",
    "": "Other",
  },
};

/** "side-hustle" → "Side Hustle" */
function titleCase(key: string) {
  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function categoryNameFor(key: string, kind: CategoryKind): string {
  return KNOWN[kind][key] ?? titleCase(key);
}

export type PlannedAccount = TarsiAccount & {
  /** Recorded as an "Opening balance" income so the balance matches Tarsi; 0 = none needed */
  opening: number;
  openingDate: DateString;
};

export type ImportPlan = {
  accounts: PlannedAccount[];
  entries: (TarsiEntry & { categoryName: string })[];
  /** Category names the import needs, by kind (created if missing) */
  categories: { name: string; kind: CategoryKind }[];
  totals: { income: number; expense: number; first: DateString | null; last: DateString | null };
  warnings: string[];
  skipped: Record<string, number>;
};

/** Work out what to create so Kalupi ends up with Tarsi's accounts, entries and balances. */
export function planTarsiImport(backup: TarsiBackup): ImportPlan {
  const warnings: string[] = [];
  const known = new Set(backup.accounts.map((a) => a.id));
  const entries = backup.entries
    .filter((e) => {
      if (known.has(e.accountId)) return true;
      warnings.push(`Skipped an entry on ${e.date}: its account isn't in the backup.`);
      return false;
    })
    .map((e) => ({ ...e, categoryName: categoryNameFor(e.category, e.type) }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

  const accounts = backup.accounts.map((account): PlannedAccount => {
    const own = entries.filter((e) => e.accountId === account.id);
    const flow = own.reduce((sum, e) => sum + (e.type === "income" ? e.amount : -e.amount), 0);
    const opening = account.balance - flow;
    const created = account.createdAt ? manilaToday(new Date(account.createdAt)) : null;
    const firstEntry = own[0]?.date ?? null;
    const openingDate = [created, firstEntry].filter((d): d is string => !!d).sort()[0] ?? manilaToday();
    if (opening < 0) {
      // A starting balance can't be negative, so the history alone sets this account's balance
      warnings.push(
        `${account.name} will show ${formatPeso(-opening)} more than its ${formatPeso(account.balance)} balance in Tarsi: its entries don't add up. Check it after importing.`,
      );
    }
    return { ...account, opening: Math.max(0, opening), openingDate };
  });

  const categories = new Map<string, { name: string; kind: CategoryKind }>();
  for (const e of entries) categories.set(`${e.type}:${e.categoryName.toLowerCase()}`, { name: e.categoryName, kind: e.type });

  const dates = entries.map((e) => e.date);
  return {
    accounts,
    entries,
    categories: [...categories.values()],
    totals: {
      income: entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0),
      expense: entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0),
      first: dates[0] ?? null,
      last: dates.at(-1) ?? null,
    },
    warnings,
    skipped: backup.skipped,
  };
}
