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
