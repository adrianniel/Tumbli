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
  const goalMl = 2000;
  it("celebrates milestones", () => {
    expect(cheerFor({ before: 0, after: 250, goalMl })).toBe("First sips of the day! ☀️");
    expect(cheerFor({ before: 900, after: 1100, goalMl })).toBe("Halfway there! 🎉");
    expect(cheerFor({ before: 1500, after: 1700, goalMl })).toBe("Almost there! 300 ml to go 💪");
    expect(cheerFor({ before: 1900, after: 2100, goalMl, name: "Ana" })).toBe("Goal reached, Ana! 🏆");
    expect(cheerFor({ before: 2100, after: 2300, goalMl })).toBe("Extra credit! 🌟");
  });

  it("asks for a refill when the tumbler runs out", () => {
    expect(cheerFor({ before: 300, after: 750, goalMl, empty: true })).toBe("Empty! Time for a refill 🔄");
  });

  it("encourages in between", () => {
    expect(cheerFor({ before: 250, after: 500, goalMl }, () => 0.99)).toBe("1.5 L to go!");
    expect(cheerFor({ before: 250, after: 500, goalMl, name: "Ana" }, () => 0.8)).toBe("Great job, Ana! ✨");
  });
});
