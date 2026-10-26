// Every change the app makes. Each one writes to the local database and queues the same
// rows in the outbox in one IndexedDB transaction, so the screen updates instantly (even
// offline) and sync.ts sends them to Supabase when it can.
import { monthStart, today, type DateString } from "@/lib/dates";
import { OPENING_BALANCE, type AccountKind, type CategoryKind } from "@/lib/finance/types";
import { formatPeso, parseOptionalPeso, parsePeso } from "@/lib/money";
import {
  db,
  getMeta,
  rowKey,
  type AccountRow,
  type BudgetItemRow,
  type BudgetRow,
  type CategoryRow,
  type PresetRow,
  type SyncedTable,
  type TableRows,
  type TrackerRow,
  type TransactionRow,
} from "./db";
import { scheduleSync } from "./sync";

export type Result = { error?: string };

type Change = { [T in SyncedTable]: { table: T; row: TableRows[T] } }[SyncedTable];

/** Save rows locally and queue them, all or nothing. Order matters: parents before children. */
async function write(changes: Change[]) {
  const now = new Date().toISOString();
  const tables = [...new Set(changes.map((c) => db.table(c.table)))];

  await db.transaction("rw", [...tables, db.outbox], async () => {
    for (const change of changes) {
      const row = { ...change.row, updated_at: now };
      await db.table(change.table).put(row);
      await db.outbox.add({ table: change.table, key: rowKey(change.table, row), row, createdAt: now, attempts: 0 });
    }
  });
  scheduleSync();
}

async function userId(): Promise<string> {
  const owner = await getMeta<{ userId: string }>("owner");
  if (!owner) throw new Error("Not logged in");
  return owner.userId;
}

const id = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const ACCOUNT_KINDS: AccountKind[] = ["cash", "bank", "ewallet"];

// ---------------------------------------------------------------------------
// Setup wizard (Phase 3)
// ---------------------------------------------------------------------------

export type SetupInput = {
  accounts: { name: string; kind: AccountKind; balance: string }[];
  limits: { categoryId: string; amount: string }[];
};

export async function completeSetup(input: SetupInput): Promise<Result> {
  const accounts = input.accounts.map((a) => ({ name: a.name.trim(), kind: a.kind, balance: parseOptionalPeso(a.balance) }));
  if (accounts.length === 0) return { error: "Add at least one account." };
  if (accounts.some((a) => !a.name)) return { error: "Give every account a name." };
  if (accounts.some((a) => !ACCOUNT_KINDS.includes(a.kind))) return { error: "Pick a type for every account." };
  if (accounts.some((a) => a.balance === null)) return { error: "Check the starting balances. Use numbers like 1500 or 1,500.50." };
  const names = accounts.map((a) => a.name.toLowerCase());
  if (new Set(names).size !== names.length) return { error: "Two accounts have the same name." };

  const limits = input.limits.map((l) => ({ categoryId: l.categoryId, amount: parseOptionalPeso(l.amount) }));
  if (limits.some((l) => l.amount === null)) return { error: "Check the budget limits. Use numbers like 5000." };

  const user = await userId();
  const changes: Change[] = [];

  // Budget template (month = null), copied into each new month
  const template = await templateBudget();
  const templateRow: BudgetRow = template ?? newBudget(user, null);
  if (!template) changes.push({ table: "budgets", row: templateRow });
  changes.push(...(await limitChanges(templateRow.id, limits as { categoryId: string; amount: number }[])));

  // Accounts, and their starting balances as "Opening balance" income (docs/erd.md, Rules)
  const opening = await openingBalanceCategory(user, changes);
  for (const a of accounts) {
    const account: AccountRow = newAccount(user, a.name, a.kind);
    changes.push({ table: "accounts", row: account });
    if (a.balance! > 0) changes.push({ table: "transactions", row: openingBalanceEntry(user, account, a.balance!, opening) });
  }

  await write(changes);
  return {};
}

// ---------------------------------------------------------------------------
// Transactions (Phase 4)
// ---------------------------------------------------------------------------

export type TransactionInput = {
  id?: string;
  type: string;
  amount: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  occurredOn: string;
  note: string;
  /** How a new entry was made; edits keep the original */
  source?: TransactionRow["source"];
};

