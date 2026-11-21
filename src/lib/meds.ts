/**
 * Medicine reminders: the user's medicines and vitamins, the times of day to take them,
 * and a log of which doses were taken (or skipped) per day. Tumbli is a reminder here,
 * not medical advice: the user sets the times their doctor or the label tells them.
 */
import { emit } from "@tauri-apps/api/event";
import { CHANGED_EVENT, dayKey } from "./store";

export type Med = {
  id: string;
  /** "Metformin", "Vitamin D" */
  name: string;
  /** times of day, "HH:MM" (24 h), sorted */
  times: string[];
  /** optional, e.g. "after meals" */
  note: string;
  /** false: kept in the list but no reminders */
  on: boolean;
  /** day it was added (YYYY-MM-DD): earlier days don't count as missed */
  since?: string;
};

/** "missed": the user said they didn't take it (e.g. while away); "skipped": closed the reminder */
export type DoseState = "taken" | "skipped" | "missed";
/** day (YYYY-MM-DD) -> "medId@HH:MM" -> what happened */
export type MedLog = Record<string, Record<string, DoseState>>;

export type DoseStatus = DoseState | "due" | "later";
export type Dose = { med: Med; time: string; at: number; status: DoseStatus };

const MEDS_KEY = "tumbli.meds";
const LOG_KEY = "tumbli.medLog";
/** the last day whose unanswered doses have been marked missed */
const CLOSED_KEY = "tumbli.medLogClosed";
const KEEP_DAYS = 30;
export const MAX_MEDS = 12;
export const MAX_TIMES = 6;
/** a dose not answered this long after its time stops reminding and counts as missed */
export const LATE_LIMIT_MIN = 4 * 60;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const isTime = (t: unknown): t is string => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** distinct, valid times in order */
export const cleanTimes = (times: string[]) => [...new Set(times.filter(isTime))].sort().slice(0, MAX_TIMES);

export function loadMeds(): Med[] {
  const list = readJson<Partial<Med>[]>(MEDS_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => m && typeof m.id === "string" && typeof m.name === "string")
    .map((m) => ({
      id: m.id!,
      name: m.name!,
      times: cleanTimes(Array.isArray(m.times) ? m.times : []),
      note: typeof m.note === "string" ? m.note : "",
      on: m.on !== false,
      ...(typeof m.since === "string" ? { since: m.since } : {}),
    }));
}

export function saveMeds(meds: Med[]) {
  localStorage.setItem(MEDS_KEY, JSON.stringify(meds.slice(0, MAX_MEDS)));
  void emit(CHANGED_EVENT);
}

export function loadMedLog(): MedLog {
  const log = readJson<MedLog>(LOG_KEY, {});
  return log && typeof log === "object" ? log : {};
}

export const doseKey = (medId: string, time: string) => `${medId}@${time}`;

/** Mark one of today's doses taken or skipped (null clears it). Old days are dropped. */
export function setDose(medId: string, time: string, state: DoseState | null, now = new Date()) {
  const log = loadMedLog();
  const day = dayKey(now);
  const today = { ...(log[day] ?? {}) };
  if (state) today[doseKey(medId, time)] = state;
  else delete today[doseKey(medId, time)];
  log[day] = today;
  const cutoff = dayKey(new Date(now.getTime() - KEEP_DAYS * 86_400_000));
  for (const d of Object.keys(log)) if (d < cutoff) delete log[d];
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  void emit(CHANGED_EVENT);
}

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * A new day: every dose of the days before today that nobody marked becomes "missed"
 * (for medicines that were on and already added that day). Runs at midnight and at start,
 * so days the PC was off count too.
 */
export function closePastDays(now = new Date()) {
  const yesterday = dayKey(addDays(now, -1));
  const last = localStorage.getItem(CLOSED_KEY);
  if (last === null || last >= yesterday) {
    if (last === null) localStorage.setItem(CLOSED_KEY, yesterday); // first run: nothing before it
    return false;
  }
  const meds = loadMeds().filter((m) => m.on);
  const log = loadMedLog();
  let changed = false;
  for (let i = KEEP_DAYS; i >= 1; i--) {
    const day = dayKey(addDays(now, -i));
    if (day <= last) continue;
    for (const m of meds) {
      if (m.since && m.since > day) continue;
      for (const time of m.times) {
        const k = doseKey(m.id, time);
        if (!log[day]?.[k]) {
          log[day] = { ...(log[day] ?? {}), [k]: "missed" };
          changed = true;
        }
      }
    }
  }
  if (changed) localStorage.setItem(LOG_KEY, JSON.stringify(log));
  localStorage.setItem(CLOSED_KEY, yesterday);
  if (changed) void emit(CHANGED_EVENT);
  return changed;
}

export type DayDots = { day: string; label: string; taken: number; total: number };

/** One medicine's last `days` days before today: how many of its doses were taken each day. */
export function medHistory(med: Med, log: MedLog, now = new Date(), days = 7): DayDots[] {
  const out: DayDots[] = [];
  for (let i = days; i >= 1; i--) {
    const d = addDays(now, -i);
    const day = dayKey(d);
    const entries = med.times.map((t) => log[day]?.[doseKey(med.id, t)]);
    const counted = entries.filter(Boolean).length;
    out.push({
      day,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      taken: entries.filter((e) => e === "taken").length,
      total: med.since && med.since > day ? 0 : counted,
    });
  }
  return out;
}

/** "HH:MM" today, as ms since epoch */
export function timeAt(time: string, now = new Date()) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** "08:00" -> "8:00 am" */
export function fmtTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Every dose of today for the medicines that are on, in time order, with what happened to it. */
export function dosesToday(meds: Med[], log: MedLog, now = new Date()): Dose[] {
  const today = log[dayKey(now)] ?? {};
  const t = now.getTime();
  const out: Dose[] = [];
  for (const med of meds) {
    if (!med.on) continue;
    for (const time of med.times) {
      const at = timeAt(time, now);
      const logged = today[doseKey(med.id, time)];
      const status: DoseStatus = logged
        ? logged
        : at > t
          ? "later"
          : t - at > LATE_LIMIT_MIN * 60_000
            ? "missed"
            : "due";
      out.push({ med, time, at, status });
    }
  }
  return out.sort((a, b) => a.at - b.at || a.med.name.localeCompare(b.med.name));
}

/** The doses Tumbli should remind about right now (snoozed ones wait until their snooze ends). */
export function dueDoses(meds: Med[], log: MedLog, now = new Date(), snoozedUntil: Record<string, number> = {}) {
  const t = now.getTime();
  return dosesToday(meds, log, now).filter(
    (d) => d.status === "due" && (snoozedUntil[doseKey(d.med.id, d.time)] ?? 0) <= t,
  );
}

/** Today's doses from `from` to `to` (ms) nobody has answered yet: what came up while the user was away. */
export function dosesBetween(meds: Med[], log: MedLog, from: number, to: number) {
  const today = log[dayKey(new Date(to))] ?? {};
  return dosesToday(meds, log, new Date(to)).filter(
    (d) => d.at >= from && d.at <= to && !today[doseKey(d.med.id, d.time)],
  );
}

/** The next dose still to come today, if any. */
export function nextDose(meds: Med[], log: MedLog, now = new Date()) {
  return dosesToday(meds, log, now).find((d) => d.status === "later") ?? null;
}

/** "Metformin", "Metformin and Vitamin D", "Metformin, Vitamin D and Iron" */
export function joinNames(names: string[]) {
  const list = [...new Set(names)];
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export const newMedId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
