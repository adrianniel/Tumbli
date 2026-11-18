import { useMemo, useState, type ReactNode } from "react";
import { Tumbler } from "../components/Tumbler";
import { setAutostart as applyAutostart } from "../lib/autostart";
import {
  canBePregnant,
  defaultProfile,
  INTERVALS,
  planFor,
  type Activity,
  type AgeGroup,
  type Climate,
  type Pregnancy,
  type Profile,
  type Sex,
} from "../lib/hydration";
import { loadProfile, markOnboarded, saveProfile, saveSettings, type Settings } from "../lib/store";

type Props = { initial: Settings; onDone: (s: Settings) => void };

type Option<T> = { value: T; label: string; hint?: string; icon?: string };

const AGES: Option<AgeGroup>[] = [
  { value: "9-13", label: "9–13" },
  { value: "14-18", label: "14–18" },
  { value: "19-30", label: "19–30" },
  { value: "31-50", label: "31–50" },
  { value: "51-70", label: "51–70" },
  { value: "71+", label: "71+" },
];
const SEXES: Option<Sex>[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "unspecified", label: "Prefer not to say" },
];
const PREGNANCY: Option<Pregnancy>[] = [
  { value: "none", label: "Neither" },
  { value: "pregnant", label: "Pregnant" },
  { value: "breastfeeding", label: "Breastfeeding" },
];
const ACTIVITY: Option<Activity>[] = [
  { value: "sedentary", label: "Mostly sitting", hint: "Desk, classes, gaming", icon: "🪑" },
  { value: "light", label: "Lightly active", hint: "Walks, light chores", icon: "🚶" },
  { value: "active", label: "Active", hint: "Exercise 3–5 days a week", icon: "🏃" },
  { value: "very", label: "Very active", hint: "Hard training or physical work", icon: "🏋️" },
];
const CLIMATE: Option<Climate>[] = [
  { value: "cool", label: "Cool or air-conditioned", hint: "I rarely sweat", icon: "❄️" },
  { value: "warm", label: "Warm", hint: "Sometimes sweaty", icon: "⛅" },
  { value: "hot", label: "Hot and humid", hint: "I sweat most days", icon: "☀️" },
];
const SERVINGS: Option<number>[] = [
  { value: 150, label: "150 ml", hint: "Small cup" },
  { value: 250, label: "250 ml", hint: "A glass" },
  { value: 350, label: "350 ml", hint: "Mug or can" },
  { value: 500, label: "500 ml", hint: "Small bottle" },
];

const STEPS = ["intro", "age", "sex", "weight", "activity", "climate", "hours", "serving", "health", "result"] as const;