const FORM_TYPES = ["expense", "income", "transfer"] as const;

export async function saveTransaction(input: TransactionInput): Promise<Result> {
  const type = input.type as (typeof FORM_TYPES)[number];
  const amount = parsePeso(input.amount);
  const note = input.note.trim();

  if (!FORM_TYPES.includes(type)) return { error: "Pick expense, income or transfer." };
  if (amount === null) return { error: "Enter an amount, like 250 or 1,250.50." };
  if (!input.accountId) return { error: "Pick an account." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) return { error: "Pick a date." };
  if (note.length > 200) return { error: "Keep the note to 200 characters or fewer." };

  if (type === "transfer") {
    if (!input.toAccountId) return { error: "Pick the account the money goes to." };
    if (input.toAccountId === input.accountId) return { error: "Pick two different accounts." };
  } else {
    const category = await db.categories.get(input.categoryId);
    if (!category || category.deleted_at) return { error: "Pick a category." };
    if (category.kind !== type) return { error: `Pick an ${type} category.` };
  }

  const fields = {
    type,
    amount,
    account_id: input.accountId,
    to_account_id: type === "transfer" ? input.toAccountId : null,
    category_id: type === "transfer" ? null : input.categoryId,
    tracker_id: null,
    occurred_on: input.occurredOn,
    note: note || null,
  };

  if (input.id) {
    const existing = await db.transactions.get(input.id);
    if (!existing || existing.deleted_at) return { error: "This entry was deleted." };
    await write([{ table: "transactions", row: { ...existing, ...fields } }]);
  } else {
    const row: TransactionRow = {
      ...fields,
      id: id(),
      user_id: await userId(),
      source: input.source ?? "manual",
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
    };
    await write([{ table: "transactions", row }]);
  }
  return {};
}

/** Soft delete: other devices learn about it through deleted_at (docs/erd.md, Sync). */
export async function deleteTransaction(transactionId: string): Promise<Result> {
  const existing = await db.transactions.get(transactionId);
  if (!existing || existing.deleted_at) return {};
  await write([{ table: "transactions", row: { ...existing, deleted_at: nowIso() } }]);
  return {};
}

// ---------------------------------------------------------------------------
// Accounts and categories (Phase 4)
// ---------------------------------------------------------------------------

export async function addAccount(name: string, kind: AccountKind, balanceText: string): Promise<Result> {
  name = name.trim();
  const balance = parseOptionalPeso(balanceText);
  if (!name) return { error: "Give the account a name." };
  if (!ACCOUNT_KINDS.includes(kind)) return { error: "Pick a type." };
  if (balance === null) return { error: "Check the starting balance. Use numbers like 1500." };
  if (live(await db.accounts.toArray()).some((a) => sameName(a.name, name))) {
    return { error: "You already have an account with that name." };
  }

  const user = await userId();
  const account = newAccount(user, name, kind);
  const changes: Change[] = [{ table: "accounts", row: account }];
  if (balance > 0) {
    const opening = await openingBalanceCategory(user, changes);
    changes.push({ table: "transactions", row: openingBalanceEntry(user, account, balance, opening) });
  }
  await write(changes);
  return {};
}

export async function renameAccount(accountId: string, name: string): Promise<Result> {
  name = name.trim();
  if (!name) return { error: "Enter a name." };
  const all = live(await db.accounts.toArray());
  if (all.some((a) => a.id !== accountId && sameName(a.name, name))) return { error: "You already have an account with that name." };
  const account = all.find((a) => a.id === accountId);
  if (!account) return { error: "That account was removed." };
  await write([{ table: "accounts", row: { ...account, name } }]);
  return {};
}

export async function setAccountArchived(accountId: string, archived: boolean): Promise<Result> {
  const account = await db.accounts.get(accountId);
  if (!account) return { error: "That account was removed." };
  await write([{ table: "accounts", row: { ...account, archived_at: archived ? nowIso() : null } }]);
  return {};
}

