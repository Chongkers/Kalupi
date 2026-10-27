// The on-device copy of the user's data (IndexedDB via Dexie). Screens read from here,
// writes land here first, and src/lib/local/sync.ts keeps it in step with Supabase.
import Dexie, { type EntityTable } from "dexie";
import type { AccountKind, CategoryKind, TrackerKind, TransactionType } from "@/lib/finance/types";

// Columns every synced table has (docs/erd.md, Sync)
type Synced = { updated_at: string; deleted_at: string | null };

export type AccountRow = Synced & {
  id: string;
  user_id: string;
  name: string;
  kind: AccountKind;
  archived_at: string | null;
  created_at: string;
};

export type CategoryRow = Synced & {
  id: string;
  user_id: string;
  name: string;
  kind: CategoryKind;
  archived_at: string | null;
  /** Icon and color keys (src/lib/finance/category-style.ts); missing = picked from the name */
  icon?: string | null;
  color?: string | null;
};

export type BudgetRow = Synced & {
  id: string;
  user_id: string;
  /** First day of the month; null = the template */
  month: string | null;
  /** Overall limit for the month; null = the sum of the category limits */
  total_limit: number | null;
  created_at: string;
};

export type BudgetItemRow = Synced & {
  id: string;
  budget_id: string;
  category_id: string;
  limit_amount: number;
};

export type TransactionRow = Synced & {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  tracker_id: string | null;
  occurred_on: string;
  note: string | null;
  source: "manual" | "preset" | "scan";
  created_at: string;
};

export type PresetRow = Synced & {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  amount: number;
  account_id: string | null;
  category_id: string | null;
  tracker_id: string | null;
  archived_at: string | null;
  created_at: string;
};

export type TrackerRow = Synced & {
  id: string;
  name: string;
  /** Missing on rows cached before v1.0.3 = goal */
  kind?: TrackerKind;
  /** null for settle-up trackers */
  target_amount: number | null;
  target_date: string | null;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
};

export type TrackerMemberRow = Synced & {
  tracker_id: string;
  user_id: string;
  role: "owner" | "editor";
  joined_at: string;
};

/** Someone on a settle-up tracker. Just a name; they don't need a Kalupi account. */
export type SplitPersonRow = Synced & {
  id: string;
  tracker_id: string;
  user_id: string;
  name: string;
  created_at: string;
};

/**
 * What one person owes you (amount > 0) or you owe them (amount < 0), in centavos.
 * Linked to your expense when you paid the bill, or to the settle_in / settle_out payback.
 * A bill a friend paid has no transaction, and carries the category your share counts toward.
 */
export type SplitShareRow = Synced & {
  id: string;
  user_id: string;
  tracker_id: string;
  person_id: string;
  transaction_id: string | null;
  category_id: string | null;
  amount: number;
  occurred_on: string;
  note: string | null;
  created_at: string;
};

/** A monthly bill (v1.0.4): a reminder that becomes an expense when confirmed. */
export type BillRow = Synced & {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category_id: string;
  account_id: string | null;
  due_day: number;
  starts_on: string;
  ends_on: string | null;
  archived_at: string | null;
  created_at: string;
};

/** One bill, one month: paid (with the expense it logged) or skipped (transaction_id null). */
export type BillPaymentRow = Synced & {
  id: string;
  user_id: string;
  bill_id: string;
  month: string;
  transaction_id: string | null;
  created_at: string;
};

export type TableRows = {
  accounts: AccountRow;
  categories: CategoryRow;
  budgets: BudgetRow;
  budget_items: BudgetItemRow;
  transactions: TransactionRow;
  presets: PresetRow;
  trackers: TrackerRow;
  tracker_members: TrackerMemberRow;
  split_people: SplitPersonRow;
  split_shares: SplitShareRow;
  bills: BillRow;
  bill_payments: BillPaymentRow;
};

export type SyncedTable = keyof TableRows;

/** Pull order: parents before children, so foreign keys always point at something local. */
export const SYNCED_TABLES: SyncedTable[] = [
  "accounts",
  "categories",
  "trackers",
  "tracker_members",
  "split_people",
  "budgets",
  "budget_items",
  "transactions",
  "split_shares",
  "presets",
  "bills",
  "bill_payments",
];

/** A local change waiting to be sent to Supabase. Sent in `seq` order. */
export type OutboxEntry = {
  seq?: number;
  table: SyncedTable;
  /** rowKey() of the row, to find pending changes for it */
  key: string;
  row: TableRows[SyncedTable];
  createdAt: string;
  attempts: number;
  /** Set when Supabase rejected it for good (not a network problem) */
  failed?: string;
};

export type MetaEntry = { key: string; value: unknown };

export function rowKey(table: SyncedTable, row: object): string {
  if (table === "tracker_members") {
    const m = row as TrackerMemberRow;
    return `${m.tracker_id}:${m.user_id}`;
  }
  return (row as { id: string }).id;
}

class KalupiDB extends Dexie {
  accounts!: EntityTable<AccountRow, "id">;
  categories!: EntityTable<CategoryRow, "id">;
  budgets!: EntityTable<BudgetRow, "id">;
  budget_items!: EntityTable<BudgetItemRow, "id">;
  transactions!: EntityTable<TransactionRow, "id">;
  presets!: EntityTable<PresetRow, "id">;
  trackers!: EntityTable<TrackerRow, "id">;
  tracker_members!: Dexie.Table<TrackerMemberRow, [string, string]>;
  split_people!: EntityTable<SplitPersonRow, "id">;
  split_shares!: EntityTable<SplitShareRow, "id">;
  bills!: EntityTable<BillRow, "id">;
  bill_payments!: EntityTable<BillPaymentRow, "id">;
  outbox!: EntityTable<OutboxEntry, "seq">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor() {
    super("kalupi");
    // Only indexed fields are listed; every column is still stored
    this.version(1).stores({
      accounts: "id",
      categories: "id",
      budgets: "id",
      budget_items: "id, budget_id",
      transactions: "id, occurred_on",
      presets: "id",
      trackers: "id",
      tracker_members: "[tracker_id+user_id], tracker_id",
      outbox: "++seq, key",
      meta: "key",
    });
    // v1.0.3: settle-up trackers
    this.version(2).stores({
      split_people: "id, tracker_id",
      split_shares: "id, tracker_id, transaction_id",
    });
    // v1.0.4: monthly bills
    this.version(3).stores({
      bills: "id",
      bill_payments: "id, bill_id, transaction_id",
    });
  }
}

export const db = new KalupiDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

/** Wipe everything: on logout, or when a different user logs in on this device. */
export async function clearLocalData() {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