function hourLabel(h: number) {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function Choices<T extends string | number>({
  options,
  value,
  onPick,
  cards = false,
}: {
  options: Option<T>[];
  value: T;
  onPick: (v: T) => void;
  cards?: boolean;
}) {
  return (
    <div className={cards ? "choices cards" : "choices"} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? "choice on" : "choice"}
          onClick={() => onPick(o.value)}
        >
          {o.icon && (
            <span className="choice-icon" aria-hidden>
              {o.icon}
            </span>
          )}
          <span className="choice-text">
            <span className="choice-label">{o.label}</span>
            {o.hint && <span className="choice-hint">{o.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/** First run (and "retake"): a short hydration check that sets up Tumbli for this person. */
export function Welcome({ initial, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(() =>
    loadProfile({ ...defaultProfile, startHour: initial.startHour, endHour: initial.endHour }),
  );
  const [weightOn, setWeightOn] = useState(p.weightKg !== null);
  const [autostart, setAutostart] = useState(true);
  const [busy, setBusy] = useState(false);

  const plan = useMemo(() => planFor(p), [p]);
  // the result screen can fine-tune what the check suggested
  const [tweak, setTweak] = useState<{ goal?: number; intervalMin?: number }>({});
  const goal = tweak.goal ?? plan.goal;
  const intervalMin = tweak.intervalMin ?? plan.intervalMin;

  const set = (patch: Partial<Profile>) => {
    setP((cur) => ({ ...cur, ...patch }));
    setTweak({});
  };
  const name = STEPS[step];
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = async () => {
    setBusy(true);
    saveProfile(p);
    const s: Settings = {
      ...initial,
      goal,
      glassMl: plan.servingMl,
      intervalMin,
      startHour: plan.startHour,
      endHour: plan.endHour,
    };
    saveSettings(s);
    // dev builds never register themselves to start with Windows
    if (autostart && !import.meta.env.DEV) {
      try {
        await applyAutostart(true);
      } catch {
        // not fatal: it can be switched on later in settings
      }
    }
    markOnboarded();
    onDone(s);
  };

  const question = (title: string, sub: string | null, body: ReactNode) => (
    <>
      <h1>{title}</h1>
      {sub && <p className="muted">{sub}</p>}
      <div className="step-body">{body}</div>
    </>
  );

  let content: ReactNode;
  switch (name) {
    case "intro":
      content = (
        <>
          <h1>Hi, I'm Tumbli!</h1>
          <p className="muted">
            I'll float on your screen and remind you to drink water. Answer a few quick questions and I'll set a goal
            that fits you.
          </p>
          <p className="muted small">Takes about 30 seconds. Your answers stay on this PC.</p>
        </>
      );
      break;
    case "age":
      content = question(
        "How old are you?",
        null,
        <Choices options={AGES} value={p.ageGroup} onPick={(v) => set({ ageGroup: v })} />,
      );
      break;
    case "sex":
      content = question(
        "What's your sex?",
        "Bodies need slightly different amounts of water.",
        <>
          <Choices options={SEXES} value={p.sex} onPick={(v) => set({ sex: v })} />
          {canBePregnant(p) && (
            <>
              <p className="muted sub-q">Are you pregnant or breastfeeding?</p>
              <Choices options={PREGNANCY} value={p.pregnancy} onPick={(v) => set({ pregnancy: v })} />
            </>
          )}
        </>,
      );
      break;
    case "weight":
      content = question(
        "How much do you weigh?",
        "This makes the goal more accurate. You can skip it.",
        <div className="weight">
          {weightOn ? (
            <>
              <div className="weight-value">
                <b>{p.weightKg ?? 60}</b> kg
              </div>
              <input
                type="range"
                min={25}
                max={150}
                step={1}
                value={p.weightKg ?? 60}
                aria-label="Weight in kilograms"
                onChange={(e) => set({ weightKg: Number(e.target.value) })}
              />
              <button
                className="link"
                onClick={() => {
                  setWeightOn(false);
                  set({ weightKg: null });
                }}
              >
                Skip this
              </button>
            </>
          ) : (
            <button
              className="choice"
              onClick={() => {
                setWeightOn(true);
                set({ weightKg: 60 });
              }}
            >
              <span className="choice-label">Add my weight</span>
            </button>
          )}
        </div>,
      );
      break;
    case "activity":
      content = question(
        "How active are you?",
        null,
        <Choices cards options={ACTIVITY} value={p.activity} onPick={(v) => set({ activity: v })} />,
      );
      break;
    case "climate":
      content = question(
        "What's it like where you are?",
        "Heat and sweat use up more water.",
        <Choices cards options={CLIMATE} value={p.climate} onPick={(v) => set({ climate: v })} />,
      );
      break;
    case "hours":
      content = question(
        "When are you usually at your computer?",
        "I'll only remind you during these hours.",
        <div className="hours big">
          <select value={p.startHour} onChange={(e) => set({ startHour: Number(e.target.value) })} aria-label="Start">
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <span>to</span>
          <select value={p.endHour} onChange={(e) => set({ endHour: Number(e.target.value) })} aria-label="End">
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </div>,
      );
      break;
    case "serving":
      content = question(
        "How much do you drink per break?",
        "Think of the cup or bottle on your desk.",
        <Choices cards options={SERVINGS} value={p.servingMl} onPick={(v) => set({ servingMl: v })} />,
      );
      break;
    case "health":
      content = question(
        "Has a doctor asked you to limit fluids?",
        "For example because of kidney or heart conditions.",
        <Choices
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
          value={p.fluidRestricted ? "yes" : "no"}
          onPick={(v) => set({ fluidRestricted: v === "yes" })}
        />,
      );
      break;
    case "result":
      content = (
        <>
          <h1>Your plan</h1>
          {plan.restricted ? (
            <p className="warn">Please follow your doctor's daily limit. Set the number of servings below to match it.</p>
          ) : (
            <>
              <div className="plan-total">
                <b>{((goal * plan.servingMl) / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L</b>
                <span className="muted">a day</span>
              </div>
              <ul className="reasons">
                {plan.reasons.map((r, i) => (
                  <li key={r.label}>
                    <span>{r.label}</span>
                    <span>
                      {i > 0 ? "+" : ""}
                      {r.ml.toLocaleString()} ml
                    </span>
                  </li>
                ))}
                <li className="reasons-total">
                  <span>Suggested {plan.totalMl.toLocaleString()} ml, in whole servings</span>
                  <span>
                    {goal} × {plan.servingMl} ml
                  </span>
                </li>
              </ul>
            </>
          )}
          <section className="card">
            <label className="row">
              <span>Daily goal</span>
              <span className="stepper">
                <button onClick={() => setTweak({ ...tweak, goal: Math.max(1, goal - 1) })} aria-label="Fewer">
                  −
                </button>
                <b>
                  {goal} × {plan.servingMl} ml
                </b>
                <button onClick={() => setTweak({ ...tweak, goal: Math.min(20, goal + 1) })} aria-label="More">
                  +
                </button>
              </span>
            </label>
            <label className="row">
              <span>Remind me every</span>
              <select
                value={intervalMin}
                onChange={(e) => setTweak({ ...tweak, intervalMin: Number(e.target.value) })}
              >
                {INTERVALS.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              <span>Active hours</span>
              <b>
                {hourLabel(plan.startHour)} – {hourLabel(plan.endHour)}
              </b>
            </div>
            <label className="row">
              <span>Start with Windows</span>
              <input type="checkbox" checked={autostart} onChange={(e) => setAutostart(e.target.checked)} />
            </label>
          </section>
          <p className="muted small">
            A general guide, not medical advice. Drink more on hot days or when you exercise, and listen to your thirst.
          </p>
        </>
      );
      break;
  }

  const last = name === "result";
  return (
    <main className="welcome">
      <div className="welcome-buddy">
        <Tumbler fill={step / (STEPS.length - 1)} size={last ? 96 : 110} arms happy={last} />
      </div>
      {step > 0 && (
        <div className="dots" aria-label={`Step ${step} of ${STEPS.length - 1}`}>
          {STEPS.slice(1).map((s, i) => (
            <span key={s} className={i < step ? "dot on" : "dot"} />
          ))}
        </div>
      )}
      <div className="step" key={name}>
        {content}
      </div>
      <div className="nav">
        {step > 0 && (
          <button className="secondary-btn" onClick={back}>
            Back
          </button>
        )}
        {last ? (
          <button className="primary-btn" onClick={() => void finish()} disabled={busy}>
            Let's go 💧
          </button>
        ) : (
          <button className="primary-btn" onClick={next}>
            {step === 0 ? "Start" : "Next"}
          </button>
        )}
      </div>
    </main>
  );
}
