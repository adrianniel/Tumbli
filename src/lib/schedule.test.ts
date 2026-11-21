import { describe, expect, it } from "vitest";
import {
  autoPace,
  currentInterval,
  minutesLeft,
  reminderStatus,
  rescheduled,
  shouldNudge,
  sipFor,
  withinActiveHours,
} from "./schedule";

const at = (h: number, m = 0) => new Date(2026, 10, 18, h, m);

describe("withinActiveHours", () => {
  it("covers a normal daytime range, end exclusive", () => {
    const s = { startHour: 8, endHour: 20 };
    expect(withinActiveHours(s, at(7, 59))).toBe(false);
    expect(withinActiveHours(s, at(8))).toBe(true);
    expect(withinActiveHours(s, at(19, 59))).toBe(true);
    expect(withinActiveHours(s, at(20))).toBe(false);
  });

  it("handles ranges that cross midnight", () => {
    const s = { startHour: 20, endHour: 4 };
    expect(withinActiveHours(s, at(22))).toBe(true);
    expect(withinActiveHours(s, at(2))).toBe(true);
    expect(withinActiveHours(s, at(12))).toBe(false);
  });

  it("treats equal start and end as all day", () => {
    expect(withinActiveHours({ startHour: 0, endHour: 0 }, at(3))).toBe(true);
  });
});

describe("shouldNudge", () => {
  const base = {
    now: at(10),
    nextAt: at(9, 30).getTime(),
    settings: { goalMl: 2000, startHour: 8, endHour: 20 },
    doneMl: 750,
    busy: false,
  };

  it("nudges when due, in hours, below goal and not busy", () => {
    expect(shouldNudge(base)).toBe(true);
  });

  it("waits until the reminder is due", () => {
    expect(shouldNudge({ ...base, nextAt: at(10, 30).getTime() })).toBe(false);
  });

  it("stays quiet outside active hours", () => {
    expect(shouldNudge({ ...base, now: at(21), nextAt: 0 })).toBe(false);
  });

  it("stops once the goal is reached", () => {
    expect(shouldNudge({ ...base, doneMl: 2000 })).toBe(false);
  });

  it("never interrupts fullscreen apps", () => {
    expect(shouldNudge({ ...base, busy: true })).toBe(false);
  });

  it("respects a pause", () => {
    expect(shouldNudge({ ...base, pausedUntil: at(11).getTime() })).toBe(false);
    expect(shouldNudge({ ...base, pausedUntil: at(9).getTime() })).toBe(true);
  });
});

describe("sipFor", () => {
  const s = { goalMl: 2400, tumblerMl: 750, intervalMin: 60, startHour: 8, endHour: 20 };
  it("spreads the goal over the day's reminders", () => {
    expect(sipFor(s)).toBe(200); // 12 reminders
  });
  it("never asks for more than the tumbler holds", () => {
    expect(sipFor({ ...s, tumblerMl: 150, intervalMin: 120 })).toBe(150);
  });
});

describe("rescheduled", () => {
  const start = at(10).getTime();
  it("counts the time already waited towards a shorter interval", () => {
    // 60 -> 15 min, 10 min in: due at 10:15
    expect(rescheduled(start, 15, at(10, 10).getTime())).toBe(at(10, 15).getTime());
  });
  it("waits a little when the new interval has already passed", () => {
    // 60 -> 15 min, 40 min in: due 30 s from now
    expect(rescheduled(start, 15, at(10, 40).getTime())).toBe(at(10, 40).getTime() + 30_000);
  });
  it("pushes the reminder out for a longer interval", () => {
    expect(rescheduled(start, 90, at(10, 10).getTime())).toBe(at(11, 30).getTime());
  });
});

