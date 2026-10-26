import { describe, expect, it } from "vitest";
import { daysUntil, monthlyNeeded, myNet, trackerMembers, type ProgressRow } from "./trackers";

const entry = (type: "contribution" | "withdrawal", amount: number, tracker_id = "trip") => ({ type, amount, tracker_id });

describe("myNet", () => {
  it("is contributions minus withdrawals on that tracker only", () => {
    expect(myNet("trip", [entry("contribution", 500), entry("withdrawal", 200), entry("contribution", 999, "phone")])).toBe(300);
  });
});

describe("trackerMembers", () => {
  const members = [
    { tracker_id: "trip", user_id: "me", role: "owner" as const },
    { tracker_id: "trip", user_id: "ana", role: "editor" as const },
  ];
  const progress: ProgressRow[] = [
    { tracker_id: "trip", user_id: "me", display_name: "Isaac", role: "owner", net_amount: 100 },
    { tracker_id: "trip", user_id: "ana", display_name: "Ana", role: "editor", net_amount: 700 },
    { tracker_id: "trip", user_id: "ben", display_name: "Ben", role: null, net_amount: 50 }, // left, still counts
    { tracker_id: "phone", user_id: "me", display_name: "Isaac", role: "owner", net_amount: 9999 },
  ];

  it("uses local entries for you (fresher than the cached server total)", () => {
    const { members: people, total } = trackerMembers("trip", "me", members, progress, [entry("contribution", 400)]);
    const me = people.find((m) => m.isMe)!;
    expect(me).toMatchObject({ name: "You", net: 400, role: "owner" });
    expect(total).toBe(400 + 700 + 50);
  });

  it("lists you first, then biggest contributor, including former members with money in", () => {
    const { members: people } = trackerMembers("trip", "me", members, progress, []);
    expect(people.map((m) => m.userId)).toEqual(["me", "ana", "ben"]);
    expect(people[2].role).toBeNull();
  });

  it("drops former members who have nothing in it", () => {
    const left: ProgressRow = { tracker_id: "trip", user_id: "zed", display_name: "Zed", role: null, net_amount: 0 };
    const { members: people } = trackerMembers("trip", "me", members, [...progress, left], []);
    expect(people.some((m) => m.userId === "zed")).toBe(false);
  });

  it("works offline before any server totals were cached", () => {
    const { members: people, total } = trackerMembers("trip", "me", members, [], [entry("contribution", 250)]);
    expect(people.map((m) => m.name)).toEqual(["You", "Member"]);
    expect(total).toBe(250);
  });
});

describe("target date helpers", () => {
  it("counts days until the target", () => {
    expect(daysUntil("2026-12-25", "2026-10-25")).toBe(61);
    expect(daysUntil("2026-10-20", "2026-10-25")).toBe(-5);
  });

  it("spreads what's left over the months remaining", () => {
    // ₱6,000 left over ~2 months
    expect(monthlyNeeded(600000, "2026-12-25", "2026-10-25")).toBe(304919);
  });

  it("needs at least one month's worth, all of it once due, and nothing when done or undated", () => {
    expect(monthlyNeeded(10000, "2026-10-30", "2026-10-25")).toBe(10000);
    expect(monthlyNeeded(10000, "2026-10-01", "2026-10-25")).toBe(10000);
    expect(monthlyNeeded(0, "2026-12-25", "2026-10-25")).toBeNull();
    expect(monthlyNeeded(10000, null, "2026-10-25")).toBeNull();
  });
});
