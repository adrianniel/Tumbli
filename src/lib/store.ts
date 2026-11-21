import { emit } from "@tauri-apps/api/event";

/** How the user logs water: glass by glass, or from their own tumbler that Tumbli mirrors. */
export type TrackMode = "glass" | "tumbler";

/** Look of both windows. Dark by default; the settings panel has a switch. */
export type Theme = "dark" | "light";

export type Settings = {
  mode: TrackMode;
  /** daily goal, ml */
  goalMl: number;
  /** glass size in "glass" mode, ml */
  glassMl: number;
  /** size of the user's real tumbler / bottle, ml; Tumbli mirrors it */
  tumblerMl: number;
  intervalMin: number; // minutes between reminders (when autoInterval is off)
  /** Tumbli spaces the reminders itself so the goal is reached before the active hours end */
  autoInterval: boolean;
  startHour: number; // reminders only between startHour..endHour (local time)
  endHour: number;
  sound: boolean;
  hideOnFullscreen: boolean;
  /** what Tumbli calls the user; empty if they skipped it */
  name: string;
  /** global keyboard shortcut that logs a drink from anywhere */
  shortcutOn: boolean;
  shortcut: string;
  /** what Tumbli is wearing (unlocked through achievements); null = nothing */
  outfit: string | null;
  theme: Theme;
};

/** date (YYYY-MM-DD) -> ml drunk that day */
export type History = Record<string, number>;

export const CHANGED_EVENT = "tumbli:changed";

const SETTINGS_KEY = "tumbli.settings";
const HISTORY_KEY = "tumbli.historyMl";
const LEGACY_HISTORY_KEY = "tumbli.history"; // glasses per day, before tumblers
const LEVEL_KEY = "tumbli.level";
const UNDO_KEY = "tumbli.undo";
const KEEP_DAYS = 90;

export const defaultSettings: Settings = {
  mode: "glass",
  goalMl: 2000,
  glassMl: 250,
  tumblerMl: 750,
  intervalMin: 45,
  autoInterval: false,
  startHour: 8,
  endHour: 20,
  sound: true,
  hideOnFullscreen: true,
  name: "",
  shortcutOn: true,
  shortcut: "CommandOrControl+Alt+W",
  outfit: null,
  theme: "dark",
};

/** Shortcuts to choose from (the first is the default). */
export const SHORTCUTS = ["CommandOrControl+Alt+W", "CommandOrControl+Shift+W", "CommandOrControl+Alt+D"];
/** "Ctrl + Alt + W" */
export const shortcutLabel = (s: string) => s.replace("CommandOrControl", "Ctrl").split("+").join(" + ");

const SHORTCUT_STATUS_KEY = "tumbli.shortcutStatus";
/** Whether the widget managed to register the shortcut ("ok" / "taken" / "off"). */
export function loadShortcutStatus(): string {
  return localStorage.getItem(SHORTCUT_STATUS_KEY) ?? "ok";
}
export function saveShortcutStatus(v: "ok" | "taken" | "off") {
  if (localStorage.getItem(SHORTCUT_STATUS_KEY) === v) return;
  localStorage.setItem(SHORTCUT_STATUS_KEY, v);
  void emit(CHANGED_EVENT);
}

export const TUMBLER_SIZES = [350, 500, 650, 750, 1000, 1200];
export const GLASS_SIZES = [150, 200, 250, 300, 350, 500];

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

type LegacySettings = Partial<Settings> & { goal?: number };

export function loadSettings(): Settings {
  const raw = readJson<LegacySettings>(SETTINGS_KEY, {});
  const { goal, ...rest } = raw;
  const s: Settings = { ...defaultSettings, ...rest };
  // older versions counted glasses: goal x glass size becomes the ml goal
  if (raw.goalMl === undefined && goal) {
    s.goalMl = goal * s.glassMl;
    s.mode = "glass";
  }
  return s;
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  void emit(CHANGED_EVENT);
}

/** ml per glass the old glass-based history used (to convert it once) */
function legacyGlassMl(): number {
  return readJson<LegacySettings>(SETTINGS_KEY, {}).glassMl ?? 250;
}

