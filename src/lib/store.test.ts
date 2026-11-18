import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn(() => Promise.resolve()) }));

import {
  addGlasses,
  dayKey,
  defaultSettings,
  lastDays,
  loadHistory,
  loadSettings,
  resetToday,
  saveSettings,
  streak,
  todayCount,
} from "./store";

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
};

beforeEach(() => {
  localStorage.clear();
});

describe("dayKey", () => {
  it("formats local dates as YYYY-MM-DD", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 10, 18))).toBe("2026-11-18");
  });
});

describe("settings", () => {
  it("falls back to defaults", () => {
    expect(loadSettings()).toEqual(defaultSettings);
  });

  it("merges saved values over defaults", () => {
    saveSettings({ ...defaultSettings, goal: 10 });
    expect(loadSettings().goal).toBe(10);
    expect(loadSettings().intervalMin).toBe(defaultSettings.intervalMin);
  });

  it("survives corrupted storage", () => {
    localStorage.setItem("tumbli.settings", "{not json");
    expect(loadSettings()).toEqual(defaultSettings);
  });
});

describe("glasses", () => {
  it("adds and removes glasses for today, never below zero", () => {
    expect(addGlasses(1)).toBe(1);
    expect(addGlasses(2)).toBe(3);
    expect(addGlasses(-5)).toBe(0);
    expect(todayCount()).toBe(0);
  });

  it("resets today without touching other days", () => {
    localStorage.setItem("tumbli.history", JSON.stringify({ [daysAgo(1)]: 6 }));
    addGlasses(4);
    resetToday();
    expect(todayCount()).toBe(0);
    expect(loadHistory()[daysAgo(1)]).toBe(6);
  });

  it("drops history older than 90 days", () => {
    localStorage.setItem(
      "tumbli.history",
      JSON.stringify({ [daysAgo(120)]: 8, [daysAgo(10)]: 5 }),
    );
    addGlasses(1);
    const h = loadHistory();
    expect(h[daysAgo(120)]).toBeUndefined();
    expect(h[daysAgo(10)]).toBe(5);
  });
});

describe("streak", () => {
  it("counts consecutive days that met the goal", () => {
    const h = { [daysAgo(0)]: 8, [daysAgo(1)]: 9, [daysAgo(2)]: 8, [daysAgo(3)]: 2 };
    expect(streak(h, 8)).toBe(3);
  });

  it("keeps yesterday's streak alive while today is in progress", () => {
    const h = { [daysAgo(0)]: 2, [daysAgo(1)]: 8, [daysAgo(2)]: 8 };
    expect(streak(h, 8)).toBe(2);
  });

  it("is zero when yesterday was missed", () => {
    expect(streak({ [daysAgo(2)]: 8 }, 8)).toBe(0);
  });
});

describe("lastDays", () => {
  it("returns oldest first, ending with Today", () => {
    const days = lastDays({ [daysAgo(0)]: 3 }, 7);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ label: "Today", count: 3 });
    expect(days[0].count).toBe(0);
  });
});
