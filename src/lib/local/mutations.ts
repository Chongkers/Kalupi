// Every change the app makes. Each one writes to the local database and queues the same
// rows in the outbox in one IndexedDB transaction, so the screen updates instantly (even
// offline) and sync.ts sends them to Supabase when it can.
import { monthStart, today, type DateString } from "@/lib/dates";
import { dueDateIn, endAfterPayments } from "@/lib/finance/bills";
import { isColor, isIcon } from "@/lib/finance/category-style";
import type { ImportPlan } from "@/lib/import/tarsi";
import { personBalances, splitEvenly } from "@/lib/finance/splits";
import { OPENING_BALANCE, type AccountKind, type CategoryKind, type TrackerKind } from "@/lib/finance/types";
import { formatPeso, parseOptionalPeso, parsePeso } from "@/lib/money";
import {
  db,
  getMeta,
  rowKey,
  type AccountRow,
  type BillPaymentRow,
  type BillRow,
  type BudgetItemRow,
  type BudgetRow,
  type CategoryRow,
  type PresetRow,
  type SplitPersonRow,
  type SplitShareRow,
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
  /** Budget by category: a limit for each */
  limits: { categoryId: string; amount: string }[];
  /** Or one total for the month ("" = budget by category) */
  totalLimit?: string;
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
  const total = parseOptionalPeso(input.totalLimit ?? "");
  if (total === null) return { error: "Check the monthly budget. Use a number like 20000." };

  const user = await userId();
  const changes: Change[] = [];

  // Budget template (month = null), copied into each new month
  const template = await templateBudget();
  const templateRow: BudgetRow = { ...(template ?? newBudget(user, null)), total_limit: total > 0 ? total : null };
  if (!template || template.total_limit !== templateRow.total_limit) changes.push({ table: "budgets", row: templateRow });
  if (total > 0) {
    // A total budget has no category limits, so drop any the template already had
    const items = await db.budget_items.where("budget_id").equals(templateRow.id).toArray();
    for (const item of items.filter((i) => !i.deleted_at)) {
      changes.push({ table: "budget_items", row: { ...item, deleted_at: nowIso() } });
    }
  } else {
    changes.push(...(await limitChanges(templateRow.id, limits as { categoryId: string; amount: number }[])));
  }

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
  // A split bill or payback takes its shares with it
  const shares = live(await db.split_shares.where("transaction_id").equals(transactionId).toArray());
  // A bill's expense: the bill is due again for that month
  const billPayments = live(await db.bill_payments.where("transaction_id").equals(transactionId).toArray());
  await write([
    { table: "transactions", row: { ...existing, deleted_at: nowIso() } },
    ...shares.map((share): Change => ({ table: "split_shares", row: { ...share, deleted_at: nowIso() } })),
    ...billPayments.map((p): Change => ({ table: "bill_payments", row: { ...p, deleted_at: nowIso() } })),
  ]);
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

/** The icon and color shown for a category. null = go back to the one picked from its name. */
export async function setCategoryStyle(categoryId: string, icon: string | null, color: string | null): Promise<Result> {
  const category = await db.categories.get(categoryId);
  if (!category || category.deleted_at) return { error: "That category was removed." };
  if (icon !== null && !isIcon(icon)) return { error: "Pick one of the icons." };
  if (color !== null && !isColor(color)) return { error: "Pick one of the colors." };
  await write([{ table: "categories", row: { ...category, icon, color } }]);
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

export type TrackerInput = {
  id?: string;
  /** Only for a new tracker; a tracker keeps its kind. Default goal. */
  kind?: TrackerKind;
  name: string;
  /** Goals only */
  target: string;
  targetDate: string;
};

export async function saveTracker(input: TrackerInput): Promise<Result & { id?: string }> {
  const existing = input.id ? await db.trackers.get(input.id) : undefined;
  if (input.id && (!existing || existing.deleted_at)) return { error: "That tracker was removed." };
  const kind: TrackerKind = existing ? (existing.kind ?? "goal") : (input.kind ?? "goal");
  if (kind !== "goal" && kind !== "split") return { error: "Pick saving up or settling up." };

  const name = input.name.trim();
  const target = kind === "goal" ? parsePeso(input.target) : null;
  if (!name) return { error: "Give the tracker a name." };
  if (name.length > 60) return { error: "Keep the name to 60 characters or fewer." };
  if (kind === "goal" && target === null) return { error: "Enter a target, like 20000." };
  if (input.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) return { error: "Pick a valid date." };
  const fields = { name, target_amount: target, target_date: input.targetDate || null };

  if (existing) {
    await write([{ table: "trackers", row: { ...existing, ...fields } }]);
    return { id: existing.id };
  }

  const user = await userId();
  const tracker: TrackerRow = {
    ...fields,
    kind,
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
  if ((await db.trackers.get(input.trackerId))?.kind === "split") return { error: "Add a bill or a payback instead." };

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
// Settle-up trackers (v1.0.3). Shares: + they owe you, − you owe them (docs/erd.md).
// ---------------------------------------------------------------------------

/** The id that stands for you in a bill's participants and payer. */
export const ME = "me";

async function splitTracker(trackerId: string) {
  const tracker = await db.trackers.get(trackerId);
  if (!tracker || tracker.deleted_at || tracker.kind !== "split") return null;
  if (tracker.archived_at || !(await myRole(trackerId))) return null;
  return tracker;
}

async function peopleOf(trackerId: string) {
  return live(await db.split_people.where("tracker_id").equals(trackerId).toArray());
}

async function balanceOf(trackerId: string, personId: string) {
  const shares = live(await db.split_shares.where("tracker_id").equals(trackerId).toArray());
  return personBalances(shares).get(personId) ?? 0;
}

export async function addSplitPerson(trackerId: string, name: string): Promise<Result & { id?: string }> {
  name = name.trim();
  if (!(await splitTracker(trackerId))) return { error: "You can't add people to this tracker." };
  if (!name) return { error: "Enter a name." };
  if (name.length > 40) return { error: "Keep the name to 40 characters or fewer." };
  if (sameName(name, "me") || sameName(name, "you")) return { error: "You're already on the list. Use their name." };
  if ((await peopleOf(trackerId)).some((p) => sameName(p.name, name))) return { error: `${name} is already on the list.` };

  const person: SplitPersonRow = {
    id: id(),
    tracker_id: trackerId,
    user_id: await userId(),
    name,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
  };
  await write([{ table: "split_people", row: person }]);
  return { id: person.id };
}

export async function renameSplitPerson(personId: string, name: string): Promise<Result> {
  name = name.trim();
  const person = await db.split_people.get(personId);
  if (!person || person.deleted_at) return { error: "That person was removed." };
  if (!name) return { error: "Enter a name." };
  if (name.length > 40) return { error: "Keep the name to 40 characters or fewer." };
  if ((await peopleOf(person.tracker_id)).some((p) => p.id !== personId && sameName(p.name, name))) {
    return { error: `${name} is already on the list.` };
  }
  await write([{ table: "split_people", row: { ...person, name } }]);
  return {};
}

/** Only once you're square with them; their past bills stay in the history. */
export async function removeSplitPerson(personId: string): Promise<Result> {
  const person = await db.split_people.get(personId);
  if (!person || person.deleted_at) return {};
  const balance = await balanceOf(person.tracker_id, personId);
  if (balance !== 0) return { error: `Settle up with ${person.name} first.` };
  await write([{ table: "split_people", row: { ...person, deleted_at: nowIso() } }]);
  return {};
}

export type SplitBillInput = {
  trackerId: string;
  note: string;
  amount: string;
  occurredOn: string;
  /** The expense category your share counts toward */
  categoryId: string;
  /** ME or a person id */
  paidBy: string;
  /** The account you paid from; only when you paid */
  accountId: string;
  /** Who shares the bill: ME and/or person ids */
  participants: string[];
  mode: "equal" | "exact";
  /** mode "exact": participant id → amount */
  exact?: Record<string, string>;
};

/**
 * Add a bill. You paid: an expense for the full amount, plus a share for everyone else (they owe
 * you). A friend paid: just your share (you owe them), counted in your budget, no account change.
 */
export async function saveSplitBill(input: SplitBillInput): Promise<Result> {
  const tracker = await splitTracker(input.trackerId);
  if (!tracker) return { error: "You can't add bills to this tracker." };
  const amount = parsePeso(input.amount);
  const note = input.note.trim();
  if (amount === null) return { error: "Enter the bill's total, like 1200." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) return { error: "Pick a date." };
  if (!note) return { error: "Say what it was for, like Friday dinner." };
  if (note.length > 200) return { error: "Keep the description to 200 characters or fewer." };
  const category = await db.categories.get(input.categoryId);
  if (!category || category.deleted_at || category.kind !== "expense") return { error: "Pick an expense category." };

  const people = new Set((await peopleOf(tracker.id)).map((p) => p.id));
  const isKnown = (who: string) => who === ME || people.has(who);
  if (!isKnown(input.paidBy)) return { error: "Pick who paid." };
  // You first, so any leftover centavo from an even split is yours, not a friend's
  const participants = [...new Set(input.participants)].filter(isKnown).sort((a, b) => Number(b === ME) - Number(a === ME));
  if (participants.length === 0) return { error: "Pick who's splitting the bill." };

  let shares: number[];
  if (input.mode === "exact") {
    const parsed = participants.map((who) => parseOptionalPeso(input.exact?.[who] ?? ""));
    if (parsed.some((n) => n === null)) return { error: "Check the amounts. Use numbers like 250." };
    shares = parsed as number[];
    const sum = shares.reduce((a, b) => a + b, 0);
    if (sum !== amount) return { error: `The shares add up to ${formatPeso(sum)}, but the bill is ${formatPeso(amount)}.` };
  } else {
    shares = splitEvenly(amount, participants.length);
  }
  const shareOf = new Map(participants.map((who, i) => [who, shares[i]]));

  const user = await userId();
  const base = {
    user_id: user,
    tracker_id: tracker.id,
    occurred_on: input.occurredOn,
    note,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
  };

  if (input.paidBy === ME) {
    if (!input.accountId) return { error: "Pick the account you paid from." };
    const owing = participants.filter((who) => who !== ME && shareOf.get(who)! > 0);
    if (owing.length === 0) return { error: "Nobody else is in this bill. Add it as a normal expense instead." };

    const expense: TransactionRow = {
      ...base,
      id: id(),
      type: "expense",
      amount,
      account_id: input.accountId,
      to_account_id: null,
      category_id: category.id,
      source: "manual",
    };
    await write([
      { table: "transactions", row: expense },
      ...owing.map((who): Change => ({
        table: "split_shares",
        row: { ...base, id: id(), person_id: who, transaction_id: expense.id, category_id: null, amount: shareOf.get(who)! },
      })),
    ]);
    return {};
  }

  const mine = shareOf.get(ME) ?? 0;
  if (mine === 0) return { error: "You're not part of this bill, so there's nothing for you to pay back." };
  const share: SplitShareRow = { ...base, id: id(), person_id: input.paidBy, transaction_id: null, category_id: category.id, amount: -mine };
  await write([{ table: "split_shares", row: share }]);
  return {};
}

/** Remove a bill or payback: its transaction (if any) and all its shares. `entryId` is either. */
export async function deleteSplitEntry(entryId: string): Promise<Result> {
  if (await db.transactions.get(entryId)) return deleteTransaction(entryId);
  const share = await db.split_shares.get(entryId);
  if (!share || share.deleted_at) return {};
  await write([{ table: "split_shares", row: { ...share, deleted_at: nowIso() } }]);
  return {};
}

export type SettleInput = {
  trackerId: string;
  personId: string;
  amount: string;
  accountId: string;
  occurredOn: string;
};

/** Record a payback. Which way the money goes follows who owes whom; never more than what's owed. */
export async function settleUp(input: SettleInput): Promise<Result> {
  const tracker = await splitTracker(input.trackerId);
  if (!tracker) return { error: "You can't settle up on this tracker." };
  const person = await db.split_people.get(input.personId);
  if (!person || person.deleted_at || person.tracker_id !== tracker.id) return { error: "Pick who you're settling with." };
  const amount = parsePeso(input.amount);
  if (amount === null) return { error: "Enter an amount, like 250." };
  if (!input.accountId) return { error: "Pick an account." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) return { error: "Pick a date." };

  const balance = await balanceOf(tracker.id, person.id);
  if (balance === 0) return { error: `You and ${person.name} are already square.` };
  const owed = Math.abs(balance);
  if (amount > owed) {
    return { error: `That's more than the ${formatPeso(owed)} ${balance > 0 ? `${person.name} owes you` : `you owe ${person.name}`}.` };
  }

  const theyPay = balance > 0;
  const note = theyPay ? `${person.name} paid you back` : `You paid ${person.name} back`;
  const base = {
    user_id: await userId(),
    tracker_id: tracker.id,
    occurred_on: input.occurredOn,
    note,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
  };
  const payback: TransactionRow = {
    ...base,
    id: id(),
    type: theyPay ? "settle_in" : "settle_out",
    amount,
    account_id: input.accountId,
    to_account_id: null,
    category_id: null,
    source: "manual",
  };
  const share: SplitShareRow = {
    ...base,
    id: id(),
    person_id: person.id,
    transaction_id: payback.id,
    category_id: null,
    amount: theyPay ? -amount : amount,
  };
  await write([
    { table: "transactions", row: payback },
    { table: "split_shares", row: share },
  ]);
  return {};
}

export type EditPaybackInput = {
  /** The payback's transaction */
  id: string;
  amount: string;
  accountId: string;
  occurredOn: string;
};

/** Change a payback's amount, account or date. Like settleUp, never more than was owed before it. */
export async function editPayback(input: EditPaybackInput): Promise<Result> {
  const payback = await db.transactions.get(input.id);
  if (!payback || payback.deleted_at || (payback.type !== "settle_in" && payback.type !== "settle_out")) {
    return { error: "That payback was removed." };
  }
  const tracker = await splitTracker(payback.tracker_id ?? "");
  if (!tracker) return { error: "You can't change paybacks on this tracker." };
  const share = live(await db.split_shares.where("tracker_id").equals(tracker.id).toArray()).find(
    (s) => s.transaction_id === payback.id,
  );
  const person = share && (await db.split_people.get(share.person_id));
  if (!share || !person) return { error: "That payback was removed." };

  const amount = parsePeso(input.amount);
  if (amount === null) return { error: "Enter an amount, like 250." };
  if (!input.accountId) return { error: "Pick an account." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) return { error: "Pick a date." };

  // What was owed with this payback left out
  const theyPay = payback.type === "settle_in";
  const owed = Math.abs((await balanceOf(tracker.id, person.id)) - share.amount);
  if (amount > owed) {
    return { error: `That's more than the ${formatPeso(owed)} ${theyPay ? `${person.name} owed you` : `you owed ${person.name}`}.` };
  }

  await write([
    { table: "transactions", row: { ...payback, amount, account_id: input.accountId, occurred_on: input.occurredOn } },
    { table: "split_shares", row: { ...share, amount: theyPay ? -amount : amount, occurred_on: input.occurredOn } },
  ]);
  return {};
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
  if (type === "contribution" && (await db.trackers.get(input.trackerId))?.kind === "split") {
    return { error: "Presets can only add to saving trackers." };
  }
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
// Monthly bills (v1.0.4)
// ---------------------------------------------------------------------------

export type BillInput = {
  id?: string;
  name: string;
  amount: string;
  categoryId: string;
  /** "" = pick when paying */
  accountId: string;
  dueDay: number;
  /** First month it's due ("2026-11-01") */
  startsOn: string;
  /** "" = every month until ended; otherwise the number of payments (installments) */
  payments: string;
};

export async function saveBill(input: BillInput): Promise<Result> {
  const name = input.name.trim();
  const amount = parsePeso(input.amount);
  if (!name) return { error: "Give the bill a name." };
  if (name.length > 40) return { error: "Keep the name to 40 characters or fewer." };
  if (amount === null) return { error: "Enter an amount, like 1500." };
  const category = await db.categories.get(input.categoryId);
  if (!category || category.deleted_at || category.kind !== "expense") return { error: "Pick a category." };
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) return { error: "Pick the day it's due." };
  if (!/^\d{4}-\d{2}-01$/.test(input.startsOn)) return { error: "Pick the first month it's due." };
  const payments = input.payments.trim() === "" ? null : Number(input.payments);
  if (payments !== null && (!Number.isInteger(payments) || payments < 1 || payments > 360)) {
    return { error: "Enter how many payments, like 6, or leave it blank." };
  }

  const fields = {
    name,
    amount,
    category_id: category.id,
    account_id: input.accountId || null,
    due_day: input.dueDay,
    starts_on: input.startsOn,
    ends_on: payments === null ? null : endAfterPayments(input.startsOn, payments),
  };

  if (input.id) {
    const existing = await db.bills.get(input.id);
    if (!existing || existing.deleted_at) return { error: "That bill was removed." };
    await write([{ table: "bills", row: { ...existing, ...fields } }]);
  } else {
    const row: BillRow = {
      ...fields,
      id: id(),
      user_id: await userId(),
      archived_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
    };
    await write([{ table: "bills", row }]);
  }
  return {};
}

/** Stop a bill (no more reminders); past payments stay. Restoring brings it back. */
export async function setBillEnded(billId: string, ended: boolean): Promise<Result> {
  const bill = await db.bills.get(billId);
  if (!bill || bill.deleted_at) return { error: "That bill was removed." };
  await write([{ table: "bills", row: { ...bill, archived_at: ended ? nowIso() : null } }]);
  return {};
}

/** The month's payment row, even a removed one: (bill, month) is unique on the server, so it's reused. */
async function paymentRowFor(billId: string, month: DateString) {
  return (await db.bill_payments.where("bill_id").equals(billId).toArray()).find((p) => p.month === month);
}

/**
 * One-tap confirm: logs the bill as an expense and marks that month paid. Dated on the due date
 * (or today, when paying ahead), so an on-time bill confirmed late still lands on the right day.
 */
export async function payBill(
  billId: string,
  month: DateString,
  options: { amount?: string; accountId?: string } = {},
): Promise<Result> {
  const bill = await db.bills.get(billId);
  if (!bill || bill.deleted_at) return { error: "That bill was removed." };
  const existing = await paymentRowFor(billId, month);
  if (existing && !existing.deleted_at) return { error: "That bill is already settled for this month." };

  const amount = options.amount === undefined ? bill.amount : parsePeso(options.amount);
  if (amount === null) return { error: "Enter an amount, like 1500." };
  const accounts = live(await db.accounts.toArray()).filter((a) => !a.archived_at);
  const accountId = options.accountId || (accounts.some((a) => a.id === bill.account_id) ? bill.account_id : accounts[0]?.id);
  if (!accountId) return { error: "Add an account first." };

  const dueOn = dueDateIn(bill.due_day, month);
  const now = today();
  const user = await userId();
  const expense: TransactionRow = {
    id: id(),
    user_id: user,
    type: "expense",
    amount,
    account_id: accountId,
    to_account_id: null,
    category_id: bill.category_id,
    tracker_id: null,
    occurred_on: dueOn <= now ? dueOn : now,
    note: bill.name,
    source: "manual",
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
  };
  const payment: BillPaymentRow = {
    ...(existing ?? { id: id(), created_at: nowIso() }),
    user_id: user,
    bill_id: billId,
    month,
    transaction_id: expense.id,
    updated_at: nowIso(),
    deleted_at: null,
  };
  // Expense first: the payment points at it
  await write([
    { table: "transactions", row: expense },
    { table: "bill_payments", row: payment },
  ]);
  return {};
}

/** Not paying it this month (paid elsewhere, waived): stops the reminder without logging anything. */
export async function skipBill(billId: string, month: DateString): Promise<Result> {
  const bill = await db.bills.get(billId);
  if (!bill || bill.deleted_at) return { error: "That bill was removed." };
  const existing = await paymentRowFor(billId, month);
  if (existing && !existing.deleted_at) return { error: "That bill is already settled for this month." };
  const row: BillPaymentRow = {
    ...(existing ?? { id: id(), created_at: nowIso() }),
    user_id: await userId(),
    bill_id: billId,
    month,
    transaction_id: null,
    updated_at: nowIso(),
    deleted_at: null,
  };
  await write([{ table: "bill_payments", row }]);
  return {};
}

/** Undo paid or skipped: the bill is due again, and a logged expense is removed with it. */
export async function undoBillPayment(paymentId: string): Promise<Result> {
  const payment = await db.bill_payments.get(paymentId);
  if (!payment || payment.deleted_at) return {};
  const changes: Change[] = [{ table: "bill_payments", row: { ...payment, deleted_at: nowIso() } }];
  const expense = payment.transaction_id ? await db.transactions.get(payment.transaction_id) : undefined;
  if (expense && !expense.deleted_at) changes.unshift({ table: "transactions", row: { ...expense, deleted_at: nowIso() } });
  await write(changes);
  return {};
}

// ---------------------------------------------------------------------------
// Import from Tarsi (Settings → Import)
// ---------------------------------------------------------------------------

/** What "Replace" removes, for the confirm dialog. */
export async function replaceImpact() {
  const [accounts, transactions, shares] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.split_shares.toArray(),
  ]);
  return { accounts: live(accounts).length, entries: live(transactions).length, splitShares: live(shares).length };
}

/**
 * Replace this account's money with a Tarsi backup: every account, entry and settle-up share is
 * removed (soft delete, so other devices follow), then Tarsi's accounts and entries are added with
 * opening balances that make each balance match Tarsi. Categories, budgets, presets and trackers stay.
 * Names are unique per user even after a delete, so same-named accounts and categories are reused.
 */
export async function importTarsi(plan: ImportPlan): Promise<Result & { added?: number }> {
  if (plan.accounts.length === 0) return { error: "There are no accounts in this backup." };
  const user = await userId();
  const stamp = nowIso();
  const changes: Change[] = [];

  // 1. Clear what's here (bills stay, but their paid and skipped months go with the entries)
  for (const p of live(await db.bill_payments.toArray())) {
    changes.push({ table: "bill_payments", row: { ...p, deleted_at: stamp } });
  }
  for (const share of live(await db.split_shares.toArray())) {
    changes.push({ table: "split_shares", row: { ...share, deleted_at: stamp } });
  }
  for (const t of live(await db.transactions.toArray())) {
    changes.push({ table: "transactions", row: { ...t, deleted_at: stamp } });
  }

  // 2. Categories the entries need: reuse by name (even archived or deleted), else create
  const allCategories = await db.categories.toArray();
  const categoryIds = new Map<string, string>();
  const ensureCategory = (name: string, kind: CategoryKind) => {
    const key = `${kind}:${name.toLowerCase()}`;
    if (categoryIds.has(key)) return categoryIds.get(key)!;
    const existing = allCategories.find((c) => c.kind === kind && sameName(c.name, name));
    if (existing) {
      if (existing.deleted_at || existing.archived_at) {
        changes.push({ table: "categories", row: { ...existing, deleted_at: null, archived_at: null } });
      }
      categoryIds.set(key, existing.id);
    } else {
      const created = newCategory(user, name, kind);
      changes.push({ table: "categories", row: created });
      categoryIds.set(key, created.id);
    }
    return categoryIds.get(key)!;
  };
  const openingId = ensureCategory(OPENING_BALANCE, "income");
  for (const c of plan.categories) ensureCategory(c.name, c.kind);

  // 3. Accounts: Tarsi's, reusing same-named ones; any others are removed
  const allAccounts = await db.accounts.toArray();
  const accountIds = new Map<string, string>();
  const kept = new Set<string>();
  for (const a of plan.accounts) {
    const existing = allAccounts.find((row) => sameName(row.name, a.name));
    const row: AccountRow = {
      ...(existing ?? newAccount(user, a.name, a.kind)),
      name: a.name,
      kind: a.kind,
      archived_at: a.archived ? stamp : null,
      deleted_at: null,
    };
    if (a.createdAt && !existing) row.created_at = a.createdAt;
    changes.push({ table: "accounts", row });
    accountIds.set(a.id, row.id);
    kept.add(row.id);
  }
  for (const row of live(allAccounts)) {
    if (!kept.has(row.id)) changes.push({ table: "accounts", row: { ...row, deleted_at: stamp } });
  }

  // 4. Opening balances, then every entry (sent after their accounts and categories)
  const entry = (fields: Pick<TransactionRow, "type" | "amount" | "account_id" | "category_id" | "occurred_on" | "note"> & { created_at?: string | null }): Change => ({
    table: "transactions",
    row: {
      id: id(),
      user_id: user,
      to_account_id: null,
      tracker_id: null,
      source: "manual",
      updated_at: stamp,
      deleted_at: null,
      ...fields,
      created_at: fields.created_at ?? stamp,
    },
  });
  for (const a of plan.accounts) {
    if (a.opening <= 0) continue;
    changes.push(
      entry({
        type: "income",
        amount: a.opening,
        account_id: accountIds.get(a.id)!,
        category_id: openingId,
        occurred_on: a.openingDate,
        note: `Starting balance of ${a.name}`,
        created_at: a.createdAt,
      }),
    );
  }
  for (const e of plan.entries) {
    changes.push(
      entry({
        type: e.type,
        amount: e.amount,
        account_id: accountIds.get(e.accountId)!,
        category_id: ensureCategory(e.categoryName, e.type),
        occurred_on: e.date,
        note: e.note,
        created_at: e.createdAt,
      }),
    );
  }

  await write(changes);
  return { added: plan.entries.length };
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
