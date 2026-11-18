import { describe, expect, it } from "vitest";
import { activeMinutes, defaultProfile, pickInterval, planFor, type Profile } from "./hydration";

const p = (over: Partial<Profile>): Profile => ({ ...defaultProfile, climate: "cool", ...over });

describe("planFor", () => {
  it("uses about 30 ml/kg for an adult", () => {
    const plan = planFor(p({ weightKg: 70 }));
    expect(plan.totalMl).toBe(2100);
    expect(plan.intervalMin).toBe(60); // ~8 reminders over 10 h
  });

  it("falls back to an age/sex baseline when weight is skipped", () => {
    expect(planFor(p({ sex: "female" })).totalMl).toBe(1800);
    expect(planFor(p({ sex: "male" })).totalMl).toBe(2200);
  });

  it("adds water for activity, heat and breastfeeding", () => {
    const plan = planFor(
      p({ sex: "female", weightKg: 60, activity: "active", climate: "hot", pregnancy: "breastfeeding" }),
    );
    // 1800 + 500 + 500 + 700
    expect(plan.totalMl).toBe(3500);
    expect(plan.reasons.map((r) => r.label)).toEqual([
      "Base for your age and 60 kg",
      "Physical activity",
      "Hot, humid days",
      "Breastfeeding",
    ]);
  });

  it("ignores pregnancy answers that don't apply", () => {
    const plan = planFor(p({ sex: "male", pregnancy: "pregnant", weightKg: 70 }));
    expect(plan.totalMl).toBe(2100);
  });

  it("caps the total at a safe range", () => {
    expect(planFor(p({ weightKg: 150, activity: "very", climate: "hot" })).totalMl).toBe(3500);
    expect(planFor(p({ ageGroup: "71+", weightKg: 35 })).totalMl).toBe(1200);
  });

  it("keeps kids' extras smaller and capped lower", () => {
    const plan = planFor(p({ ageGroup: "9-13", weightKg: 40, activity: "very", climate: "hot" }));
    // 1520 + 375 + 250 = 2145 -> rounded to 50
    expect(plan.totalMl).toBe(2150);
  });

  it("counts the total in refills of the user's tumbler", () => {
    expect(planFor(p({ weightKg: 70, tumblerMl: 700 })).refills).toBe(3);
  });

  it("flags a doctor's fluid limit", () => {
    expect(planFor(p({ fluidRestricted: true })).restricted).toBe(true);
  });
});

describe("intervals", () => {
  it("measures the active window, including overnight", () => {
    expect(activeMinutes(8, 18)).toBe(600);
    expect(activeMinutes(20, 4)).toBe(480);
    expect(activeMinutes(9, 9)).toBe(1440);
  });

  it("picks the longest interval that still fits every serving", () => {
    expect(pickInterval(8, 8, 18)).toBe(60); // 75 min available
    expect(pickInterval(12, 8, 18)).toBe(45); // 50 min available
    expect(pickInterval(4, 8, 18)).toBe(120);
    expect(pickInterval(20, 9, 12)).toBe(15); // never below the shortest option
  });
});
