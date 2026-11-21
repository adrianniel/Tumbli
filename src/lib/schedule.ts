import { activeMinutes } from "./hydration";
import type { Settings } from "./store";

/** Is `d` inside the user's reminder hours? start === end means all day. */
export function withinActiveHours(s: Pick<Settings, "startHour" | "endHour">, d = new Date()) {
  const h = d.getHours();
  if (s.startHour === s.endHour) return true;
  if (s.startHour < s.endHour) return h >= s.startHour && h < s.endHour;
  return h >= s.startHour || h < s.endHour; // overnight range, e.g. 20 -> 4
}

export type NudgeInput = {
  now: Date;
  /** when the next reminder is due (ms since epoch) */
  nextAt: number;
  settings: Pick<Settings, "goalMl" | "startHour" | "endHour">;
  /** ml drunk today */
  doneMl: number;
  /** a fullscreen app / game / presentation is in front */
  busy: boolean;
  /** reminders paused until this time (ms since epoch), if any */
  pausedUntil?: number;
};

/** Should Tumbli pop up a reminder right now? */
export function shouldNudge({ now, nextAt, settings, doneMl, busy, pausedUntil = 0 }: NudgeInput) {
  const t = now.getTime();
  return (
    t >= nextAt &&
    t >= pausedUntil &&
    withinActiveHours(settings, now) &&
    doneMl < settings.goalMl &&
    !busy
  );
}

type PaceSettings = Pick<Settings, "goalMl" | "tumblerMl" | "intervalMin" | "startHour" | "endHour"> &
  Partial<Pick<Settings, "autoInterval" | "mode" | "glassMl">>;

const clampSip = (ml: number, tumblerMl: number) => Math.max(50, Math.min(tumblerMl, Math.round(ml / 10) * 10));

/**
 * How much to drink at each reminder: the daily goal spread over the reminders
 * that fit into the active hours, rounded to 10 ml and never more than the tumbler.
 * With Auto on, what is still left today spread over the reminders that are left.
 */
export function sipFor(s: PaceSettings, doneMl = 0, now = new Date()) {
  if (s.autoInterval) return autoPace(s, doneMl, now).sipMl;
  const reminders = Math.max(1, Math.floor(activeMinutes(s.startHour, s.endHour) / s.intervalMin));
  return clampSip(s.goalMl / reminders, s.tumblerMl);
}

/** Auto never reminds more often than this, or less often than AUTO_MAX_MIN. */
export const AUTO_MIN_MIN = 15;
export const AUTO_MAX_MIN = 120;
/** Auto aims to be done this long before the active hours end, so a late skip can still be made up. */
const AUTO_BUFFER_MIN = 30;

/**
 * Minutes from `now` until today's active hours end. Outside the active hours it is the
 * whole next window. All-day hours (start === end) run until midnight, when the day resets.
 */
export function minutesLeft(s: Pick<Settings, "startHour" | "endHour">, now = new Date()) {
  if (!withinActiveHours(s, now)) return activeMinutes(s.startHour, s.endHour);
  const end = new Date(now);
  end.setHours(s.startHour === s.endHour ? 24 : s.endHour, 0, 0, 0);
  if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1); // overnight range
  return Math.max(1, Math.round((end.getTime() - now.getTime()) / 60_000));
}

/**
 * Auto mode: how often to remind and how much to drink each time so the rest of
 * today's goal fits into the time that is left. A glass (or about 250 ml from a
 * tumbler) per reminder; if that would mean reminders closer than 15 min, the
 * sips get bigger instead. Worked out again after every reminder, so skipping one
 * brings the next ones a little closer, and drinking ahead spaces them out.
 */
export function autoPace(s: PaceSettings, doneMl: number, now = new Date()) {
  const comfy = s.mode === "glass" && s.glassMl ? s.glassMl : Math.min(s.tumblerMl, 250);
  const leftMl = s.goalMl - doneMl;
  if (leftMl <= 0) return { intervalMin: AUTO_MAX_MIN, sipMl: clampSip(comfy, s.tumblerMl) };
  const total = minutesLeft(s, now);
  const time = total > AUTO_BUFFER_MIN * 2 ? total - AUTO_BUFFER_MIN : total;
  const wanted = Math.max(1, Math.ceil(leftMl / comfy));
  const raw = time / wanted;
  const intervalMin = Math.min(AUTO_MAX_MIN, Math.max(AUTO_MIN_MIN, Math.floor(raw / 5) * 5));
  const fits = Math.max(1, Math.min(wanted, Math.floor(time / intervalMin)));
  return { intervalMin, sipMl: clampSip(leftMl / fits, s.tumblerMl) };
}

/** Minutes until the next reminder after one is answered: the chosen interval, or Auto's pace. */
export function currentInterval(s: PaceSettings, doneMl: number, now = new Date()) {
  return s.autoInterval ? autoPace(s, doneMl, now).intervalMin : s.intervalMin;
}

/**
 * The reminder interval changed while a countdown was running: count the time already
 * waited towards the new interval (60 -> 15 min after 10 min waited = due in 5 min),
 * but never sooner than `minWaitMs` from now.
 */
export function rescheduled(startedAt: number, intervalMin: number, now: number, minWaitMs = 30_000) {
  return Math.max(startedAt + intervalMin * 60_000, now + minWaitMs);
}

export type ReminderStatus =
  | { kind: "paused"; until: number }
  | { kind: "goal" }
  | { kind: "off-hours"; startHour: number }
  | { kind: "soon" }
  | { kind: "in"; minutes: number };

/** What the next reminder looks like right now, for the settings window. */
export function reminderStatus({
  now,
  nextAt,
  settings,
  doneMl,
  pausedUntil = 0,
}: Omit<NudgeInput, "busy">): ReminderStatus {
  const t = now.getTime();
  if (pausedUntil > t) return { kind: "paused", until: pausedUntil };
  if (doneMl >= settings.goalMl) return { kind: "goal" };
  if (!withinActiveHours(settings, now)) return { kind: "off-hours", startHour: settings.startHour };
  if (nextAt - t < 60_000) return { kind: "soon" };
  return { kind: "in", minutes: Math.max(1, Math.round((nextAt - t) / 60_000)) };
}
