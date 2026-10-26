// The real mutations against an in-memory IndexedDB. Sync is stubbed: these check what lands on
// the device and what gets queued for Supabase (and in what order), not the network.
import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalData, db, setMeta, type CategoryRow, type SyncedTable } from "./db";
import {
  completeSetup,
  ensureMonthBudget,
  leaveTracker,
  logPreset,
  removeMember,
  saveBudget,
  savePreset,
  saveTracker,
  saveTrackerEntry,
  saveTransaction,
  setCategoryStyle,
  setPresetArchived,
} from "./mutations";

vi.mock("./sync", () => ({ scheduleSync: vi.fn() }));

const ME = "user-me";
const FRIEND = "user-friend";

// Noon in Manila on Oct 25, 2026. Only Date is faked; Dexie still gets real timers.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-10-25T04:00:00Z"));
afterAll(() => vi.useRealTimers());

const category = (id: string, name: string, kind: "income" | "expense" = "expense"): CategoryRow => ({
  id,
  user_id: ME,
  name,
  kind,
  archived_at: null,
  updated_at: "2026-10-01T00:00:00Z",
  deleted_at: null,
});

beforeEach(async () => {
  await clearLocalData();
  await setMeta("owner", { userId: ME, email: "me@example.com" });
  await db.categories.bulkPut([category("food", "Food"), category("fare", "Transportation"), category("salary", "Salary", "income")]);
  await db.accounts.put({
    id: "cash",
    user_id: ME,
    name: "Wallet",
    kind: "cash",
    archived_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
  });
});

/** Tables of the queued changes, oldest first: the order they reach Supabase. */
async function queued() {
  return (await db.outbox.orderBy("seq").toArray()).map((e) => e.table as SyncedTable);
}

async function liveItems(budgetId: string) {
  return (await db.budget_items.where("budget_id").equals(budgetId).toArray()).filter((i) => !i.deleted_at);
}

describe("saveBudget", () => {
  const base = { month: "2026-10-01", totalLimit: "", alsoTemplate: false };

  it("saves the month's limits and queues budget before items", async () => {
    const result = await saveBudget({ ...base, limits: [{ categoryId: "food", amount: "5000" }, { categoryId: "fare", amount: "" }] });
    expect(result).toEqual({});

    const [budget] = await db.budgets.toArray();
    expect(budget).toMatchObject({ month: "2026-10-01", total_limit: null });
    const items = await liveItems(budget.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ category_id: "food", limit_amount: 500000 });
    expect(await queued()).toEqual(["budgets", "budget_items"]);
  });

  it("stores a custom overall limit, and clears it when blanked", async () => {
    await saveBudget({ ...base, limits: [], totalLimit: "20,000" });
    expect((await db.budgets.toArray())[0].total_limit).toBe(2000000);

    await saveBudget({ ...base, limits: [], totalLimit: "" });
    expect((await db.budgets.toArray())[0].total_limit).toBeNull();
  });

  it("removes a limit that's blanked (soft delete, so other devices hear about it)", async () => {
    await saveBudget({ ...base, limits: [{ categoryId: "food", amount: "5000" }] });
    await saveBudget({ ...base, limits: [{ categoryId: "food", amount: "" }] });
    const all = await db.budget_items.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].deleted_at).not.toBeNull();
  });

  it("writes the template too when asked, and new months copy it, overall limit included", async () => {
    await saveBudget({ ...base, alsoTemplate: true, totalLimit: "15000", limits: [{ categoryId: "food", amount: "4000" }] });
    const template = (await db.budgets.toArray()).find((b) => b.month === null)!;
    expect(template.total_limit).toBe(1500000);

    await ensureMonthBudget("2026-11-01");
    const november = (await db.budgets.toArray()).find((b) => b.month === "2026-11-01")!;
    expect(november.total_limit).toBe(1500000);
    expect((await liveItems(november.id)).map((i) => i.limit_amount)).toEqual([400000]);
  });

  it("can edit a past month without touching the template", async () => {
    await saveBudget({ month: "2026-08-01", totalLimit: "", alsoTemplate: false, limits: [{ categoryId: "food", amount: "100" }] });
    const months = (await db.budgets.toArray()).map((b) => b.month);
    expect(months).toEqual(["2026-08-01"]);
  });

  it("rejects bad numbers without writing anything", async () => {
    expect((await saveBudget({ ...base, limits: [{ categoryId: "food", amount: "abc" }] })).error).toMatch(/Check the limits/);
    expect((await saveBudget({ ...base, limits: [], totalLimit: "-5" })).error).toMatch(/overall limit/);
    expect(await db.budgets.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });
});

