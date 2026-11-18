import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn(() => Promise.resolve()) }));

import { checkAchievements, computeStats, loadLifetimeMl, loadUnlocked, unlockedOutfits } from "./achievements";
import { addMl, dayKey } from "./store";

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
};
const setHistory = (h: Record<string, number>) => localStorage.setItem("tumbli.historyMl", JSON.stringify(h));

beforeEach(() => localStorage.clear());

describe("lifetime total", () => {
  it("starts from the history and follows every drink and undo", () => {
    setHistory({ [daysAgo(3)]: 1500 });
    addMl(500);
    expect(loadLifetimeMl()).toBe(2000);
    addMl(-200);
    expect(loadLifetimeMl()).toBe(1800);
  });
});

describe("computeStats", () => {
  it("counts streaks and goal days", () => {
    const h = { [daysAgo(0)]: 2000, [daysAgo(1)]: 2000, [daysAgo(2)]: 500, [daysAgo(5)]: 2500 };
    expect(computeStats(h, 2000)).toMatchObject({ currentStreak: 2, bestStreak: 2, goalDays: 3 });
  });
});

describe("checkAchievements", () => {
  it("unlocks the first sip and the party hat on the first goal day", () => {
    setHistory({ [daysAgo(0)]: 2000 });
    addMl(0); // nothing changes
    const fresh = checkAchievements(2000).map((a) => a.id);
    expect(fresh).toEqual(["first-sip", "goal-getter"]);
    expect(unlockedOutfits().has("partyhat")).toBe(true);
  });

  it("unlocks each achievement only once", () => {
    setHistory({ [daysAgo(0)]: 2000 });
    checkAchievements(2000);
    expect(checkAchievements(2000)).toEqual([]);
  });

  it("gives sunglasses for a 7-day streak", () => {
    const h: Record<string, number> = {};
    for (let i = 0; i < 7; i++) h[daysAgo(i)] = 2000;
    setHistory(h);
    const ids = checkAchievements(2000).map((a) => a.id);
    expect(ids).toContain("cool-streak");
    expect(ids).not.toContain("two-weeks");
    expect(unlockedOutfits()).toEqual(new Set(["partyhat", "bowtie", "sunglasses"]));
  });

  it("keeps the best streak after it breaks", () => {
    const h: Record<string, number> = {};
    for (let i = 1; i <= 3; i++) h[daysAgo(i + 2)] = 2000;
    setHistory(h);
    checkAchievements(2000);
    setHistory({ ...h, [daysAgo(0)]: 100 });
    expect(computeStats({ [daysAgo(0)]: 100 }, 2000).bestStreak).toBe(3);
    expect(loadUnlocked()["on-a-roll"]).toBeTruthy();
  });
});
