import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn(() => Promise.resolve()) }));

import {
  addMl,
  goalOn,
  loadGoalLog,
  canUndo,
  dayKey,
  defaultSettings,
  drink,
  finishTumbler,
  fmtMl,
  goalGlasses,
  lastDays,
  loadHistory,
  loadLevel,
  loadPausedUntil,
  loadSettings,
  pauseEnd,
  refill,
  resetToday,
  savePausedUntil,
  saveSettings,
  streak,
  todayMl,
  undoLast,
  type Settings,
} from "./store";

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
};
const tumbler: Settings = { ...defaultSettings, mode: "tumbler", tumblerMl: 750, goalMl: 2000 };
const glass: Settings = { ...defaultSettings, mode: "glass", glassMl: 250, goalMl: 2000 };

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
    saveSettings({ ...defaultSettings, goalMl: 2500 });
    expect(loadSettings().goalMl).toBe(2500);
    expect(loadSettings().intervalMin).toBe(defaultSettings.intervalMin);
  });

  it("survives corrupted storage", () => {
    localStorage.setItem("tumbli.settings", "{not json");
    expect(loadSettings()).toEqual(defaultSettings);
  });

  it("migrates the old glasses goal to ml in glass mode", () => {
    localStorage.setItem("tumbli.settings", JSON.stringify({ goal: 7, glassMl: 250 }));
    expect(loadSettings()).toMatchObject({ mode: "glass", goalMl: 1750, glassMl: 250 });
    expect(goalGlasses(loadSettings())).toBe(7);
  });
});

describe("history", () => {
  it("adds and removes ml for today, never below zero", () => {
    expect(addMl(250)).toBe(250);
    expect(addMl(500)).toBe(750);
    expect(addMl(-2000)).toBe(0);
    expect(todayMl()).toBe(0);
  });

  it("converts the old glass counts to ml once", () => {
    localStorage.setItem("tumbli.settings", JSON.stringify({ goal: 8, glassMl: 300 }));
    localStorage.setItem("tumbli.history", JSON.stringify({ [daysAgo(1)]: 4 }));
    expect(loadHistory()[daysAgo(1)]).toBe(1200);
    expect(localStorage.getItem("tumbli.historyMl")).not.toBeNull();
  });

  it("resets today without touching other days", () => {
    localStorage.setItem("tumbli.historyMl", JSON.stringify({ [daysAgo(1)]: 1500 }));
    addMl(400);
    resetToday();
    expect(todayMl()).toBe(0);
    expect(loadHistory()[daysAgo(1)]).toBe(1500);
  });

  it("drops history older than 90 days", () => {
    localStorage.setItem("tumbli.historyMl", JSON.stringify({ [daysAgo(120)]: 2000, [daysAgo(10)]: 900 }));
    addMl(100);
    const h = loadHistory();
    expect(h[daysAgo(120)]).toBeUndefined();
    expect(h[daysAgo(10)]).toBe(900);
  });
});

describe("tumbler mode", () => {
  it("starts full and empties as you drink", () => {
    expect(loadLevel(tumbler)).toBe(750);
    expect(drink(250, tumbler)).toEqual({ drank: 250, total: 250, level: 500 });
    expect(loadLevel(tumbler)).toBe(500);
  });

  it("can't drink more than is left", () => {
    drink(600, tumbler);
    expect(drink(400, tumbler)).toEqual({ drank: 150, total: 750, level: 0 });
    expect(drink(100, tumbler).drank).toBe(0);
  });

  it("finishes and refills", () => {
    drink(300, tumbler);
    expect(finishTumbler(tumbler)).toMatchObject({ drank: 450, level: 0 });
    refill(tumbler);
    expect(loadLevel(tumbler)).toBe(750);
    expect(todayMl()).toBe(750);
  });

  it("undoes the last drink or refill", () => {
    drink(250, tumbler);
    expect(undoLast()).toBe(true);
    expect(todayMl()).toBe(0);
    expect(loadLevel(tumbler)).toBe(750);
    expect(canUndo()).toBe(false);

    finishTumbler(tumbler);
    refill(tumbler);
    undoLast();
    expect(loadLevel(tumbler)).toBe(0);
    expect(todayMl()).toBe(750);
  });

  it("keeps the level within a smaller tumbler", () => {
    expect(loadLevel({ ...tumbler, tumblerMl: 500 })).toBe(500);
  });
});

