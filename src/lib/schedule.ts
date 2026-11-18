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
  settings: Pick<Settings, "goal" | "startHour" | "endHour">;
  count: number;
  /** a fullscreen app / game / presentation is in front */
  busy: boolean;
  /** reminders paused until this time (ms since epoch), if any */
  pausedUntil?: number;
};

/** Should Tumbli pop up a reminder right now? */
export function shouldNudge({ now, nextAt, settings, count, busy, pausedUntil = 0 }: NudgeInput) {
  const t = now.getTime();
  return (
    t >= nextAt &&
    t >= pausedUntil &&
    withinActiveHours(settings, now) &&
    count < settings.goal &&
    !busy
  );
}