export function loadHistory(): History {
  const h = readJson<History | null>(HISTORY_KEY, null);
  if (h) return h;
  const legacy = readJson<History | null>(LEGACY_HISTORY_KEY, null);
  if (!legacy) return {};
  const ml = legacyGlassMl();
  const converted: History = {};
  for (const [k, v] of Object.entries(legacy)) converted[k] = v * ml;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(converted));
  return converted;
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

export function todayMl(h = loadHistory()): number {
  return h[dayKey()] ?? 0;
}

/** Add (or subtract) ml for today. Returns today's new total. */
export function addMl(delta: number): number {
  const h = loadHistory();
  const k = dayKey();
  const before = h[k] ?? 0;
  h[k] = Math.max(0, Math.round(before + delta));
  bumpLifetime(h[k] - before, h);
  saveHistory(h);
  return h[k];
}

const LIFETIME_KEY = "tumbli.lifetimeMl";
/** lifetime ml (also read by achievements.ts); starts from what the history holds */
function bumpLifetime(delta: number, h: History) {
  if (!delta) return;
  const raw = localStorage.getItem(LIFETIME_KEY);
  const base = raw === null ? Object.values(h).reduce((a, b) => a + b, 0) - delta : Number(raw) || 0;
  localStorage.setItem(LIFETIME_KEY, String(Math.max(0, base + delta)));
}

export function resetToday() {
  const h = loadHistory();
  delete h[dayKey()];
  saveHistory(h);
}

// ---------- the tumbler itself ----------

/** How much is left in the user's tumbler right now, ml. Starts full. */
export function loadLevel(s = loadSettings()): number {
  const raw = localStorage.getItem(LEVEL_KEY);
  const v = raw === null ? s.tumblerMl : Number(raw);
  return Math.max(0, Math.min(s.tumblerMl, Number.isFinite(v) ? v : s.tumblerMl));
}

function saveLevel(ml: number) {
  localStorage.setItem(LEVEL_KEY, String(Math.max(0, Math.round(ml))));
  void emit(CHANGED_EVENT);
}

/** the last action; level -1 means it didn't touch the tumbler (glass mode) */
type Undo = { ml: number; level: number };

/** Glasses in the daily goal ("glass" mode). */
export function goalGlasses(s: Pick<Settings, "goalMl" | "glassMl">) {
  return Math.max(1, Math.round(s.goalMl / s.glassMl));
}

export type DrinkResult = {
  /** ml actually logged (can't drink more than is in the tumbler) */
  drank: number;
  total: number;
  level: number;
};

/** Drink from the tumbler. */
export function drink(amountMl: number, s = loadSettings()): DrinkResult {
  if (s.mode === "glass") {
    const ml = Math.max(0, Math.round(amountMl));
    localStorage.setItem(UNDO_KEY, JSON.stringify({ ml, level: -1 } satisfies Undo));
    return { drank: ml, total: addMl(ml), level: -1 };
  }
  const level = loadLevel(s);
  const drank = Math.max(0, Math.min(Math.round(amountMl), level));
  if (drank === 0) return { drank: 0, total: todayMl(), level };
  localStorage.setItem(UNDO_KEY, JSON.stringify({ ml: drank, level } satisfies Undo));
  saveLevel(level - drank);
  return { drank, total: addMl(drank), level: level - drank };
}

/** Drink whatever is left. */
export function finishTumbler(s = loadSettings()): DrinkResult {
  return drink(loadLevel(s), s);
}

/** The tumbler was refilled. */
export function refill(s = loadSettings()) {
  localStorage.setItem(UNDO_KEY, JSON.stringify({ ml: 0, level: loadLevel(s) } satisfies Undo));
  saveLevel(s.tumblerMl);
}

/** Undo the last drink or refill. Returns false when there's nothing to undo. */
export function undoLast(): boolean {
  const u = readJson<Undo | null>(UNDO_KEY, null);
  if (!u) return false;
  localStorage.removeItem(UNDO_KEY);
  if (u.ml) addMl(-u.ml);
  if (u.level >= 0) saveLevel(u.level);
  return true;
}

