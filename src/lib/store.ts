import { emit } from "@tauri-apps/api/event";

export type Settings = {
  goal: number; // glasses per day
  intervalMin: number; // minutes between reminders
  startHour: number; // reminders only between startHour..endHour (local time)
  endHour: number;
  glassMl: number;
  sound: boolean;
  hideOnFullscreen: boolean;
};

/** date (YYYY-MM-DD) -> glasses drunk that day */
export type History = Record<string, number>;

export const CHANGED_EVENT = "sipup:changed";

const SETTINGS_KEY = "sipup.settings";
const HISTORY_KEY = "sipup.history";
const KEEP_DAYS = 90;

export const defaultSettings: Settings = {
  goal: 8,
  intervalMin: 45,
  startHour: 8,
  endHour: 20,
  glassMl: 250,
  sound: true,
  hideOnFullscreen: true,
};

export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadSettings(): Settings {
  return { ...defaultSettings, ...readJson<Partial<Settings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  void emit(CHANGED_EVENT);
}

export function loadHistory(): History {
  return readJson<History>(HISTORY_KEY, {});
}

function saveHistory(h: History) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  const min = dayKey(cutoff);
  const pruned: History = {};
  for (const [k, v] of Object.entries(h)) if (k >= min) pruned[k] = v;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(pruned));
  void emit(CHANGED_EVENT);
}

export function todayCount(h = loadHistory()): number {
  return h[dayKey()] ?? 0;
}

/** Add (or subtract) glasses for today. Returns the new count. */
export function addGlasses(delta: number): number {
  const h = loadHistory();
  const k = dayKey();
  h[k] = Math.max(0, (h[k] ?? 0) + delta);
  saveHistory(h);
  return h[k];
}

export function resetToday() {
  const h = loadHistory();
  delete h[dayKey()];
  saveHistory(h);
}

/** Consecutive days (ending today or yesterday) where the goal was reached. */
export function streak(h: History, goal: number): number {
  const d = new Date();
  let n = 0;
  if ((h[dayKey(d)] ?? 0) >= goal) n++;
  d.setDate(d.getDate() - 1);
  while ((h[dayKey(d)] ?? 0) >= goal) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function lastDays(h: History, days: number) {
  const out: { key: string; label: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({
      key: dayKey(d),
      label: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }),
      count: h[dayKey(d)] ?? 0,
    });
  }
  return out;
}