export async function addCategory(name: string, kind: CategoryKind): Promise<Result> {
  name = name.trim();
  if (!name) return { error: "Give the category a name." };
  if (kind !== "income" && kind !== "expense") return { error: "Pick income or expense." };
  if (live(await db.categories.toArray()).some((c) => c.kind === kind && sameName(c.name, name))) {
    return { error: "That category already exists." };
  }
  await write([{ table: "categories", row: newCategory(await userId(), name, kind) }]);
  return {};
}

export async function renameCategory(categoryId: string, name: string): Promise<Result> {
  name = name.trim();
  if (!name) return { error: "Enter a name." };
  if (sameName(name, OPENING_BALANCE)) return { error: "That name is reserved for starting balances." };
  const all = live(await db.categories.toArray());
  const category = all.find((c) => c.id === categoryId);
  if (!category || category.name === OPENING_BALANCE) return { error: "That category can't be renamed." };
  if (all.some((c) => c.id !== categoryId && c.kind === category.kind && sameName(c.name, name))) {
    return { error: "That category already exists." };
  }
  await write([{ table: "categories", row: { ...category, name } }]);
  return {};
}

export async function setCategoryArchived(categoryId: string, archived: boolean): Promise<Result> {
  const category = await db.categories.get(categoryId);
  if (!category || category.name === OPENING_BALANCE) return { error: "That category can't be archived." };
  await write([{ table: "categories", row: { ...category, archived_at: archived ? nowIso() : null } }]);
  return {};
}

// ---------------------------------------------------------------------------
// Budgets (Phase 5)
// ---------------------------------------------------------------------------

export type BudgetInput = {
  /** First day of the month being edited (this month, or a past one from History) */
  month: DateString;
  limits: { categoryId: string; amount: string }[];
  /** Overall monthly limit; "" = use the sum of the category limits */
  totalLimit: string;
  /** Also make these the template new months start from */
  alsoTemplate: boolean;
  /** Custom limits for things that don't have a category yet: each becomes a new expense category */
  newCategories?: { name: string; amount: string }[];
};

/** Save a month's limits ("" or 0 = no limit), its optional overall limit, and any new custom categories. */
export async function saveBudget(input: BudgetInput): Promise<Result> {
  const limits = input.limits.map((l) => ({ categoryId: l.categoryId, amount: parseOptionalPeso(l.amount) }));
  if (limits.some((l) => l.amount === null)) return { error: "Check the limits. Use numbers like 5000 or leave blank for no limit." };
  const clean = limits as { categoryId: string; amount: number }[];
  const total = parseOptionalPeso(input.totalLimit);
  if (total === null) return { error: "Check the overall limit. Use a number like 20000 or leave it blank." };
  const totalLimit = total > 0 ? total : null;

  const user = await userId();
  const changes: Change[] = [];

  // New custom categories go first: their budget items point at them
  const taken = live(await db.categories.toArray()).filter((c) => c.kind === "expense");
  for (const draft of input.newCategories ?? []) {
    const name = draft.name.trim();
    const amount = parsePeso(draft.amount);
    if (!name && !draft.amount.trim()) continue; // an empty row left in the form
    if (!name) return { error: "Give each custom limit a name." };
    if (name.length > 40) return { error: "Keep custom limit names to 40 characters or fewer." };
    if (sameName(name, OPENING_BALANCE)) return { error: "That name is reserved for starting balances." };
    if (taken.some((c) => sameName(c.name, name))) {
      return { error: `You already have a "${name}" category. Set its limit in the list instead.` };
    }
    if (amount === null) return { error: `Give "${name}" a limit, like 1500.` };
    const category = newCategory(user, name, "expense");
    taken.push(category);
    changes.push({ table: "categories", row: category });
    clean.push({ categoryId: category.id, amount });
  }

  const save = async (budget: BudgetRow | undefined, month: DateString | null) => {
    const row = budget ?? newBudget(user, month);
    if (!budget || (row.total_limit ?? null) !== totalLimit) {
      changes.push({ table: "budgets", row: { ...row, total_limit: totalLimit } });
    }
    changes.push(...(await limitChanges(row.id, clean)));
  };

  await save(await budgetFor(input.month), input.month);
  if (input.alsoTemplate) await save(await templateBudget(), null);

  if (changes.length > 0) await write(changes);
  return {};
}

