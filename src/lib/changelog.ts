/**
 * What changed in each version, newest first: shown once after an update (a bubble on the
 * widget) and anytime from Settings. Keep the first entry in step with the app version.
 */
import { getVersion } from "@tauri-apps/api/app";
import { isOnboarded } from "./store";

export type Change = { title: string; text: string };
export type Release = { version: string; date: string; changes: Change[] };

export const CHANGELOG: Release[] = [
  {
    version: "0.1.4",
    date: "November 2026",
    changes: [
      {
        title: "Auto reminders",
        text: 'Pick "Auto" in "Remind me every" and Tumbli spaces your reminders so you reach your goal before your day ends. Skip one and the next come a bit sooner.',
      },
      {
        title: "Medicine reminders",
        text: "Add your medicines or vitamins with their times, on the days you take them (or until a date). Tumbli reminds you at each one, and View logs shows your last two weeks.",
      },
      {
        title: "Peek at the screen edge",
        text: "Drag Tumbli past the edge of your screen and it tucks half of itself in. It comes out when it has something to say. Drag it back out to undock it.",
      },
      {
        title: "Welcome back",
        text: "After time away (a closed lid, a break, a shutdown), log the water and medicine you had while you were gone.",
      },
      {
        title: "A smarter hydration check",
        text: "Tumbli now recommends how many glasses a day, or how many liters and tumbler refills, from your answers. Use its plan or set your own. Set up Tumbli before? Retake the check from Settings.",
      },
      {
        title: "A cleaner Settings",
        text: "Achievements fold into a neat shelf, with new time and date pickers that match Tumbli's look.",
      },
      {
        title: "Lighter on your PC",
        text: "Tumbli now rests its animations while it waits, so it uses far less CPU and battery through the day.",
      },
      {
        title: "What's new",
        text: "Settings now show Tumbli's version and what changed in each update.",
      },
    ],
  },
  {
    version: "0.1.3",
    date: "November 2026",
    changes: [
      { title: "Reminders follow your changes", text: 'A new "Remind me every" takes effect right away.' },
      { title: "Next reminder", text: "Settings show when the next reminder comes." },
    ],
  },
  {
    version: "0.1.2",
    date: "November 2026",
    changes: [
      { title: "Cleaner bubbles", text: "No more title bar above Tumbli's speech bubbles." },
      { title: "Reset today", text: "A friendlier dialog before today's total goes back to 0." },
    ],
  },
  {
    version: "0.1.1",
    date: "November 2026",
    changes: [{ title: "Hello, Microsoft Store!", text: "Tumbli's first release." }],
  },
];

/** The running app's version (the newest changelog entry in the browser preview). */
export async function appVersion(): Promise<string> {
  const v = await getVersion().catch(() => null);
  return typeof v === "string" && v ? v : CHANGELOG[0].version;
}

/** -1, 0 or 1, comparing "0.1.10" style versions */
export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

const SEEN_KEY = "tumbli.seenVersion";

export function markVersionSeen(version: string) {
  localStorage.setItem(SEEN_KEY, version);
}

/**
 * Releases to tell the user about after an update: newer than the last version they saw.
 * A fresh install has nothing to tell; someone who used Tumbli before versions were kept
 * (onboarded, nothing saved) just updated to this one.
 */
export function pendingReleases(current: string, onboarded = isOnboarded()): Release[] {
  const seen = localStorage.getItem(SEEN_KEY);
  if (!seen && !onboarded) {
    markVersionSeen(current);
    return [];
  }
  return CHANGELOG.filter(
    (r) => compareVersions(r.version, current) <= 0 && (!seen || compareVersions(r.version, seen) > 0),
  ).slice(0, seen ? undefined : 1);
}
