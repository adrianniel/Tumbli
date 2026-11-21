import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn(() => Promise.resolve()) }));

import {
  closePastDays,
  medHistory,
  cleanTimes,
  doseKey,
  dosesBetween,
  dosesToday,
  dueDoses,
  fmtTime,
  joinNames,
  loadMedLog,
  loadMeds,
  nextDose,
  saveMeds,
  setDose,
  type Med,
} from "./meds";

const at = (h: number, m = 0, day = 18) => new Date(2026, 10, day, h, m);
const med = (patch: Partial<Med> = {}): Med => ({
  id: "m1",
  name: "Metformin",
  times: ["08:00", "20:00"],
  note: "",
  on: true,
  ...patch,
});

beforeEach(() => localStorage.clear());

describe("saving medicines", () => {
  it("round-trips and cleans bad times", () => {
    saveMeds([med({ times: ["20:00", "08:00", "08:00", "25:00", "nope"] })]);
    expect(loadMeds()[0].times).toEqual(["08:00", "20:00"]);
  });
  it("survives broken storage", () => {
    localStorage.setItem("tumbli.meds", "{oops");
    expect(loadMeds()).toEqual([]);
  });
  it("sorts and dedupes times", () => {
    expect(cleanTimes(["21:30", "07:05", "21:30"])).toEqual(["07:05", "21:30"]);
  });
});

describe("dosesToday", () => {
  it("knows which doses are due, later, missed, or done", () => {
    const meds = [med(), med({ id: "m2", name: "Vitamin D", times: ["09:00"] })];
    const log = { "2026-11-18": { [doseKey("m2", "09:00")]: "taken" as const } };
    const doses = dosesToday(meds, log, at(13));
    expect(doses.map((d) => `${d.med.name} ${d.time} ${d.status}`)).toEqual([
      "Metformin 08:00 missed", // 5 h late
      "Vitamin D 09:00 taken",
      "Metformin 20:00 later",
    ]);
    expect(dosesToday(meds, {}, at(9, 30)).map((d) => d.status)).toEqual(["due", "due", "later"]);
  });
  it("skips medicines that are switched off", () => {
    expect(dosesToday([med({ on: false })], {}, at(9))).toEqual([]);
  });
});

describe("dueDoses", () => {
  it("reminds at the time, not before", () => {
    expect(dueDoses([med()], {}, at(7, 59))).toHaveLength(0);
    expect(dueDoses([med()], {}, at(8))).toHaveLength(1);
  });
  it("waits out a snooze", () => {
    const snoozed = { [doseKey("m1", "08:00")]: at(8, 10).getTime() };
    expect(dueDoses([med()], {}, at(8, 5), snoozed)).toHaveLength(0);
    expect(dueDoses([med()], {}, at(8, 10), snoozed)).toHaveLength(1);
  });
  it("stops once the dose is answered", () => {
    setDose("m1", "08:00", "taken", at(8, 1));
    expect(dueDoses([med()], loadMedLog(), at(8, 2))).toHaveLength(0);
  });
  it("starts over the next day", () => {
    setDose("m1", "08:00", "taken", at(8, 1));
    expect(dueDoses([med()], loadMedLog(), at(8, 1, 19))).toHaveLength(1);
  });
});

describe("setDose", () => {
  it("can clear a dose again", () => {
    setDose("m1", "08:00", "taken", at(8));
    setDose("m1", "08:00", null, at(8));
    expect(loadMedLog()["2026-11-18"]).toEqual({});
  });
  it("forgets days older than a month", () => {
    setDose("m1", "08:00", "taken", at(8, 0, 1));
    setDose("m1", "08:00", "taken", at(8, 0, 1 + 40));
    expect(Object.keys(loadMedLog())).toHaveLength(1);
  });
});

describe("nextDose / labels", () => {
  it("finds the next dose today", () => {
    expect(nextDose([med()], {}, at(12))?.time).toBe("20:00");
    expect(nextDose([med()], {}, at(21))).toBeNull();
  });
  it("formats times and names", () => {
    expect(fmtTime("08:05")).toBe("8:05 am");
    expect(fmtTime("00:00")).toBe("12:00 am");
    expect(fmtTime("12:30")).toBe("12:30 pm");
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("dosesBetween", () => {
  it("lists the unanswered doses from the time away", () => {
    const meds = [med(), med({ id: "m2", name: "Vitamin D", times: ["09:00", "15:00"] })];
    const log = { "2026-11-18": { [doseKey("m2", "09:00")]: "taken" as const } };
    // away 7:30 - 13:00: Metformin 8:00 (Vitamin D 9:00 already taken, 15:00 not yet)
    const away = dosesBetween(meds, log, at(7, 30).getTime(), at(13).getTime());
    expect(away.map((d) => `${d.med.name} ${d.time}`)).toEqual(["Metformin 08:00"]);
  });
  it("counts a dose marked missed as answered", () => {
    setDose("m1", "08:00", "missed", at(9));
    expect(dosesBetween([med()], loadMedLog(), at(7).getTime(), at(13).getTime())).toEqual([]);
  });
});

describe("closePastDays", () => {
  it("marks yesterday's unanswered doses missed at midnight", () => {
    saveMeds([med({ since: "2026-11-10" })]);
    closePastDays(at(23, 0, 17)); // first run: remembers where it starts
    setDose("m1", "08:00", "taken", at(8, 5, 18));
    expect(closePastDays(at(0, 1, 19))).toBe(true);
    expect(loadMedLog()["2026-11-18"]).toEqual({ "m1@08:00": "taken", "m1@20:00": "missed" });
    expect(closePastDays(at(9, 0, 19))).toBe(false); // once a day
  });
  it("counts the days the PC was off, but not before a medicine was added", () => {
    saveMeds([med({ since: "2026-11-17" })]);
    closePastDays(at(12, 0, 15));
    closePastDays(at(12, 0, 19));
    expect(Object.keys(loadMedLog()).sort()).toEqual(["2026-11-17", "2026-11-18"]);
  });
});

describe("medHistory", () => {
  it("counts taken doses per day", () => {
    const log = { "2026-11-17": { "m1@08:00": "taken" as const, "m1@20:00": "missed" as const } };
    const h = medHistory(med(), log, at(9, 0, 18), 2);
    expect(h.map((d) => [d.day, d.taken, d.total])).toEqual([
      ["2026-11-16", 0, 0],
      ["2026-11-17", 1, 2],
    ]);
  });
});
