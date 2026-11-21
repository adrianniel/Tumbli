import { useMemo, useRef, useState, type ReactNode } from "react";
import { Tumbler } from "../components/Tumbler";
import { Intro } from "./Intro";
import { AUTO_CHIP, Chips, HourRange, REMIND_CHIPS, SizePicker } from "../components/Controls";
import {
  IconBottle,
  IconChair,
  IconCheck,
  IconChevronLeft,
  IconCloudSun,
  IconDumbbell,
  IconGlass,
  IconRun,
  IconSnow,
  IconSun,
  IconWalk,
} from "../components/Icons";
import { setAutostart as applyAutostart } from "../lib/autostart";
import {
  canBePregnant,
  defaultProfile,
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

type Option<T> = { value: T; label: string; hint?: string; icon?: ReactNode };

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
  { value: "sedentary", label: "Mostly sitting", hint: "Desk, classes, gaming", icon: <IconChair /> },
  { value: "light", label: "Lightly active", hint: "Walks, light chores", icon: <IconWalk /> },
  { value: "active", label: "Active", hint: "Exercise 3–5 days a week", icon: <IconRun /> },
  { value: "very", label: "Very active", hint: "Hard training or physical work", icon: <IconDumbbell /> },
];
const CLIMATE: Option<Climate>[] = [
  { value: "cool", label: "Cool or air-conditioned", hint: "I rarely sweat", icon: <IconSnow /> },
  { value: "warm", label: "Warm", hint: "Sometimes sweaty", icon: <IconCloudSun /> },
  { value: "hot", label: "Hot and humid", hint: "I sweat most days", icon: <IconSun /> },
];
const MODES: Option<"glass" | "tumbler">[] = [
  { value: "glass", label: "By the glass", hint: "I fill a glass or cup each time", icon: <IconGlass /> },
  { value: "tumbler", label: "From my tumbler", hint: "I keep a bottle or tumbler on my desk", icon: <IconBottle /> },
];
const GLASSES = [
  { ml: 150, hint: "Small cup" },
  { ml: 250, hint: "A glass" },
  { ml: 350, hint: "Mug" },
  { ml: 500, hint: "Big glass" },
];
const TUMBLERS = [
  { ml: 350, hint: "Mini" },
  { ml: 500, hint: "Small bottle" },
  { ml: 650, hint: "Classic" },
  { ml: 750, hint: "Sport bottle" },
  { ml: 1000, hint: "Big bottle" },
  { ml: 1200, hint: "40 oz tumbler" },
];
const HEALTH: Option<string>[] = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

const STEPS = ["intro", "name", "age", "sex", "weight", "activity", "climate", "hours", "mode", "size", "health", "result"] as const;
type StepName = (typeof STEPS)[number];

