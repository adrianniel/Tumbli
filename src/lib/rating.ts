/** When to ask for a Microsoft Store rating: after 3 days of use, never pushy. */
import { dayKey, type History } from "./store";

type RatingState = { status: "new" | "later" | "rated" | "never"; until?: string };

const KEY = "tumbli.rating";
export const DAYS_BEFORE_ASKING = 3;
const LATER_DAYS = 7;

export function loadRating(): RatingState {
  try {
    return { status: "new", ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { status: "new" };
  }
}

function save(s: RatingState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

/** Days with at least one drink logged. */
export function daysUsed(h: History): number {
  return Object.values(h).filter((ml) => ml > 0).length;
}

export function shouldAskForRating(h: History, now = new Date(), state = loadRating()): boolean {
  if (state.status === "rated" || state.status === "never") return false;
  if (state.status === "later" && state.until && dayKey(now) < state.until) return false;
  return daysUsed(h) >= DAYS_BEFORE_ASKING;
}

export function rated() {
  save({ status: "rated" });
}

export function neverAsk() {
  save({ status: "never" });
}

export function askLater(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + LATER_DAYS);
  save({ status: "later", until: dayKey(d) });
}
