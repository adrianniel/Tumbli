/** The weekly recap: how last week went, shown once at the start of each new week. */
import { dayKey, type History } from "./store";

export type Recap = {
  /** Monday of the recapped week, YYYY-MM-DD */
  week: string;
  totalMl: number;
  goalDays: number;
  /** days with any drink logged */
  activeDays: number;
  best: { label: string; ml: number } | null;
  /** change in total vs the week before, in %, or null if that week was empty */
  changePct: number | null;
};

const RECAP_KEY = "tumbli.recapShown";

/** Monday 00:00 of the week `d` is in (weeks start on Monday). */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

function weekDays(monday: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Recap of the week before the one `now` is in, or null if nothing was logged. */
export function recapFor(h: History, goalMl: number, now = new Date()): Recap | null {
  const lastMonday = mondayOf(now);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const days = weekDays(lastMonday).map((d) => ({
    label: d.toLocaleDateString(undefined, { weekday: "long" }),
    ml: h[dayKey(d)] ?? 0,
  }));
  const totalMl = days.reduce((a, d) => a + d.ml, 0);
  if (totalMl === 0) return null;

  const before = new Date(lastMonday);
  before.setDate(before.getDate() - 7);
  const prevTotal = weekDays(before).reduce((a, d) => a + (h[dayKey(d)] ?? 0), 0);

  const best = days.reduce((a, d) => (d.ml > a.ml ? d : a), days[0]);
  return {
    week: dayKey(lastMonday),
    totalMl,
    goalDays: days.filter((d) => d.ml >= goalMl).length,
    activeDays: days.filter((d) => d.ml > 0).length,
    best: best.ml > 0 ? best : null,
    changePct: prevTotal > 0 ? Math.round(((totalMl - prevTotal) / prevTotal) * 100) : null,
  };
}

/** The recap to show now, if it hasn't been shown for that week yet. */
export function pendingRecap(h: History, goalMl: number, now = new Date()): Recap | null {
  const r = recapFor(h, goalMl, now);
  if (!r || localStorage.getItem(RECAP_KEY) === r.week) return null;
  return r;
}

export function markRecapShown(r: Recap) {
  localStorage.setItem(RECAP_KEY, r.week);
}