function hourLabel(h: number) {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function Choices<T extends string | number>({
  options,
  value,
  onPick,
  layout = "grid",
}: {
  options: Option<T>[];
  value: T;
  onPick: (v: T) => void;
  layout?: "grid" | "grid2" | "list" | "tiles";
}) {
  return (
    <div className={`choices ${layout}`} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={on}
            className={on ? "choice on" : "choice"}
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
            <span className="choice-check" aria-hidden>
              <IconCheck size={13} strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** First run (and "retake"): a short hydration check that sets up Tumbli for this person. */
export function Welcome({ initial, onDone }: Props) {
  // dev preview: settings.html?fresh&step=hours jumps straight to a step
  const [step, setStep] = useState(() => {
    if (!import.meta.env.DEV) return 0;
    const want = new URLSearchParams(location.search).get("step");
    return Math.max(0, STEPS.indexOf(want as StepName));
  });
  const [p, setP] = useState<Profile>(() =>
    loadProfile({ ...defaultProfile, startHour: initial.startHour, endHour: initial.endHour }),
  );
  const [weightOn, setWeightOn] = useState(p.weightKg !== null);
  const [name, setName] = useState(initial.name ?? "");
  const [autostart, setAutostart] = useState(true);
  const [busy, setBusy] = useState(false);
  const advanceTimer = useRef<number | undefined>(undefined);

  const plan = useMemo(() => planFor(p), [p]);
  // the result screen can fine-tune what the check suggested
  const [tweak, setTweak] = useState<{ goalMl?: number; intervalMin?: number; auto?: boolean }>({});
  const tumblerMode = p.mode === "tumbler";
  // glass mode: whole glasses; tumbler mode: liters in 100 ml steps
  const suggestedMl = tumblerMode
    ? Math.round(plan.totalMl / 100) * 100
    : Math.max(1, Math.round(plan.totalMl / p.glassMl)) * p.glassMl;
  const goalMl = tweak.goalMl ?? suggestedMl;
  const glasses = Math.round(goalMl / p.glassMl);
  // new users start on Auto: Tumbli paces the reminders so the goal is reached in time
  const intervalMin = tweak.intervalMin ?? plan.intervalMin;
  const auto = tweak.auto ?? true;

  const stepName: StepName = STEPS[step];
  const total = STEPS.length - 1; // the intro doesn't count
  const first = name.trim();

  const set = (patch: Partial<Profile>) => {
    setP((cur) => ({ ...cur, ...patch }));
    setTweak({});
  };
  const next = () => {
    window.clearTimeout(advanceTimer.current);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => {
    window.clearTimeout(advanceTimer.current);
    setStep((s) => Math.max(0, s - 1));
  };
  /** pick an answer and move on after a short beat, so the choice can be seen */
  const pickAndGo = (patch: Partial<Profile>) => {
    set(patch);
    window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(next, 320);
  };

  const finish = async () => {
    setBusy(true);
    saveProfile(p);
    const s: Settings = {
      ...initial,
      name: first.slice(0, 30),
      mode: p.mode,
      glassMl: p.glassMl,
      tumblerMl: p.tumblerMl,
      goalMl,
      intervalMin,
      autoInterval: auto,
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

  // what Tumbli says above each question
  const SAYS: Record<StepName, string> = {
    intro: "",
    name: "First things first…",
    age: first ? `Nice to meet you, ${first}!` : "Nice to meet you!",
    sex: "This helps me get the amount right.",
    weight: "No pressure, you can skip this one.",
    activity: "Moving around makes you thirstier.",
    climate: "Heat makes you sweat out water.",
    hours: "I'll stay quiet outside these hours.",
    mode: "How do you usually drink?",
    size: tumblerMode ? "Show me your tumbler!" : "What do you drink from?",
    health: "Last one, I promise!",
    result: "Here's your plan!",
  };

  const question = (title: string, sub: string | null, body: ReactNode) => (
    <>
      <h1>{title}</h1>
      {sub && <p className="sub">{sub}</p>}
      <div className="step-body">{body}</div>
    </>
  );

  // ---------- intro ----------
  if (stepName === "intro") return <Intro onStart={next} />;

  // ---------- questions ----------
  let content: ReactNode;
  switch (stepName) {
    case "name":
      content = question(
        "What should I call you?",
        "I'll use it when I say hi. You can leave it empty.",
        <input
          className="name-input"
          type="text"
          autoFocus
          maxLength={30}
          placeholder="Your name"
          aria-label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") next();
          }}
        />,
      );
      break;
    case "age":
      content = question(
        "How old are you?",
        null,
        <Choices options={AGES} value={p.ageGroup} onPick={(v) => pickAndGo({ ageGroup: v })} />,
      );
      break;
    case "sex":
      content = question(
        "What's your sex?",
        "Bodies need slightly different amounts of water.",
        <>
          <Choices
            layout="tiles"
            options={SEXES}
            value={p.sex}
            onPick={(v) =>
              // women get a follow-up question, so don't jump ahead
              canBePregnant({ ...p, sex: v }) ? set({ sex: v }) : pickAndGo({ sex: v, pregnancy: "none" })
            }
          />
          {canBePregnant(p) && (
            <div className="follow-up">
              <p className="sub">Are you pregnant or breastfeeding?</p>
              <Choices options={PREGNANCY} value={p.pregnancy} onPick={(v) => pickAndGo({ pregnancy: v })} />
            </div>
          )}
        </>,
      );
      break;
    case "weight":
      content = question(
        "How much do you weigh?",
        "This makes the goal more accurate.",
        <div className="weight">
          {weightOn ? (
            <>
              <div className="weight-value">
                <button
                  className="round-btn"
                  aria-label="Less"
                  onClick={() => set({ weightKg: Math.max(25, (p.weightKg ?? 60) - 1) })}
                >
                  −
                </button>
                <span>
                  <b>{p.weightKg ?? 60}</b> kg
                </span>
                <button
                  className="round-btn"
                  aria-label="More"
                  onClick={() => set({ weightKg: Math.min(150, (p.weightKg ?? 60) + 1) })}
                >
                  +
                </button>
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
                I'd rather not say
              </button>
            </>
          ) : (
            <div className="weight-off">
              <p className="sub">Skipped. I'll use a typical amount for your age.</p>
              <button
                className="secondary-btn"
                onClick={() => {
                  setWeightOn(true);
                  set({ weightKg: 60 });
                }}
              >
                Add my weight
              </button>
            </div>
          )}
        </div>,
      );
      break;
    case "activity":
      content = question(
        "How active are you?",
        null,
        <Choices layout="list" options={ACTIVITY} value={p.activity} onPick={(v) => pickAndGo({ activity: v })} />,
      );
      break;
    case "climate":
      content = question(
        "What's the weather like where you are?",
        null,
        <Choices layout="list" options={CLIMATE} value={p.climate} onPick={(v) => pickAndGo({ climate: v })} />,
      );
      break;
    case "hours":
      content = question(
        "When are you usually at your computer?",
        null,
        <>
          <HourRange start={p.startHour} end={p.endHour} onChange={(a, b) => set({ startHour: a, endHour: b })} />
          <p className="fine hr-hint">Drag the dots to set your hours</p>
        </>,
      );
      break;
    case "mode":
      content = question(
        "How do you drink water?",
        "I'll track it the way you drink.",
        <Choices layout="list" options={MODES} value={p.mode} onPick={(v) => pickAndGo({ mode: v })} />,
      );
      break;
    case "size":
      content = tumblerMode
        ? question(
            "How big is your tumbler?",
            "I'll be your tumbler on screen: I empty as you drink, and you refill me.",
            <SizePicker kind="tumbler" sizes={TUMBLERS} value={p.tumblerMl} onChange={(v) => pickAndGo({ tumblerMl: v })} />,
          )
        : question(
            "How big is your glass?",
            null,
            <SizePicker kind="glass" sizes={GLASSES} value={p.glassMl} onChange={(v) => pickAndGo({ glassMl: v })} />,
          );
      break;
    case "health":
      content = question(
        "Has a doctor asked you to limit fluids?",
        "For example because of kidney or heart conditions.",
        <Choices
          layout="tiles"
          options={HEALTH}
          value={p.fluidRestricted ? "yes" : "no"}
          onPick={(v) => pickAndGo({ fluidRestricted: v === "yes" })}
        />,
      );
      break;
    case "result":
      content = (
        <>
          <h1>{first ? `${first}'s plan` : "Your plan"}</h1>
          {plan.restricted ? (
            <p className="warn">Please follow your doctor's daily limit. Set the number of servings below to match it.</p>
          ) : (
            <div className="plan-hero">
              <div className="plan-total">
                <b>{(goalMl / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
                <span>liters a day</span>
              </div>
              <div className="plan-equals">
                {tumblerMode
                  ? `≈ ${(goalMl / p.tumblerMl).toLocaleString(undefined, { maximumFractionDigits: 1 })} of your ${p.tumblerMl >= 1000 ? `${p.tumblerMl / 1000} L` : `${p.tumblerMl} ml`} tumbler`
                  : `${glasses} glasses of ${p.glassMl} ml`}
              </div>
              <div className="plan-chips">
                {plan.reasons.map((r, i) => (
                  <span className="chip" key={r.label}>
                    {r.label} <b>{i > 0 ? "+" : ""}{r.ml.toLocaleString()} ml</b>
                  </span>
                ))}
              </div>
            </div>
          )}
          <section className="card plan-settings">
            <div className="row">
              <span>Daily goal</span>
              <span className="stepper">
                <button
                  onClick={() =>
                    setTweak({
                      ...tweak,
                      goalMl: tumblerMode ? Math.max(500, goalMl - 100) : Math.max(1, glasses - 1) * p.glassMl,
                    })
                  }
                  aria-label="Less"
                >
                  −
                </button>
                <b>
                  {tumblerMode
                    ? `${(goalMl / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} L`
                    : `${glasses} × ${p.glassMl} ml`}
                </b>
                <button
                  onClick={() =>
                    setTweak({
                      ...tweak,
                      goalMl: tumblerMode ? Math.min(5000, goalMl + 100) : Math.min(20, glasses + 1) * p.glassMl,
                    })
                  }
                  aria-label="More"
                >
                  +
                </button>
              </span>
            </div>
            <div className="row stack">
              <span className="row-label">Remind me every</span>
              <Chips
                label="Remind me every"
                options={REMIND_CHIPS}
                value={auto ? AUTO_CHIP : intervalMin}
                onChange={(v) =>
                  setTweak(v === AUTO_CHIP ? { ...tweak, auto: true } : { ...tweak, auto: false, intervalMin: v })
                }
              />
            </div>
            <div className="row">
              <span>Active hours</span>
              <b>
                {hourLabel(plan.startHour)} – {hourLabel(plan.endHour)}
              </b>
            </div>
            <label className="row">
              <span>Start with Windows</span>
              <input
                className="switch"
                type="checkbox"
                checked={autostart}
                onChange={(e) => setAutostart(e.target.checked)}
              />
            </label>
          </section>
          <p className="fine">A general guide, not medical advice. Drink more on hot days or when you exercise.</p>
        </>
      );
      break;
  }

  const last = stepName === "result";
  const needsNext = ["name", "weight", "hours", "result"].includes(stepName) || (stepName === "sex" && canBePregnant(p));

  return (
    <main className="onb">
      <header className="onb-top">
        <button className="icon-btn" onClick={back} aria-label="Back">
          <IconChevronLeft size={20} />
        </button>
        <div className="onb-progress" aria-label={`Step ${step} of ${total}`}>
          <div style={{ width: `${(step / total) * 100}%` }} />
        </div>
        <span className="onb-count">
          {step}/{total}
        </span>
      </header>

      <div className="onb-buddy">
        <div className="onb-buddy-bottle">
          <Tumbler fill={step / total} size={last ? 60 : 72} arms happy={last} />
        </div>
        <div className="says" key={stepName}>
          {SAYS[stepName]}
        </div>
      </div>

      <div className="step" key={stepName}>
        {content}
      </div>

      <footer className="onb-nav">
        {last ? (
          <button className="primary-btn" onClick={() => void finish()} disabled={busy}>
            Start drinking
          </button>
        ) : needsNext ? (
          <button className="primary-btn" onClick={next}>
            {stepName === "name" && !first ? "Skip" : "Continue"}
          </button>
        ) : (
          <p className="fine">Tap an answer to continue</p>
        )}
      </footer>
    </main>
  );
}
