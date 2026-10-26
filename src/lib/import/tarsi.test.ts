// Made-up data in Tarsi's backup shape (the real export has ~280 columns; only the ones read here matter).
import { describe, expect, it } from "vitest";
import { categoryNameFor, parseCsv, planTarsiImport, readTarsiBackup, TarsiFormatError } from "./tarsi";

const HEADER =
  "recordType,exportedAt,id,name,icon,amount,balance,bankAccountTemplateId,archivedAt,category,tagId,note,notes,date,createdAt,accountId,planned";

const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

const BACKUP = csv(
  "metadata,2026-10-26T14:00:00.000Z,,,,,,,,,,,,,,,",
  "account,,acc-wallet,GCash,phone-portrait-outline,,300,gcash,,,,,,,2026-10-01T02:00:00.000Z,,",
  "account,,acc-bank,BPI,business-outline,,1000.50,bpi,,,,,,,2026-10-01T03:00:00.000Z,,",
  'expense,,e1,,,120,,,,food,,"Lunch, with ""friends""",,2026-10-02,2026-10-02T04:00:00.000Z,acc-wallet,false',
  "expense,,e2,,,80.25,,,,transport,,,,2026-10-03,2026-10-03T04:00:00.000Z,acc-wallet,false",
  "expense,,e3,,,99.75,,,,bills,,Load,,2026-10-04,2026-10-04T04:00:00.000Z,acc-bank,false",
  "income,,i1,,,500,,,,,allowance,Allowance,,2026-10-05,2026-10-05T04:00:00.000Z,acc-wallet,false",
  "income,,i2,,,1100.25,,,,,,,,2026-10-06,2026-10-06T04:00:00.000Z,acc-bank,false",
  "expense,,e4,,,999,,,,food,,Someday,,2026-11-01,2026-10-06T04:00:00.000Z,acc-wallet,true",
  "goal,,g1,Laptop,,,,,,,,,,,,,",
  "transfer,,t1,,,50,,,,,,,,2026-10-07,,acc-bank,",
);

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, CRLF and blank lines", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n\r\n1,\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["1", ""],
    ]);
  });

  it("keeps newlines inside quoted fields", () => {
    expect(parseCsv('note\n"line 1\nline 2"')).toEqual([["note"], ["line 1\nline 2"]]);
  });
});

describe("readTarsiBackup", () => {
  const backup = readTarsiBackup(BACKUP);

  it("reads accounts with their kind and balance", () => {
    expect(backup.accounts).toEqual([
      expect.objectContaining({ id: "acc-wallet", name: "GCash", kind: "ewallet", balance: 30000, archived: false }),
      expect.objectContaining({ id: "acc-bank", name: "BPI", kind: "bank", balance: 100050 }),
    ]);
  });

  it("reads expenses by category and income by tag, in centavos", () => {
    expect(backup.entries.map((e) => [e.id, e.type, e.amount, e.category])).toEqual([
      ["e1", "expense", 12000, "food"],
      ["e2", "expense", 8025, "transport"],
      ["e3", "expense", 9975, "bills"],
      ["i1", "income", 50000, "allowance"],
      ["i2", "income", 110025, ""],
    ]);
    expect(backup.entries[0].note).toBe('Lunch, with "friends"');
    expect(backup.entries[1].note).toBeNull();
  });

  it("skips planned entries and record types it doesn't import, and says so", () => {
    expect(backup.skipped).toEqual({ "planned expense": 1, goal: 1, transfer: 1 });
    expect(backup.exportedAt).toBe("2026-10-26T14:00:00.000Z");
  });

  it("rejects files that aren't Tarsi backups", () => {
    expect(() => readTarsiBackup("date,amount\n2026-10-01,100")).toThrow(TarsiFormatError);
  });

  it("ignores a byte-order mark", () => {
    expect(readTarsiBackup(`﻿${BACKUP}`).accounts).toHaveLength(2);
  });
});

describe("planTarsiImport", () => {
  const plan = planTarsiImport(readTarsiBackup(BACKUP));

  it("adds an opening balance so each account ends on Tarsi's balance", () => {
    const [wallet, bank] = plan.accounts;
    // GCash: 300 = opening + 500 − 120 − 80.25 → opening 0.25
    expect(wallet).toMatchObject({ opening: 25, openingDate: "2026-10-01" });
    // BPI: 1000.50 = opening + 1100.25 − 99.75 → opening 0
    expect(bank.opening).toBe(0);
  });

  it("dates the opening balance on the day the account was made, in Manila", () => {
    const late = planTarsiImport(
      readTarsiBackup(csv("account,,a,Cash,wallet-outline,,100,,,,,,,,2026-10-01T17:00:00.000Z,,")),
    );
    expect(late.accounts[0]).toMatchObject({ kind: "cash", opening: 10000, openingDate: "2026-10-02" });
  });

  it("maps Tarsi categories onto Kalupi's and keeps the rest by name", () => {
    expect(categoryNameFor("food", "expense")).toBe("Food & Dining");
    expect(categoryNameFor("side-hustle", "income")).toBe("Side Hustle");
    expect(categoryNameFor("", "income")).toBe("Other");
    expect(plan.categories).toEqual(
      expect.arrayContaining([
        { name: "Food & Dining", kind: "expense" },
        { name: "Transportation", kind: "expense" },
        { name: "Bills", kind: "expense" },
        { name: "Allowance", kind: "income" },
        { name: "Other", kind: "income" },
      ]),
    );
  });

  it("totals and dates the history, oldest first", () => {
    expect(plan.totals).toEqual({ income: 160025, expense: 30000, first: "2026-10-02", last: "2026-10-06" });
    expect(plan.entries.map((e) => e.id)).toEqual(["e1", "e2", "e3", "i1", "i2"]);
  });

  it("warns when the entries can't add up to the balance", () => {
    const short = planTarsiImport(
      readTarsiBackup(csv("account,,a,GCash,,,10,,,,,,,,,,", "expense,,x,,,5,,,,food,,,,2026-10-02,,a,false", "income,,y,,,100,,,,,,,,2026-10-01,,a,false")),
    );
    expect(short.accounts[0].opening).toBe(0);
    expect(short.warnings[0]).toMatch(/GCash will show ₱85.00 more than its ₱10.00 balance/);
  });

  it("drops entries whose account isn't in the backup", () => {
    const orphan = planTarsiImport(readTarsiBackup(csv("account,,a,GCash,,,0,,,,,,,,,,", "expense,,x,,,5,,,,food,,,,2026-10-02,,missing,false")));
    expect(orphan.entries).toEqual([]);
    expect(orphan.warnings[0]).toMatch(/isn't in the backup/);
  });
});