describe("glass mode", () => {
  it("logs whole glasses without a tumbler level", () => {
    expect(drink(250, glass)).toEqual({ drank: 250, total: 250, level: -1 });
    drink(250, glass);
    expect(todayMl()).toBe(500);
    undoLast();
    expect(todayMl()).toBe(250);
  });

  it("counts the goal in glasses", () => {
    expect(goalGlasses(glass)).toBe(8);
  });
});

describe("streak", () => {
  it("counts consecutive days that met the goal", () => {
    const h = { [daysAgo(0)]: 2000, [daysAgo(1)]: 2300, [daysAgo(2)]: 2000, [daysAgo(3)]: 500 };
    expect(streak(h, 2000)).toBe(3);
  });

  it("keeps yesterday's streak alive while today is in progress", () => {
    expect(streak({ [daysAgo(0)]: 500, [daysAgo(1)]: 2000, [daysAgo(2)]: 2000 }, 2000)).toBe(2);
  });

  it("is zero when yesterday was missed", () => {
    expect(streak({ [daysAgo(2)]: 2000 }, 2000)).toBe(0);
  });
});

describe("lastDays", () => {
  it("returns oldest first, ending with Today", () => {
    const days = lastDays({ [daysAgo(0)]: 750 }, 7);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ label: "Today", ml: 750 });
    expect(days[0].ml).toBe(0);
  });
});

describe("fmtMl", () => {
  it("shows ml under a liter and liters above", () => {
    expect(fmtMl(250)).toBe("250 ml");
    expect(fmtMl(2250)).toBe("2.25 L");
  });
});

describe("pause", () => {
  it("pauses for an hour or until midnight", () => {
    const now = new Date(2026, 10, 18, 14, 30);
    expect(pauseEnd("hour", now)).toBe(new Date(2026, 10, 18, 15, 30).getTime());
    expect(pauseEnd("day", now)).toBe(new Date(2026, 10, 19, 0, 0).getTime());
  });

  it("stores and clears the pause", () => {
    savePausedUntil(123);
    expect(loadPausedUntil()).toBe(123);
    savePausedUntil(0);
    expect(loadPausedUntil()).toBe(0);
  });
});

describe("midnight reset", () => {
  it("starts a new day at 12:00 AM and keeps yesterday in history", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 18, 23, 59, 30));
      addMl(1250);
      expect(todayMl()).toBe(1250);
      vi.setSystemTime(new Date(2026, 10, 19, 0, 0, 5));
      expect(todayMl()).toBe(0);
      expect(addMl(250)).toBe(250);
      expect(lastDays(loadHistory(), 2).map((d) => d.ml)).toEqual([1250, 250]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not reset at noon", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 18, 11, 59));
      addMl(750);
      vi.setSystemTime(new Date(2026, 10, 18, 12, 1));
      expect(todayMl()).toBe(750);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("changing the goal (Settings or a retaken hydration check)", () => {
  it("keeps earlier days judged by the goal they had", () => {
    saveSettings({ ...glass, goalMl: 2000 });
    const h = { [daysAgo(1)]: 2000, [daysAgo(2)]: 2000, [daysAgo(3)]: 2000 };
    localStorage.setItem("tumbli.historyMl", JSON.stringify(h));
    saveSettings({ ...glass, goalMl: 2750 }); // a higher goal from the new check
    expect(streak(loadHistory(), 2750)).toBe(3); // the streak survives
    expect(goalOn(daysAgo(1), 2750)).toBe(2000);
    expect(goalOn(daysAgo(0), 2750)).toBe(2750); // today uses the new goal
    expect(loadHistory()).toEqual(h); // nothing in the history changes
  });
  it("logs nothing when the goal stays the same", () => {
    saveSettings({ ...glass, goalMl: 2000 });
    saveSettings({ ...glass, goalMl: 2000, sound: false });
    expect(loadGoalLog()).toEqual({});
  });
});

describe("Reset today", () => {
  it("only touches today, never the days before", () => {
    const h = { [daysAgo(4)]: 1500, [daysAgo(3)]: 1000, [daysAgo(0)]: 750 };
    localStorage.setItem("tumbli.historyMl", JSON.stringify(h));
    resetToday();
    const after = loadHistory();
    expect(after[daysAgo(4)]).toBe(1500);
    expect(after[daysAgo(3)]).toBe(1000);
    expect(after[daysAgo(0)] ?? 0).toBe(0);
  });
});
