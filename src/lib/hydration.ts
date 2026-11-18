/**
 * Turns a short "hydration check" into a daily water goal and reminder settings.
 *
 * This is a friendly general guide, not medical advice. The numbers follow the
 * usual public-health rules of thumb: roughly 30 ml of drinks per kg of body weight
 * for adults (a bit more for kids and teens, a bit less for older adults), or an
 * age/sex baseline when weight is skipped, plus extra for activity, heat,
 * pregnancy and breastfeeding. Water from food is not counted here.
 */

export type AgeGroup = "9-13" | "14-18" | "19-30" | "31-50" | "51-70" | "71+";
export type Sex = "female" | "male" | "unspecified";
export type Pregnancy = "none" | "pregnant" | "breastfeeding";
export type Activity = "sedentary" | "light" | "active" | "very";
export type Climate = "cool" | "warm" | "hot";

export type Profile = {
  ageGroup: AgeGroup;
  sex: Sex;
  pregnancy: Pregnancy;
  /** null when the user skipped it */
  weightKg: number | null;
  activity: Activity;
  climate: Climate;
  /** the hours the user is usually at the computer */
  startHour: number;
  endHour: number;
  /** glass by glass, or from their own tumbler */
  mode: "glass" | "tumbler";
  /** glass size, ml ("glass" mode) */
  glassMl: number;
  /** size of their tumbler / water bottle, ml ("tumbler" mode) */
  tumblerMl: number;
  /** a doctor asked them to limit fluids (kidney, heart conditions...) */
  fluidRestricted: boolean;
};

export const defaultProfile: Profile = {
  ageGroup: "19-30",
  sex: "unspecified",
  pregnancy: "none",
  weightKg: null,
  activity: "sedentary",
  climate: "hot",
  startHour: 8,
  endHour: 18,
  mode: "glass",
  glassMl: 250,
  tumblerMl: 750,
  fluidRestricted: false,
};

export const INTERVALS = [15, 20, 30, 45, 60, 90, 120];

/** About how much each reminder should get you to drink: a few good sips. */
const SIP_TARGET_ML = 250;

export type Plan = {
  /** recommended drinks per day, ml */
  totalMl: number;
  /** minutes between reminders */
  intervalMin: number;
  tumblerMl: number;
  /** how many tumblers the total is, e.g. 2.7 */
  refills: number;
  startHour: number;
  endHour: number;
  /** how the total was built, for the result screen */
  reasons: { label: string; ml: number }[];
  /** the user must follow their doctor's limit instead */
  restricted: boolean;
};

const ML_PER_KG: Record<AgeGroup, number> = {
  "9-13": 38,
  "14-18": 33,
  "19-30": 30,
  "31-50": 30,
  "51-70": 28,
  "71+": 26,
};

// drinks per day when weight is skipped: [female, male, unspecified]
const BASELINE: Record<AgeGroup, [number, number, number]> = {
  "9-13": [1400, 1600, 1500],
  "14-18": [1700, 2000, 1800],
  "19-30": [1800, 2200, 2000],
  "31-50": [1800, 2200, 2000],
  "51-70": [1700, 2000, 1800],
  "71+": [1600, 1800, 1700],
};

const ACTIVITY_ML: Record<Activity, number> = { sedentary: 0, light: 250, active: 500, very: 750 };
const CLIMATE_ML: Record<Climate, number> = { cool: 0, warm: 250, hot: 500 };
const PREGNANCY_ML: Record<Pregnancy, number> = { none: 0, pregnant: 300, breastfeeding: 700 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Length of the active window in minutes (handles ranges past midnight). */
export function activeMinutes(startHour: number, endHour: number) {
  const hours = (endHour - startHour + 24) % 24 || 24;
  return hours * 60;
}

/** The longest standard interval that still fits `goal` reminders into the window. */
export function pickInterval(goal: number, startHour: number, endHour: number) {
  const raw = activeMinutes(startHour, endHour) / Math.max(1, goal);
  const fitting = INTERVALS.filter((m) => m <= raw);
  return fitting.length ? fitting[fitting.length - 1] : INTERVALS[0];
}

export function canBePregnant(p: Pick<Profile, "sex" | "ageGroup">) {
  return p.sex === "female" && p.ageGroup !== "9-13" && p.ageGroup !== "71+";
}

export function planFor(p: Profile): Plan {
  const reasons: Plan["reasons"] = [];
  const kid = p.ageGroup === "9-13";

  if (p.weightKg && p.weightKg > 0) {
    const base = Math.round(p.weightKg * ML_PER_KG[p.ageGroup]);
    reasons.push({ label: `Base for your age and ${p.weightKg} kg`, ml: base });
  } else {
    const idx = p.sex === "female" ? 0 : p.sex === "male" ? 1 : 2;
    reasons.push({ label: "Base for your age", ml: BASELINE[p.ageGroup][idx] });
  }

  const extras: [string, number][] = [
    ["Physical activity", ACTIVITY_ML[p.activity]],
    [p.climate === "hot" ? "Hot, humid days" : "Warm weather", CLIMATE_ML[p.climate]],
    [p.pregnancy === "breastfeeding" ? "Breastfeeding" : "Pregnancy", canBePregnant(p) ? PREGNANCY_ML[p.pregnancy] : 0],
  ];
  for (const [label, ml] of extras) {
    if (ml > 0) reasons.push({ label, ml: kid ? Math.round(ml / 2) : ml });
  }

  const sum = reasons.reduce((a, r) => a + r.ml, 0);
  const totalMl = Math.round(clamp(sum, kid ? 1000 : 1200, kid ? 2500 : 3500) / 50) * 50;
  const tumblerMl = clamp(p.tumblerMl || 750, 200, 2000);
  const reminders = clamp(Math.round(totalMl / SIP_TARGET_ML), 4, 16);

  return {
    totalMl,
    intervalMin: pickInterval(reminders, p.startHour, p.endHour),
    tumblerMl,
    refills: totalMl / tumblerMl,
    startHour: p.startHour,
    endHour: p.endHour,
    reasons,
    restricted: p.fluidRestricted,
  };
}
