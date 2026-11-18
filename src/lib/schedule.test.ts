import { describe, expect, it } from "vitest";
import { shouldNudge, sipFor, withinActiveHours } from "./schedule";

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