describe("reminderStatus", () => {
  const settings = { goalMl: 2000, startHour: 8, endHour: 22 };
  const base = { now: at(10), nextAt: at(10, 12).getTime(), settings, doneMl: 500 };
  it("counts down to the next reminder", () => {
    expect(reminderStatus(base)).toEqual({ kind: "in", minutes: 12 });
  });
  it("says soon in the last minute or when overdue", () => {
    expect(reminderStatus({ ...base, nextAt: at(10, 0).getTime() + 30_000 })).toEqual({ kind: "soon" });
    expect(reminderStatus({ ...base, nextAt: at(9, 50).getTime() })).toEqual({ kind: "soon" });
  });
  it("explains why there is no reminder", () => {
    expect(reminderStatus({ ...base, pausedUntil: at(11).getTime() })).toEqual({ kind: "paused", until: at(11).getTime() });
    expect(reminderStatus({ ...base, doneMl: 2000 })).toEqual({ kind: "goal" });
    expect(reminderStatus({ ...base, now: at(23) })).toEqual({ kind: "off-hours", startHour: 8 });
  });
});

describe("minutesLeft", () => {
  const day = { startHour: 8, endHour: 20 };
  it("counts down to the end of the active hours", () => {
    expect(minutesLeft(day, at(18, 30))).toBe(90);
  });
  it("is the whole next window outside the active hours", () => {
    expect(minutesLeft(day, at(22))).toBe(12 * 60);
  });
  it("crosses midnight for overnight hours", () => {
    expect(minutesLeft({ startHour: 20, endHour: 4 }, at(23))).toBe(5 * 60);
  });
  it("runs to midnight when reminders are on all day", () => {
    expect(minutesLeft({ startHour: 0, endHour: 0 }, at(21))).toBe(3 * 60);
  });
});

describe("autoPace", () => {
  const glass = {
    mode: "glass" as const,
    goalMl: 2000,
    glassMl: 250,
    tumblerMl: 750,
    intervalMin: 120,
    startHour: 8,
    endHour: 20,
    autoInterval: true,
  };
  it("spaces a glass per reminder over the day", () => {
    // 8 glasses over 11.5 h (done 30 min early): every 85 min
    expect(autoPace(glass, 0, at(8)).intervalMin).toBe(85);
  });
  it("brings reminders closer when the user falls behind", () => {
    // 6 glasses left with 3.5 h to go: every 35 min
    expect(autoPace(glass, 500, at(16)).intervalMin).toBe(35);
  });
  it("spaces them out after drinking ahead", () => {
    expect(autoPace(glass, 1750, at(12)).intervalMin).toBe(120);
  });
  it("never goes below 15 min; tumbler sips get bigger instead", () => {
    const tumbler = { ...glass, mode: "tumbler" as const };
    const p = autoPace(tumbler, 0, at(18)); // 2 L in 2 h
    expect(p.intervalMin).toBe(15);
    expect(p.sipMl).toBe(330); // 6 reminders fit before the 30 min buffer: 2 L / 6
    const late = autoPace(tumbler, 0, at(19, 30)); // 2 L in 30 min
    expect(late.intervalMin).toBe(15);
    expect(late.sipMl).toBe(750); // capped at the tumbler
  });
  it("beats a 2 h interval that would miss the goal", () => {
    // the user's case: 2 h reminders fit only 6 glasses into 8 am - 8 pm
    const reminders = (iv: number) => Math.floor((12 * 60) / iv);
    expect(reminders(120) * 250).toBeLessThan(2000);
    expect(reminders(autoPace(glass, 0, at(8)).intervalMin) * 250).toBeGreaterThanOrEqual(2000);
  });
});

describe("currentInterval", () => {
  const s = { goalMl: 2000, tumblerMl: 750, intervalMin: 120, startHour: 8, endHour: 20 };
  it("uses the chosen interval when Auto is off", () => {
    expect(currentInterval(s, 0, at(8))).toBe(120);
  });
  it("uses Auto's pace when it is on", () => {
    expect(currentInterval({ ...s, autoInterval: true }, 0, at(8))).toBe(85);
  });
});
