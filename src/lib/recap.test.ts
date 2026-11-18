import { beforeEach, describe, expect, it } from "vitest";
import { markRecapShown, mondayOf, pendingRecap, recapFor } from "./recap";
import { dayKey } from "./store";

// Wednesday, Nov 18 2026 -> this week starts Mon Nov 16, last week is Nov 9..15
const now = new Date(2026, 10, 18, 10);
const d = (day: number) => dayKey(new Date(2026, 10, day));

beforeEach(() => localStorage.clear());

describe("mondayOf", () => {
  it("finds the Monday of the week", () => {
    expect(dayKey(mondayOf(now))).toBe("2026-11-16");
    expect(dayKey(mondayOf(new Date(2026, 10, 22)))).toBe("2026-11-16"); // Sunday
    expect(dayKey(mondayOf(new Date(2026, 10, 16)))).toBe("2026-11-16"); // Monday itself
  });
});

describe("recapFor", () => {
  const h = {
    [d(2)]: 1000, // the week before last: 1 L
    [d(9)]: 2000,
    [d(10)]: 2500,
    [d(12)]: 1500,
    [d(17)]: 3000, // this week, not counted
  };

  it("sums last week and compares it with the week before", () => {
    const r = recapFor(h, 2000, now)!;
    expect(r).toMatchObject({ week: "2026-11-09", totalMl: 6000, goalDays: 2, activeDays: 3, changePct: 500 });
    expect(r.best?.ml).toBe(2500);
  });

  it("is empty when nothing was logged last week", () => {
    expect(recapFor({ [d(17)]: 2000 }, 2000, now)).toBeNull();
  });

  it("shows once per week", () => {
    const r = pendingRecap(h, 2000, now)!;
    expect(r).not.toBeNull();
    markRecapShown(r);
    expect(pendingRecap(h, 2000, now)).toBeNull();
  });
});