describe("saveBudget with custom limits", () => {
  const base = { month: "2026-10-01", totalLimit: "", alsoTemplate: false, limits: [] };

  it("creates the category and its limit, category queued first", async () => {
    const result = await saveBudget({ ...base, newCategories: [{ name: " Milk tea ", amount: "1500" }] });
    expect(result).toEqual({});

    const created = (await db.categories.toArray()).find((c) => c.name === "Milk tea")!;
    expect(created).toMatchObject({ kind: "expense", user_id: ME, archived_at: null });
    const [budget] = await db.budgets.toArray();
    expect((await liveItems(budget.id))[0]).toMatchObject({ category_id: created.id, limit_amount: 150000 });
    expect(await queued()).toEqual(["categories", "budgets", "budget_items"]);
  });

  it("skips rows left completely empty", async () => {
    await saveBudget({ ...base, newCategories: [{ name: "", amount: "" }] });
    expect(await db.categories.count()).toBe(3);
  });

  it.each([
    [{ name: "", amount: "100" }, /Give each custom limit a name/],
    [{ name: "Milk tea", amount: "" }, /Give "Milk tea" a limit/],
    [{ name: "food", amount: "100" }, /already have a "food" category/],
    [{ name: "Opening balance", amount: "100" }, /reserved/],
    [{ name: "x".repeat(41), amount: "100" }, /40 characters/],
  ])("rejects %j", async (draft, error) => {
    const result = await saveBudget({ ...base, newCategories: [draft] });
    expect(result.error).toMatch(error);
    expect(await db.outbox.count()).toBe(0);
  });

  it("catches two new rows with the same name", async () => {
    const result = await saveBudget({
      ...base,
      newCategories: [
        { name: "Coffee", amount: "100" },
        { name: "coffee", amount: "200" },
      ],
    });
    expect(result.error).toMatch(/already have a "coffee" category/);
    expect(await db.categories.count()).toBe(3);
  });
});

describe("saveTransaction", () => {
  const input = { type: "expense", amount: "250", accountId: "cash", toAccountId: "", categoryId: "food", occurredOn: "2026-10-25", note: "" };

  it("saves a manual entry by default and a scanned one when told", async () => {
    await saveTransaction(input);
    await saveTransaction({ ...input, source: "scan" });
    const sources = (await db.transactions.toArray()).map((t) => t.source).sort();
    expect(sources).toEqual(["manual", "scan"]);
  });

  it("checks the category matches the type", async () => {
    expect((await saveTransaction({ ...input, type: "income" })).error).toMatch(/income category/);
  });

  it("needs two different accounts for a transfer", async () => {
    expect((await saveTransaction({ ...input, type: "transfer", toAccountId: "cash" })).error).toMatch(/two different/);
  });
});