/** Opening a month with no budget copies the template (docs/erd.md, Rules). Does nothing without a template. */
export async function ensureMonthBudget(month: DateString = monthStart(today())) {
  if (await budgetFor(month)) return;
  const template = await templateBudget();
  if (!template) return;

  const budget = { ...newBudget(template.user_id, month), total_limit: template.total_limit ?? null };
  const items = live(await db.budget_items.where("budget_id").equals(template.id).toArray());
  await write([
    { table: "budgets", row: budget },
    ...items.map((item): Change => ({ table: "budget_items", row: newItem(budget.id, item.category_id, item.limit_amount) })),
  ]);
}

async function budgetFor(month: DateString) {
  return (await db.budgets.toArray()).find((b) => b.month === month && !b.deleted_at);
}

async function templateBudget() {
  return (await db.budgets.toArray()).find((b) => b.month === null && !b.deleted_at);
}

/** Changes that make a budget's items match `limits`, reusing existing rows (one per category). */
async function limitChanges(budgetId: string, limits: { categoryId: string; amount: number }[]): Promise<Change[]> {
  const existing = await db.budget_items.where("budget_id").equals(budgetId).toArray();
  const changes: Change[] = [];

  for (const { categoryId, amount } of limits) {
    const item = existing.find((i) => i.category_id === categoryId);
    if (amount > 0) {
      if (!item) changes.push({ table: "budget_items", row: newItem(budgetId, categoryId, amount) });
      else if (item.limit_amount !== amount || item.deleted_at) {
        changes.push({ table: "budget_items", row: { ...item, limit_amount: amount, deleted_at: null } });
      }
    } else if (item && !item.deleted_at) {
      changes.push({ table: "budget_items", row: { ...item, deleted_at: nowIso() } });
    }
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Trackers (Phase 7)
// ---------------------------------------------------------------------------

export type TrackerInput = { id?: string; name: string; target: string; targetDate: string };

export async function saveTracker(input: TrackerInput): Promise<Result & { id?: string }> {
  const name = input.name.trim();
  const target = parsePeso(input.target);
  if (!name) return { error: "Give the tracker a name." };
  if (name.length > 60) return { error: "Keep the name to 60 characters or fewer." };
  if (target === null) return { error: "Enter a target, like 20000." };
  if (input.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) return { error: "Pick a valid date." };
  const fields = { name, target_amount: target, target_date: input.targetDate || null };

  if (input.id) {
    const existing = await db.trackers.get(input.id);
    if (!existing || existing.deleted_at) return { error: "That tracker was removed." };
    await write([{ table: "trackers", row: { ...existing, ...fields } }]);
    return { id: existing.id };
  }

  const user = await userId();
  const tracker: TrackerRow = {
    ...fields,
    id: id(),
    created_by: user,
    archived_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
  };
  await write([{ table: "trackers", row: tracker }]);
  // The server's trigger makes the creator the owner. Mirror that here (not queued: there's no
  // insert policy for members) so the tracker shows up right away, offline too. The next pull
  // replaces it with the server's row.
  await db.tracker_members.put({
    tracker_id: tracker.id,
    user_id: user,
    role: "owner",
    joined_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
  });
  return { id: tracker.id };
}

/** Owner only (the server enforces it too). Archived trackers keep their money set aside until withdrawn. */
export async function setTrackerArchived(trackerId: string, archived: boolean): Promise<Result> {
  const tracker = await db.trackers.get(trackerId);
  if (!tracker) return { error: "That tracker was removed." };
  if ((await myRole(trackerId)) !== "owner") return { error: "Only the owner can archive this tracker." };
  await write([{ table: "trackers", row: { ...tracker, archived_at: archived ? nowIso() : null } }]);
  return {};
}

export type TrackerEntryInput = {
  id?: string;
  trackerId: string;
  type: "contribution" | "withdrawal";
  amount: string;
  accountId: string;
  occurredOn: string;
  note: string;
  source?: TransactionRow["source"];
};

/**
 * Put money toward a tracker (contribution) or take it back (withdrawal). The money stays in the
 * account; it's only set aside, so it leaves your available balance (docs/erd.md).
 */
export async function saveTrackerEntry(input: TrackerEntryInput): Promise<Result> {
  const amount = parsePeso(input.amount);
  const note = input.note.trim();
  if (input.type !== "contribution" && input.type !== "withdrawal") return { error: "Pick add or withdraw." };
  if (amount === null) return { error: "Enter an amount, like 500." };
  if (!input.accountId) return { error: "Pick an account." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) return { error: "Pick a date." };
  if (note.length > 200) return { error: "Keep the note to 200 characters or fewer." };
  if (!(await myRole(input.trackerId))) return { error: "You're not a member of this tracker." };

  const all = live(await db.transactions.toArray());
  const existing = input.id ? all.find((t) => t.id === input.id) : undefined;
  if (input.id && !existing) return { error: "This entry was deleted." };

  // Can't take back more than you've put in
  if (input.type === "withdrawal") {
    const net = trackerNet(all.filter((t) => t.id !== input.id), input.trackerId);
    if (amount > net) return { error: `You can withdraw up to ${formatPeso(Math.max(0, net))}, what you've put in.` };
  }

  const fields = {
    type: input.type,
    amount,
    account_id: input.accountId,
    to_account_id: null,
    category_id: null,
    tracker_id: input.trackerId,
    occurred_on: input.occurredOn,
    note: note || null,
  };
  const row: TransactionRow = existing
    ? { ...existing, ...fields }
    : {
        ...fields,
        id: id(),
        user_id: await userId(),
        source: input.source ?? "manual",
        created_at: nowIso(),
        updated_at: nowIso(),
        deleted_at: null,
      };
  await write([{ table: "transactions", row }]);
  return {};
}

/** Leave a shared tracker. What you put in is withdrawn first, so it's yours to spend again. */
export async function leaveTracker(trackerId: string): Promise<Result> {
  const user = await userId();
  const membership = await db.tracker_members.get([trackerId, user]);
  if (!membership || membership.deleted_at) return {};
  if (membership.role === "owner") return { error: "The owner can't leave. Archive the tracker instead." };

  const changes: Change[] = [];
  const mine = live(await db.transactions.toArray()).filter((t) => t.tracker_id === trackerId);
  const net = trackerNet(mine, trackerId);
  if (net > 0) {
    const lastContribution = mine.filter((t) => t.type === "contribution").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    changes.push({
      table: "transactions",
      row: {
        id: id(),
        user_id: user,
        type: "withdrawal",
        amount: net,
        account_id: lastContribution.account_id,
        to_account_id: null,
        category_id: null,
        tracker_id: trackerId,
        occurred_on: today(),
        note: "Left the tracker",
        source: "manual",
        created_at: nowIso(),
        updated_at: nowIso(),
        deleted_at: null,
      },
    });
  }
  // Queued after the withdrawal: adding entries needs membership
  changes.push({ table: "tracker_members", row: { ...membership, deleted_at: nowIso() } });
  await write(changes);
  return {};
}

/** Owner removes someone. Their past contributions still count toward the total. */
export async function removeMember(trackerId: string, memberId: string): Promise<Result> {
  if ((await myRole(trackerId)) !== "owner") return { error: "Only the owner can remove members." };
  const membership = await db.tracker_members.get([trackerId, memberId]);
  if (!membership || membership.deleted_at) return {};
  if (membership.role === "owner") return { error: "The owner can't be removed." };
  await write([{ table: "tracker_members", row: { ...membership, deleted_at: nowIso() } }]);
  return {};
}

async function myRole(trackerId: string) {
  const membership = await db.tracker_members.get([trackerId, await userId()]);
  return membership && !membership.deleted_at ? membership.role : null;
}

function trackerNet(transactions: TransactionRow[], trackerId: string) {
  let net = 0;
  for (const t of transactions) {
    if (t.tracker_id !== trackerId) continue;
    if (t.type === "contribution") net += t.amount;
    if (t.type === "withdrawal") net -= t.amount;
  }
  return net;
}

// ---------------------------------------------------------------------------
// Presets (Phase 8)
// ---------------------------------------------------------------------------

export type PresetInput = {
  id?: string;
  name: string;
  type: string;
  amount: string;
  /** "" = no default account; logging uses the first one */
  accountId: string;
  categoryId: string;
  trackerId: string;
};

const PRESET_TYPES = ["expense", "income", "contribution"] as const;

export async function savePreset(input: PresetInput): Promise<Result> {
  const name = input.name.trim();
  const type = input.type as (typeof PRESET_TYPES)[number];
  const amount = parsePeso(input.amount);
  if (!name) return { error: "Give the preset a name." };
  if (name.length > 40) return { error: "Keep the name to 40 characters or fewer." };
  if (!PRESET_TYPES.includes(type)) return { error: "Pick expense, income or tracker." };
  if (amount === null) return { error: "Enter an amount, like 50." };
  if (type === "contribution" && !input.trackerId) return { error: "Pick a tracker." };
  if (type !== "contribution" && !input.categoryId) return { error: "Pick a category." };

  const fields = {
    name,
    type,
    amount,
    account_id: input.accountId || null,
    category_id: type === "contribution" ? null : input.categoryId,
    tracker_id: type === "contribution" ? input.trackerId : null,
  };

  if (input.id) {
    const existing = await db.presets.get(input.id);
    if (!existing || existing.deleted_at) return { error: "That preset was removed." };
    await write([{ table: "presets", row: { ...existing, ...fields } }]);
  } else {
    const row: PresetRow = {
      ...fields,
      id: id(),
      user_id: await userId(),
      archived_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
    };
    await write([{ table: "presets", row }]);
  }
  return {};
}

export async function setPresetArchived(presetId: string, archived: boolean): Promise<Result> {
  const preset = await db.presets.get(presetId);
  if (!preset) return { error: "That preset was removed." };
  await write([{ table: "presets", row: { ...preset, archived_at: archived ? nowIso() : null } }]);
  return {};
}

/** One-tap logging: today's entry from a preset, optionally with a different amount or account. */
export async function logPreset(presetId: string, amount: string, accountId: string): Promise<Result> {
  const preset = await db.presets.get(presetId);
  if (!preset || preset.deleted_at) return { error: "That preset was removed." };

  if (preset.type === "contribution") {
    return saveTrackerEntry({
      trackerId: preset.tracker_id ?? "",
      type: "contribution",
      amount,
      accountId,
      occurredOn: today(),
      note: preset.name,
      source: "preset",
    });
  }
  return saveTransaction({
    type: preset.type,
    amount,
    accountId,
    toAccountId: "",
    categoryId: preset.category_id ?? "",
    occurredOn: today(),
    note: preset.name,
    source: "preset",
  });
}

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

function newAccount(user: string, name: string, kind: AccountKind): AccountRow {
  return { id: id(), user_id: user, name, kind, archived_at: null, created_at: nowIso(), updated_at: nowIso(), deleted_at: null };
}

function newCategory(user: string, name: string, kind: CategoryKind): CategoryRow {
  return { id: id(), user_id: user, name, kind, archived_at: null, updated_at: nowIso(), deleted_at: null };
}

function newBudget(user: string, month: DateString | null): BudgetRow {
  return { id: id(), user_id: user, month, total_limit: null, created_at: nowIso(), updated_at: nowIso(), deleted_at: null };
}

function newItem(budgetId: string, categoryId: string, limit: number): BudgetItemRow {
  return { id: id(), budget_id: budgetId, category_id: categoryId, limit_amount: limit, updated_at: nowIso(), deleted_at: null };
}

/** The sign-up trigger creates this category; recreate it (queued in `changes`) if it's missing. */
async function openingBalanceCategory(user: string, changes: Change[]): Promise<string> {
  const found = live(await db.categories.toArray()).find((c) => c.kind === "income" && c.name === OPENING_BALANCE);
  if (found) return found.id;
  const created = newCategory(user, OPENING_BALANCE, "income");
  changes.push({ table: "categories", row: created });
  return created.id;
}

function openingBalanceEntry(user: string, account: AccountRow, amount: number, categoryId: string): TransactionRow {
  return {
    id: id(),
    user_id: user,
    type: "income",
    amount,
    account_id: account.id,
    to_account_id: null,
    category_id: categoryId,
    tracker_id: null,
    occurred_on: today(),
    note: `Starting balance of ${account.name}`,
    source: "manual",
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
  };
}
