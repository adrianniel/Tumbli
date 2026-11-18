/** Things Tumbli says when you click it. Keep them short, friendly and true. */

export type Fact = { kind: "fact"; text: string } | { kind: "trivia"; q: string; a: string };

export const FACTS: Fact[] = [
  { kind: "fact", text: "About 60% of an adult's body is water." },
  { kind: "fact", text: "Your brain is roughly 75% water, so a drink can help you stay sharp." },
  { kind: "fact", text: "Losing just 1–2% of your body's water can make it harder to focus." },
  { kind: "fact", text: "About a fifth of the water you get each day comes from food." },
  { kind: "fact", text: "You lose a few hundred ml of water a day just by breathing." },
  { kind: "fact", text: "Pale yellow pee usually means you're well hydrated." },
  { kind: "fact", text: "Blood plasma is about 90% water. It carries nutrients and oxygen around your body." },
  { kind: "fact", text: "Your kidneys filter about 180 liters of fluid every day." },
  { kind: "fact", text: "Sweating is how your body cools down. Water makes that work." },
  { kind: "fact", text: "A tired-feeling afternoon headache can be a sign you need water." },
  { kind: "fact", text: "Coffee and tea count toward your daily fluids too." },
  { kind: "fact", text: "Sparkling water hydrates you just as well as still water." },
  { kind: "fact", text: "Sipping through the day works better than chugging a lot at once." },
  { kind: "fact", text: "Thirst gets weaker as we age, so reminders help more over time." },
  { kind: "fact", text: "A glass of water before a meal can help you feel full sooner." },
  { kind: "fact", text: "During hard exercise in the heat you can sweat a liter or more an hour." },
  { kind: "fact", text: "Muscles are about 75% water. Hydrated muscles work better." },
  { kind: "fact", text: "Saliva is more than 99% water." },
  { kind: "fact", text: "Babies are about 75% water. Adults are closer to 60%." },
  { kind: "fact", text: "Only about 3% of Earth's water is fresh water." },
  { kind: "fact", text: "Fruit like oranges, strawberries and melons are mostly water." },
  { kind: "trivia", q: "Which is more watery: a cucumber or a watermelon?", a: "Cucumber! About 96% water, just ahead of watermelon at about 92%." },
  { kind: "trivia", q: "How long can a person usually survive without water?", a: "Only about 3 days, compared with weeks without food." },
  { kind: "trivia", q: "How much of Earth's surface is covered by water?", a: "About 71%." },
  { kind: "trivia", q: "Which organ filters your blood and decides how much water to keep?", a: "Your kidneys." },
  { kind: "trivia", q: "Roughly how much of your brain is water: 25%, 50% or 75%?", a: "About 75%." },
  { kind: "trivia", q: "Does sweat cool you down or warm you up?", a: "It cools you down: as sweat evaporates, it carries heat away from your skin." },
  { kind: "trivia", q: "What color pee means you're probably well hydrated?", a: "Pale yellow, like lemonade." },
  { kind: "trivia", q: "Do coffee and tea count toward your daily water?", a: "Yes! In normal amounts they hydrate you too." },
  { kind: "trivia", q: "At what temperature does water boil at sea level?", a: "100 °C (212 °F)." },
];

let last = -1;

/** A random fact, never the same one twice in a row. */
export function randomFact(rand = Math.random): Fact {
  let i = Math.floor(rand() * FACTS.length);
  if (i === last) i = (i + 1) % FACTS.length;
  last = i;
  return FACTS[i];
}

/** Today's fact for the dashboard: the same one all day. */
export function factOfTheDay(d = new Date()): Fact {
  const day = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
  return FACTS[day % FACTS.length];
}

export function greeting(name: string | undefined, d = new Date()) {
  const h = d.getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const n = (name ?? "").trim();
  return n ? `${part}, ${n}` : part;
}

/** Reminder lines; some use the user's name when we know it. */
export function nudgeMessage(name: string | undefined, rand = Math.random) {
  const n = (name ?? "").trim();
  const lines = n
    ? [`${n}, time to sip! 💧`, `Water break, ${n}!`, `Hey ${n}, let's drink some water`, `Sip, sip, hooray, ${n}! 🥤`]
    : ["Tumbli says: sip time! 💧", "Water break!", "Hydrate, then dominate 💪", "Sip, sip, hooray! 🥤"];
  return lines[Math.floor(rand() * lines.length)];
}

const fmt = (ml: number) =>
  ml >= 1000 ? `${(ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} L` : `${Math.round(ml / 10) * 10} ml`;

export type CheerInput = {
  /** ml today before and after this drink */
  before: number;
  after: number;
  goalMl: number;
  name?: string;
  /** the tumbler is now empty */
  empty?: boolean;
};

/** What Tumbli cheers right after you drink. */
export function cheerFor({ before, after, goalMl, name, empty = false }: CheerInput, rand = Math.random) {
  const n = (name ?? "").trim();
  const left = goalMl - after;
  if (before < goalMl && after >= goalMl) return n ? `Goal reached, ${n}! 🏆` : "Goal reached! 🏆";
  if (before >= goalMl) return "Extra credit! 🌟";
  if (empty) return "Empty! Time for a refill 🔄";
  if (before === 0) return "First sips of the day! ☀️";
  if (before < goalMl / 2 && after >= goalMl / 2) return "Halfway there! 🎉";
  if (left <= 500) return `Almost there! ${fmt(left)} to go 💪`;
  const lines = [
    "Nice sip! 💧",
    "Your brain says thanks! 🧠",
    "Keep it flowing! 🌊",
    "Hydration hero! 🦸",
    n ? `Great job, ${n}! ✨` : "Great job! ✨",
    `${fmt(left)} to go!`,
  ];
  return lines[Math.floor(rand() * lines.length)];
}
