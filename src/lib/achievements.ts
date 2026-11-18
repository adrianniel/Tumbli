/**
 * Achievements and the outfits they unlock for Tumbli.
 * Unlocks are kept forever once earned; progress is computed from the history plus a
 * lifetime total and best streak that outlive the 90-day history.
 */
import { emit } from "@tauri-apps/api/event";
import { CHANGED_EVENT, dayKey, loadHistory, streak, type History } from "./store";

export type Outfit = "partyhat" | "bowtie" | "sunglasses" | "headphones" | "crown";

export const OUTFITS: { id: Outfit; name: string }[] = [
  { id: "partyhat", name: "Party hat" },
  { id: "bowtie", name: "Bow tie" },
  { id: "sunglasses", name: "Sunglasses" },
  { id: "headphones", name: "Headphones" },
  { id: "crown", name: "Crown" },
];

export type Stats = {
  /** ml ever logged */
  lifetimeMl: number;
  currentStreak: number;
  bestStreak: number;
  /** days (in the kept history) that reached the goal */
  goalDays: number;
};

export type Achievement = {
  id: string;
  title: string;
  desc: string;
  outfit?: Outfit;
  /** how far along, e.g. 4 of 7 days */
  progress: (s: Stats) => { value: number; target: number; unit: string };
};

const L = 1000;

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-sip",
    title: "First sip",
    desc: "Log your very first drink",
    progress: (s) => ({ value: Math.min(1, s.lifetimeMl > 0 ? 1 : 0), target: 1, unit: "drink" }),
  },
  {
    id: "goal-getter",
    title: "Goal getter",
    desc: "Reach your daily goal",
    outfit: "partyhat",
    progress: (s) => ({ value: Math.min(1, s.goalDays), target: 1, unit: "day" }),
  },
  {
    id: "on-a-roll",
    title: "On a roll",
    desc: "Reach your goal 3 days in a row",
    outfit: "bowtie",
    progress: (s) => ({ value: Math.min(3, s.bestStreak), target: 3, unit: "days" }),
  },
  {
    id: "cool-streak",
    title: "Cool streak",
    desc: "Reach your goal 7 days in a row",
    outfit: "sunglasses",
    progress: (s) => ({ value: Math.min(7, s.bestStreak), target: 7, unit: "days" }),
  },
  {
    id: "two-weeks",
    title: "Two weeks strong",
    desc: "Reach your goal 14 days in a row",
    outfit: "headphones",
    progress: (s) => ({ value: Math.min(14, s.bestStreak), target: 14, unit: "days" }),
  },
  {
    id: "royalty",
    title: "Hydration royalty",
    desc: "Reach your goal 30 days in a row",
    outfit: "crown",
    progress: (s) => ({ value: Math.min(30, s.bestStreak), target: 30, unit: "days" }),
  },
  {
    id: "10l",
    title: "10 L club",
    desc: "Drink 10 liters in total",
    progress: (s) => ({ value: Math.min(10, Math.floor(s.lifetimeMl / L)), target: 10, unit: "L" }),
  },
  {
    id: "50l",
    title: "50 L legend",
    desc: "Drink 50 liters in total",
    progress: (s) => ({ value: Math.min(50, Math.floor(s.lifetimeMl / L)), target: 50, unit: "L" }),
  },
];

const UNLOCKED_KEY = "tumbli.achievements"; // id -> date unlocked
const LIFETIME_KEY = "tumbli.lifetimeMl";
const BEST_KEY = "tumbli.bestStreak";

const sum = (h: History) => Object.values(h).reduce((a, b) => a + b, 0);

/** Lifetime ml: starts from whatever the history already holds. */
export function loadLifetimeMl(h = loadHistory()): number {
  const raw = localStorage.getItem(LIFETIME_KEY);
  return raw === null ? sum(h) : Math.max(0, Number(raw) || 0);
}

/** The longest run of consecutive goal days anywhere in the history. */
export function longestRun(h: History, goalMl: number): number {
  const days = Object.keys(h)
    .filter((k) => h[k] >= goalMl)
    .sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of days) {
    const [y, m, d] = k.split("-").map(Number);
    const t = Date.UTC(y, m - 1, d) / 86_400_000;
    run = prev !== null && t - prev === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

export function computeStats(h: History, goalMl: number, lifetimeMl = loadLifetimeMl(h)): Stats {
  const currentStreak = streak(h, goalMl);
  const bestStreak = Math.max(Number(localStorage.getItem(BEST_KEY)) || 0, currentStreak, longestRun(h, goalMl));
  const goalDays = Object.values(h).filter((ml) => ml >= goalMl).length;
  return { lifetimeMl, currentStreak, bestStreak, goalDays };
}

export function loadUnlocked(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(UNLOCKED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function isDone(a: Achievement, s: Stats) {
  const p = a.progress(s);
  return p.value >= p.target;
}

/**
 * Save any achievements that are now earned and return the new ones (oldest first),
 * so the widget can celebrate them.
 */
export function checkAchievements(goalMl: number, h = loadHistory()): Achievement[] {
  const stats = computeStats(h, goalMl);
  localStorage.setItem(BEST_KEY, String(stats.bestStreak));
  const unlocked = loadUnlocked();
  const fresh = ACHIEVEMENTS.filter((a) => !unlocked[a.id] && isDone(a, stats));
  if (fresh.length) {
    for (const a of fresh) unlocked[a.id] = dayKey();
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
    void emit(CHANGED_EVENT);
  }
  return fresh;
}

/** Outfits the user has earned. */
export function unlockedOutfits(): Set<Outfit> {
  const u = loadUnlocked();
  return new Set(ACHIEVEMENTS.filter((a) => a.outfit && u[a.id]).map((a) => a.outfit!));
}

export const outfitName = (o: Outfit | string | null | undefined) => OUTFITS.find((x) => x.id === o)?.name ?? "";
