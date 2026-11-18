import { beforeEach, describe, expect, it } from "vitest";
import { askLater, neverAsk, rated, shouldAskForRating } from "./rating";
import { dayKey } from "./store";

const now = new Date(2026, 10, 19, 10);
const d = (day: number) => dayKey(new Date(2026, 10, day));

beforeEach(() => localStorage.clear());

describe("rating prompt", () => {
  it("waits for 3 days of use", () => {
    expect(shouldAskForRating({ [d(18)]: 500, [d(19)]: 250 }, now)).toBe(false);
    expect(shouldAskForRating({ [d(17)]: 500, [d(18)]: 500, [d(19)]: 250 }, now)).toBe(true);
  });

  it("ignores days with nothing logged", () => {
    expect(shouldAskForRating({ [d(17)]: 0, [d(18)]: 500, [d(19)]: 250 }, now)).toBe(false);
  });

  const used = { [d(16)]: 500, [d(17)]: 500, [d(18)]: 500 };

  it("asks again a week after Later", () => {
    askLater(now);
    expect(shouldAskForRating(used, now)).toBe(false);
    expect(shouldAskForRating(used, new Date(2026, 10, 25))).toBe(false);
    expect(shouldAskForRating(used, new Date(2026, 10, 26))).toBe(true);
  });

  it("never asks again after rating or No thanks", () => {
    rated();
    expect(shouldAskForRating(used, now)).toBe(false);
    localStorage.clear();
    neverAsk();
    expect(shouldAskForRating(used, now)).toBe(false);
  });
});