export function canUndo(): boolean {
  return localStorage.getItem(UNDO_KEY) !== null;
}

/** Consecutive days (ending today or yesterday) where the goal was reached. */
export function streak(h: History, goalMl: number): number {
  const d = new Date();
  let n = 0;
  if ((h[dayKey(d)] ?? 0) >= goalMl) n++;
  d.setDate(d.getDate() - 1);
  while ((h[dayKey(d)] ?? 0) >= goalMl) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function lastDays(h: History, days: number) {
  const out: { key: string; label: string; ml: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({
      key: dayKey(d),
      label: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }),
      ml: h[dayKey(d)] ?? 0,
    });
  }
  return out;
}

/** "1.2 L" / "750 ml" */
export function fmtMl(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;
  return `${Math.round(ml)} ml`;
}

/** "1.2" (liters, one decimal) for tight spots like the widget badge */
export function liters(ml: number): string {
  return (ml / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const ONBOARDED_KEY = "tumbli.onboarded";

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboarded() {
  localStorage.setItem(ONBOARDED_KEY, "1");
}

const PAUSE_KEY = "tumbli.pausedUntil";

/** Reminders are paused until this time (ms since epoch); 0 = not paused. */
export function loadPausedUntil(): number {
  try {
    return Number(localStorage.getItem(PAUSE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function savePausedUntil(t: number) {
  if (t > 0) localStorage.setItem(PAUSE_KEY, String(t));
  else localStorage.removeItem(PAUSE_KEY);
  void emit(CHANGED_EVENT);
}

const ACTIVE_KEY = "tumbli.lastActive";
/** When the user last touched the keyboard or mouse (ms), as of Tumbli's last check. */
export function loadLastActive(): number {
  const n = Number(localStorage.getItem(ACTIVE_KEY));
  return Number.isFinite(n) ? n : 0;
}
export function saveLastActive(t: number) {
  try {
    localStorage.setItem(ACTIVE_KEY, String(Math.round(t)));
  } catch {
    /* not fatal */
  }
}

const NEXT_KEY = "tumbli.nextReminderAt";

/** When the widget plans the next reminder (ms since epoch), so settings can show it; 0 = unknown. */
export function loadNextReminder(): number {
  try {
    return Number(localStorage.getItem(NEXT_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** No change event: settings polls this, and the widget would only hear itself. */
export function saveNextReminder(t: number) {
  try {
    localStorage.setItem(NEXT_KEY, String(Math.round(t)));
  } catch {
    /* storage full or blocked: the status line just stays hidden */
  }
}

/** When a pause of the given kind would end, counted from `now`. */
export function pauseEnd(kind: "hour" | "day", now = new Date()): number {
  if (kind === "hour") return now.getTime() + 60 * 60_000;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

/** Start the hydration check again next time the settings window renders. */
const RECHECK_KEY = "tumbli.recheck";
/**
 * People who set Tumbli up before 0.1.4 get offered the new hydration check once (it now
 * recommends glasses / tumbler refills and tells about medicine reminders). Never forced.
 */
export function shouldOfferRecheck(): boolean {
  return isOnboarded() && localStorage.getItem(RECHECK_KEY) === null;
}
/** "done" after a hydration check (new users too), "later" when the offer is dismissed */
export function markRecheck(v: "done" | "later") {
  localStorage.setItem(RECHECK_KEY, v);
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDED_KEY);
}

const PROFILE_KEY = "tumbli.profile";

/** Answers from the hydration check, so a retake starts from them. */
export function loadProfile<T>(fallback: T): T {
  return { ...fallback, ...readJson<Partial<T>>(PROFILE_KEY, {}) };
}

export function saveProfile<T>(p: T) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

const TOUR_KEY = "tumbli.tourDone";
export const TOUR_EVENT = "tumbli:tour";

export function isTourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourDone() {
  localStorage.setItem(TOUR_KEY, "1");
}
