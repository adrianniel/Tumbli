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

/**
 * How much to drink at each reminder: the daily goal spread over the reminders
 * that fit into the active hours, rounded to 10 ml and never more than the tumbler.
 */
export function sipFor(s: Pick<Settings, "goalMl" | "tumblerMl" | "intervalMin" | "startHour" | "endHour">) {
  const reminders = Math.max(1, Math.floor(activeMinutes(s.startHour, s.endHour) / s.intervalMin));
  const ml = Math.round(s.goalMl / reminders / 10) * 10;
  return Math.max(50, Math.min(s.tumblerMl, ml));
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