describe("trackers", () => {
  async function newTracker() {
    const { id } = await saveTracker({ name: "Baguio trip", target: "20000", targetDate: "" });
    return id!;
  }
  const add = (trackerId: string, amount: string, type: "contribution" | "withdrawal" = "contribution") =>
    saveTrackerEntry({ trackerId, type, amount, accountId: "cash", occurredOn: "2026-10-25", note: "" });

  it("creates the tracker and an owner membership that isn't sent (the server's trigger makes it)", async () => {
    const id = await newTracker();
    expect(await db.trackers.get(id)).toMatchObject({ name: "Baguio trip", target_amount: 2000000, created_by: ME });
    expect(await db.tracker_members.get([id, ME])).toMatchObject({ role: "owner" });
    expect(await queued()).toEqual(["trackers"]);
  });

  it("lets you withdraw only what you put in", async () => {
    const id = await newTracker();
    await add(id, "500");
    expect((await add(id, "600", "withdrawal")).error).toMatch(/up to ₱500.00/);
    expect(await add(id, "500", "withdrawal")).toEqual({});
  });

  it("refuses entries on trackers you're not in", async () => {
    expect((await add("someone-elses", "100")).error).toMatch(/not a member/);
  });

  it("on leaving, withdraws your share first, then the membership change", async () => {
    await db.trackers.put({
      id: "shared",
      name: "Phone",
      target_amount: 100000,
      target_date: null,
      created_by: FRIEND,
      archived_at: null,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      deleted_at: null,
    });
    await db.tracker_members.put({ tracker_id: "shared", user_id: ME, role: "editor", joined_at: "", updated_at: "", deleted_at: null });
    await add("shared", "300");
    await db.outbox.clear();

    expect(await leaveTracker("shared")).toEqual({});
    expect(await queued()).toEqual(["transactions", "tracker_members"]);
    const withdrawal = (await db.transactions.toArray()).find((t) => t.type === "withdrawal")!;
    expect(withdrawal).toMatchObject({ amount: 30000, tracker_id: "shared", occurred_on: "2026-10-25" });
    expect((await db.tracker_members.get(["shared", ME]))!.deleted_at).not.toBeNull();
  });

  it("doesn't let the owner leave, or editors remove people", async () => {
    const id = await newTracker();
    expect((await leaveTracker(id)).error).toMatch(/owner can't leave/);

    await db.tracker_members.put({ tracker_id: id, user_id: ME, role: "editor", joined_at: "", updated_at: "", deleted_at: null });
    expect((await removeMember(id, FRIEND)).error).toMatch(/Only the owner/);
  });
});

describe("presets", () => {
  it("logs a preset for today with its own source, at a changed amount", async () => {
    await savePreset({ name: "Jeep fare", type: "expense", amount: "13", accountId: "", categoryId: "fare", trackerId: "" });
    const [preset] = await db.presets.toArray();

    expect(await logPreset(preset.id, "15", "cash")).toEqual({});
    const [entry] = await db.transactions.toArray();
    expect(entry).toMatchObject({ type: "expense", amount: 1500, category_id: "fare", source: "preset", note: "Jeep fare", occurred_on: "2026-10-25" });
  });

  it("sends a tracker preset to the tracker", async () => {
    const { id } = await saveTracker({ name: "Trip", target: "1000", targetDate: "" });
    await savePreset({ name: "Weekly save", type: "contribution", amount: "200", accountId: "cash", categoryId: "", trackerId: id! });
    const [preset] = await db.presets.toArray();
    expect(preset).toMatchObject({ tracker_id: id, category_id: null, account_id: "cash" });

    await logPreset(preset.id, "200", "cash");
    expect((await db.transactions.toArray())[0]).toMatchObject({ type: "contribution", tracker_id: id, source: "preset" });
  });

  it("archives and restores", async () => {
    await savePreset({ name: "Coffee", type: "expense", amount: "120", accountId: "", categoryId: "food", trackerId: "" });
    const [preset] = await db.presets.toArray();
    await setPresetArchived(preset.id, true);
    expect((await db.presets.get(preset.id))!.archived_at).not.toBeNull();
    await setPresetArchived(preset.id, false);
    expect((await db.presets.get(preset.id))!.archived_at).toBeNull();
  });

  it("needs a category for expenses and a tracker for contributions", async () => {
    const base = { name: "X", amount: "1", accountId: "" };
    expect((await savePreset({ ...base, type: "expense", categoryId: "", trackerId: "" })).error).toMatch(/category/);
    expect((await savePreset({ ...base, type: "contribution", categoryId: "", trackerId: "" })).error).toMatch(/tracker/);
  });
});

describe("completeSetup (v1.0.1 budget choice)", () => {
  const accounts = [{ name: "GCash", kind: "ewallet" as const, balance: "1000" }];

  it("saves one total budget with no category limits", async () => {
    expect(await completeSetup({ accounts, limits: [{ categoryId: "food", amount: "5000" }], totalLimit: "20000" })).toEqual({});
    const [template] = await db.budgets.toArray();
    expect(template).toMatchObject({ month: null, total_limit: 2000000 });
    expect(await liveItems(template.id)).toEqual([]);
  });

  it("saves per-category limits when no total is given", async () => {
    await completeSetup({ accounts, limits: [{ categoryId: "food", amount: "5000" }], totalLimit: "" });
    const [template] = await db.budgets.toArray();
    expect(template.total_limit).toBeNull();
    expect((await liveItems(template.id)).map((i) => i.limit_amount)).toEqual([500000]);
  });

  it("switching to a total drops the template's category limits", async () => {
    await completeSetup({ accounts, limits: [{ categoryId: "food", amount: "5000" }], totalLimit: "" });
    await completeSetup({ accounts: [{ ...accounts[0], name: "Cash" }], limits: [], totalLimit: "20000" });
    const [template] = await db.budgets.toArray();
    expect(template.total_limit).toBe(2000000);
    expect(await liveItems(template.id)).toEqual([]);
  });

  it("switching to category limits clears the template's total", async () => {
    await completeSetup({ accounts, limits: [], totalLimit: "20000" });
    await completeSetup({ accounts: [{ ...accounts[0], name: "Cash" }], limits: [{ categoryId: "food", amount: "5000" }], totalLimit: "" });
    const [template] = await db.budgets.toArray();
    expect(template.total_limit).toBeNull();
    expect((await liveItems(template.id)).map((i) => i.limit_amount)).toEqual([500000]);
  });

  it("rejects a bad total", async () => {
    expect((await completeSetup({ accounts, limits: [], totalLimit: "lots" })).error).toMatch(/monthly budget/);
  });
});

describe("setCategoryStyle", () => {
  it("saves a picked icon and color, and clears them back to automatic", async () => {
    expect(await setCategoryStyle("food", "coffee", "aqua")).toEqual({});
    expect(await db.categories.get("food")).toMatchObject({ icon: "coffee", color: "aqua" });
    expect(await queued()).toEqual(["categories"]);

    await setCategoryStyle("food", null, null);
    expect(await db.categories.get("food")).toMatchObject({ icon: null, color: null });
  });

  it("refuses icons and colors that don't exist", async () => {
    expect((await setCategoryStyle("food", "rocket", null)).error).toMatch(/icons/);
    expect((await setCategoryStyle("food", null, "teal")).error).toMatch(/colors/);
    expect(await db.outbox.count()).toBe(0);
  });
});
