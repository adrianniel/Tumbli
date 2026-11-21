/**
 * Updating must never change or lose what the user already has. This loads storage the way
 * 0.1.3 left it, runs everything 0.1.4 does when it starts, and checks that every old value
 * is still there byte for byte.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn(() => Promise.resolve()) }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(() => Promise.resolve("0.1.4")) }));

import { pendingReleases } from "./changelog";
import { closePastDays, dosesToday, loadMedLog, loadMeds } from "./meds";
import { currentInterval, sipFor } from "./schedule";
import {
  loadHistory,
  loadLastActive,
  loadLevel,
  loadSettings,
  markRecheck,
  saveProfile,
  saveSettings,
  streak,
  todayMl,
} from "./store";

const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** what a 0.1.3 user has in storage */
const OLD: Record<string, string> = {
  "tumbli.settings": JSON.stringify({
    mode: "glass",
    goalMl: 2250,
    glassMl: 250,
    tumblerMl: 750,
    intervalMin: 15,
    startHour: 9,
    endHour: 18,
    sound: false,
    hideOnFullscreen: true,
    name: "Ana",
    shortcutOn: true,
    shortcut: "CommandOrControl+Alt+W",
    outfit: "crown",
    theme: "light",
  }),
  "tumbli.historyMl": JSON.stringify({ [day(3)]: 2250, [day(2)]: 2500, [day(1)]: 2250, [day(0)]: 750 }),
  "tumbli.lifetimeMl": "41250",
  "tumbli.level": "500",
  "tumbli.onboarded": "1",
  "tumbli.tourDone": "1",
  "tumbli.profile": JSON.stringify({ ageGroup: "19-30", sex: "female", weightKg: 55 }),
  "tumbli.achievements": JSON.stringify({ "first-sip": day(20), "goal-getter": day(19), "on-a-roll": day(10) }),
  "tumbli.widget.anchor.v3": JSON.stringify({ side: "left", x: 0, bottom: 1032 }),
  "tumbli.recapShown": "2026-W46",
  "tumbli.rating": JSON.stringify({ status: "later", at: 1 }),
  "tumbli.nextReminderAt": "123",
};

beforeEach(() => {
  localStorage.clear();
  for (const [k, v] of Object.entries(OLD)) localStorage.setItem(k, v);
});

describe("updating from 0.1.3 to 0.1.4", () => {
  it("keeps every old value exactly as it was", () => {
    // what 0.1.4 runs when it starts
    const s = loadSettings();
    closePastDays();
    pendingReleases("0.1.4");
    loadMeds();
    dosesToday(loadMeds(), loadMedLog());
    loadLastActive();
    currentInterval(s, todayMl(), new Date());
    sipFor(s, todayMl());

    for (const [k, v] of Object.entries(OLD)) expect(localStorage.getItem(k), k).toBe(v);
  });

  it("reads the same settings, history, streak and tumbler as before", () => {
    const s = loadSettings();
    expect(s).toMatchObject(JSON.parse(OLD["tumbli.settings"]));
    expect(s.autoInterval).toBe(false); // their own "every 15 min" stays; Auto is opt-in
    expect(currentInterval(s, 0, new Date())).toBe(15);
    expect(loadHistory()).toEqual(JSON.parse(OLD["tumbli.historyMl"]));
    expect(todayMl()).toBe(750);
    expect(streak(loadHistory(), s.goalMl)).toBe(3);
    expect(loadLevel(s)).toBe(500);
  });

  it("starts the new features empty instead of guessing", () => {
    expect(loadMeds()).toEqual([]);
    expect(loadMedLog()).toEqual({});
    expect(closePastDays()).toBe(false); // nothing gets marked missed on the first run
    expect(loadLastActive()).toBe(0); // so no "welcome back" right after updating
  });
});

describe("retaking the hydration check after updating", () => {
  it("keeps the history, streak, achievements and everything else", () => {
    const before = streak(loadHistory(), 2250);
    // what finishing the check saves: the profile and new plan settings
    saveProfile({ ageGroup: "19-30", sex: "female", weightKg: 60, activity: "active" });
    saveSettings({ ...loadSettings(), goalMl: 2750, intervalMin: 45, autoInterval: true });
    markRecheck("done");

    for (const k of ["tumbli.historyMl", "tumbli.lifetimeMl", "tumbli.level", "tumbli.achievements", "tumbli.widget.anchor.v3"])
      expect(localStorage.getItem(k), k).toBe(OLD[k]);
    expect(streak(loadHistory(), 2750)).toBe(before); // the higher goal doesn't take the streak back
    expect(loadSettings()).toMatchObject({ name: "Ana", outfit: "crown", theme: "light", goalMl: 2750 });
  });
});
