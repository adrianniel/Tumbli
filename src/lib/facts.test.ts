import { describe, expect, it } from "vitest";
import { factOfTheDay, FACTS, greeting, nudgeMessage, randomFact } from "./facts";

describe("facts", () => {
  it("never repeats the same fact twice in a row", () => {
    const a = randomFact(() => 0.5);
    const b = randomFact(() => 0.5);
    expect(a).not.toBe(b);
  });

  it("keeps the same fact for the whole day", () => {
    expect(factOfTheDay(new Date(2026, 10, 18, 8))).toBe(factOfTheDay(new Date(2026, 10, 18, 22)));
  });

  it("has short, complete entries", () => {
    for (const f of FACTS) {
      const text = f.kind === "fact" ? f.text : f.q + f.a;
      expect(text.length).toBeGreaterThan(10);
      expect(f.kind === "fact" ? f.text.length : f.q.length).toBeLessThan(110);
    }
  });
});

describe("greeting", () => {
  it("uses the time of day and the name", () => {
    expect(greeting("Niel", new Date(2026, 0, 1, 9))).toBe("Good morning, Niel");
    expect(greeting("", new Date(2026, 0, 1, 15))).toBe("Good afternoon");
    expect(greeting(" Ana ", new Date(2026, 0, 1, 20))).toBe("Good evening, Ana");
  });

  it("puts the name in reminders when known", () => {
    expect(nudgeMessage("Ana", () => 0)).toContain("Ana");
    expect(nudgeMessage("", () => 0)).not.toContain(",  ");
  });
});

import { cheerFor } from "./facts";

describe("cheerFor", () => {
  it("celebrates milestones", () => {
    expect(cheerFor(1, 8, "")).toBe("First glass of the day! ☀️");
    expect(cheerFor(4, 8, "")).toBe("Halfway there! 🎉");
    expect(cheerFor(7, 8, "")).toBe("Just 1 more to go! 💪");
    expect(cheerFor(8, 8, "Ana")).toBe("Goal reached, Ana! 🏆");
    expect(cheerFor(9, 8, "")).toBe("Extra credit! 🌟");
  });

  it("encourages in between", () => {
    expect(cheerFor(2, 8, "", () => 0.99)).toBe("6 more to go!");
    expect(cheerFor(3, 8, "Ana", () => 0.8)).toBe("Great job, Ana! ✨");
  });
});
