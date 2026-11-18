import { useCallback, useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getAutostart, setAutostart as applyAutostart, type AutostartState } from "../lib/autostart";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Tumbler } from "../components/Tumbler";
import { Chips, HourRange, INTERVAL_CHIPS, SizePicker } from "../components/Controls";
import {
  IconBottle,
  IconBulb,
  IconDrop,
  IconFlame,
  IconGlass,
  IconPlus,
  IconQuestion,
  IconRefill,
  IconTrophy,
  IconUndo,
} from "../components/Icons";
import { Welcome } from "./Welcome";
import { Feedback } from "./Feedback";
import { factOfTheDay, greeting } from "../lib/facts";
import { sipFor } from "../lib/schedule";
import {
  canUndo,
  CHANGED_EVENT,
  drink,
  finishTumbler,
  fmtMl,
  GLASS_SIZES,
  loadShortcutStatus,
  SHORTCUTS,
  shortcutLabel,
  goalGlasses,
  liters,
  loadLevel,
  refill,
  TUMBLER_SIZES,
  undoLast,
  dayKey,
  isOnboarded,
  isTourDone,
  TOUR_EVENT,
  lastDays,
  loadHistory,
  loadSettings,
  resetOnboarding,
  resetToday,
  saveSettings,
  streak,
  type History,
  type Settings as SettingsT,
} from "../lib/store";

const TUMBLER_HINTS: Record<number, string> = {
  350: "Mini",
  500: "Small bottle",
  650: "Classic",
  750: "Sport bottle",
  1000: "Big bottle",
  1200: "40 oz tumbler",
};
const GLASS_HINTS: Record<number, string> = { 150: "Small cup", 250: "A glass", 350: "Mug", 500: "Big glass" };

export function Settings() {
  const [s, setS] = useState<SettingsT>(loadSettings);
  const [history, setHistory] = useState<History>(loadHistory);
  const [autostart, setAutostart] = useState<AutostartState | null>(null);
  const [onboarded, setOnboarded] = useState(isOnboarded);
  const [view, setView] = useState<"dashboard" | "feedback">(() =>
    import.meta.env.DEV && new URLSearchParams(location.search).has("feedback") ? "feedback" : "dashboard",
  );
  // re-render after actions that only touch the tumbler level
  const [, bump] = useState(0);

  // first run: this window starts hidden, so bring it up for the welcome screen
  useEffect(() => {
    if (onboarded) return;
    const w = getCurrentWindow();
    void w.show().then(() => w.setFocus());
  }, [onboarded]);

  const refresh = useCallback(() => {
    setS(loadSettings());
    setHistory(loadHistory());
  }, []);

  // a new day starts at 12:00 AM: re-read so "today" goes back to 0 even if this window stays open
  useEffect(() => {
    let day = dayKey();
    const id = window.setInterval(() => {
      if (dayKey() !== day) {
        day = dayKey();
        refresh();
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const un = listen(CHANGED_EVENT, refresh);
    const fb = listen("tumbli:feedback", () => setView("feedback"));
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    getAutostart()
      .then(setAutostart)
      .catch(() => setAutostart({ enabled: false, blockedByUser: false }));
    return () => {
      void un.then((f) => f());
      void fb.then((f) => f());
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const update = (patch: Partial<SettingsT>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
  };

  /** hand over to Tumbli on the desktop for the quick tour */
  const startTour = async () => {
    await emit(TOUR_EVENT);
    await getCurrentWindow().hide();
  };

  const toggleAutostart = async (on: boolean) => {
    try {
      setAutostart(await applyAutostart(on));
    } catch {
      setAutostart(await getAutostart().catch(() => ({ enabled: false, blockedByUser: false })));
    }
  };

  if (!onboarded) {
    return (
      <Welcome
        initial={s}
        onDone={(next) => {
          setS(next);
          setOnboarded(true);
          void getAutostart().then(setAutostart).catch(() => {});
          if (!isTourDone()) void startTour();
        }}
      />
    );
  }

  if (view === "feedback") return <Feedback settings={s} onBack={() => setView("dashboard")} />;

  const tumblerMode = s.mode === "tumbler";
  const doneMl = lastDays(history, 1)[0].ml;
  const week = lastDays(history, 7);
  const days = streak(history, s.goalMl);
  const maxBar = Math.max(s.goalMl, ...week.map((d) => d.ml));
  const metThisWeek = week.filter((d) => d.ml >= s.goalMl).length;
  const leftMl = Math.max(0, s.goalMl - doneMl);
  const pct = Math.min(100, Math.round((doneMl / s.goalMl) * 100));
  const glasses = Math.floor(doneMl / s.glassMl);
  const goalG = goalGlasses(s);
  const level = loadLevel(s);
  const sip = sipFor(s);
  const fact = factOfTheDay();
  const act = (f: () => unknown) => {
    f();
    bump((n) => n + 1);
  };

  return (
    <main className="settings">
      <header className="hero">
        <div className="hero-buddy">
          <Tumbler
            fill={tumblerMode ? level / s.tumblerMl : doneMl / s.goalMl}
            size={104}
            happy={doneMl >= s.goalMl}
            arms
          />
        </div>
        <div className="hero-main">
          <div className="hello">{greeting(s.name)}</div>
          <div className="big">
            {tumblerMode ? (
              <>
                {liters(doneMl)}
                <span> of {liters(s.goalMl)} L</span>
              </>
            ) : (
              <>
                {glasses}
                <span> of {goalG} glasses</span>
              </>
            )}
          </div>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="muted">
            {tumblerMode ? `Tumbler: ${fmtMl(level)} of ${fmtMl(s.tumblerMl)} left` : `${fmtMl(doneMl)} so far`}
            {leftMl > 0 ? ` · ${fmtMl(leftMl)} to go` : " · goal reached! 🎉"}
          </div>
          <div className="hero-actions">
            {tumblerMode ? (
              <>
                <button className="pill primary" onClick={() => act(() => drink(sip, s))} disabled={level <= 0}>
                  <IconPlus size={15} strokeWidth={2.6} /> {sip} ml
                </button>
                <button className="pill" onClick={() => act(() => finishTumbler(s))} disabled={level <= 0}>
                  Finished it
                </button>
                <button className="pill" onClick={() => act(() => refill(s))}>
                  <IconRefill size={15} /> Refilled
                </button>
              </>
            ) : (
              <button className="pill primary" onClick={() => act(() => drink(s.glassMl, s))}>
                <IconPlus size={15} strokeWidth={2.6} /> Log a glass
              </button>
            )}
            <button className="pill" onClick={() => act(undoLast)} disabled={!canUndo()} aria-label="Undo">
              <IconUndo size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <span className="stat-icon flame" aria-hidden>
            <IconFlame size={18} />
          </span>
          <b>{days}</b>
          <span>day streak</span>
        </div>
        <div className="stat">
          <span className="stat-icon trophy" aria-hidden>
            <IconTrophy size={18} />
          </span>
          <b>{metThisWeek}/7</b>
          <span>goals this week</span>
        </div>
        <div className="stat">
          <span className="stat-icon" aria-hidden>
            {tumblerMode ? <IconBottle size={18} /> : <IconDrop size={18} />}
          </span>
          <b>
            {tumblerMode
              ? (doneMl / s.tumblerMl).toLocaleString(undefined, { maximumFractionDigits: 1 })
              : fmtMl(s.goalMl)}
          </b>
          <span>{tumblerMode ? "tumblers today" : "daily plan"}</span>
        </div>
      </div>

      <section className="card">
        <h2>This week</h2>
        <div className="bars">
          {week.map((d, i) => (
            <div className="bar-col" key={d.key}>
              <div className="bar-track">
                <div
                  className={`bar ${d.ml >= s.goalMl ? "met" : ""} ${i === week.length - 1 ? "today" : ""}`}
                  style={{ height: `${Math.max(3, (d.ml / maxBar) * 100)}%` }}
                />
                <div className="goal-line" style={{ bottom: `${(s.goalMl / maxBar) * 100}%` }} />
              </div>
              <div className="bar-num">{liters(d.ml)}</div>
              <div className="bar-label">{d.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card fact-card">
        <span className="fact-icon" aria-hidden>
          {fact.kind === "trivia" ? <IconQuestion size={20} /> : <IconBulb size={20} />}
        </span>
        <div className="fact-kicker">{fact.kind === "trivia" ? "Trivia of the day" : "Fact of the day"}</div>
        <div className="fact-body">{fact.kind === "trivia" ? fact.q : fact.text}</div>
        {fact.kind === "trivia" && <div className="muted small">Answer: {fact.a}</div>}
        <div className="muted small">Tip: click Tumbli on your desktop for more.</div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Your plan</h2>
          <button
            className="link"
            onClick={() => {
              resetOnboarding();
              setOnboarded(false);
            }}
          >
            Retake hydration check
          </button>
        </div>

        <label className="row">
          <span>Your name</span>
          <input
            className="text-input"
            type="text"
            maxLength={30}
            placeholder="Add your name"
            value={s.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>

        <div className="row">
          <span>
            Track by
            <small>{tumblerMode ? "Tumbli mirrors your own tumbler" : "Log a glass at a time"}</small>
          </span>
          <span className="seg" role="radiogroup" aria-label="Track by">
            <button role="radio" aria-checked={!tumblerMode} className={!tumblerMode ? "on" : ""} onClick={() => update({ mode: "glass" })}>
              <IconGlass size={16} /> Glass
            </button>
            <button role="radio" aria-checked={tumblerMode} className={tumblerMode ? "on" : ""} onClick={() => update({ mode: "tumbler" })}>
              <IconBottle size={16} /> Tumbler
            </button>
          </span>
        </div>

        <div className="row stack">
          <span className="row-label">{tumblerMode ? "Tumbler size" : "Glass size"}</span>
          {tumblerMode ? (
            <SizePicker
              kind="tumbler"
              sizes={TUMBLER_SIZES.map((ml) => ({ ml, hint: TUMBLER_HINTS[ml] ?? "" }))}
              value={s.tumblerMl}
              onChange={(ml) => update({ tumblerMl: ml })}
            />
          ) : (
            <SizePicker
              kind="glass"
              sizes={GLASS_SIZES.filter((ml) => ml !== 200 && ml !== 300).map((ml) => ({ ml, hint: GLASS_HINTS[ml] ?? "" }))}
              value={s.glassMl}
              // keep the same number of glasses when the glass size changes
              onChange={(glassMl) => update({ glassMl, goalMl: goalG * glassMl })}
            />
          )}
        </div>

        <div className="row">
          <span>Daily goal</span>
          <span className="stepper">
            <button
              onClick={() =>
                update({ goalMl: tumblerMode ? Math.max(500, s.goalMl - 100) : Math.max(1, goalG - 1) * s.glassMl })
              }
              aria-label="Lower goal"
            >
              −
            </button>
            <b>{tumblerMode ? fmtMl(s.goalMl) : `${goalG} glasses`}</b>
            <button
              onClick={() =>
                update({ goalMl: tumblerMode ? Math.min(5000, s.goalMl + 100) : Math.min(20, goalG + 1) * s.glassMl })
              }
              aria-label="Raise goal"
            >
              +
            </button>
          </span>
        </div>

        <div className="row stack">
          <span className="row-label">Remind me every</span>
          <Chips
            label="Remind me every"
            options={INTERVAL_CHIPS}
            value={s.intervalMin}
            onChange={(v) => update({ intervalMin: v })}
          />
        </div>

        <div className="row stack">
          <span className="row-label">Active hours</span>
          <HourRange start={s.startHour} end={s.endHour} onChange={(a, b) => update({ startHour: a, endHour: b })} />
        </div>
      </section>

      <section className="card">
        <h2>Behavior</h2>
        <label className="row">
          <span>Play a sound</span>
          <input
            className="switch"
            type="checkbox"
            checked={s.sound}
            onChange={(e) => update({ sound: e.target.checked })}
          />
        </label>
        <label className="row">
          <span>
            Hide during fullscreen
            <small>Games, videos and presentations</small>
          </span>
          <input
            className="switch"
            type="checkbox"
            checked={s.hideOnFullscreen}
            onChange={(e) => update({ hideOnFullscreen: e.target.checked })}
          />
        </label>
        <div className="row stack">
          <div className="row-inline">
            <span className="row-label">
              Quick log shortcut
              <small>Log a drink from any app, without touching the mouse</small>
            </span>
            <input
              className="switch"
              type="checkbox"
              checked={s.shortcutOn}
              onChange={(e) => update({ shortcutOn: e.target.checked })}
              aria-label="Quick log shortcut"
            />
          </div>
          {s.shortcutOn && (
            <>
              <Chips
                label="Shortcut"
                options={SHORTCUTS.map((v) => ({ value: v, label: shortcutLabel(v) }))}
                value={s.shortcut}
                onChange={(v) => update({ shortcut: v })}
              />
              {loadShortcutStatus() === "taken" && (
                <small className="warn-text" title={localStorage.getItem("tumbli.shortcutError") ?? ""}>
                  Another app is using {shortcutLabel(s.shortcut)}. Pick a different one.
                </small>
              )}
            </>
          )}
        </div>
        <label className="row">
          <span>
            Start with Windows
            {autostart?.blockedByUser && <small>Turned off in Windows Settings › Apps › Startup</small>}
          </span>
          <input
            className="switch"
            type="checkbox"
            disabled={autostart === null || autostart.blockedByUser}
            checked={!!autostart?.enabled}
            onChange={(e) => void toggleAutostart(e.target.checked)}
          />
        </label>
      </section>

      <footer>
        <button
          className="link"
          onClick={() => {
            if (confirm("Reset today's total to 0?")) resetToday();
          }}
        >
          Reset today
        </button>
        <button className="link" onClick={() => void startTour()}>
          Take the quick tour
        </button>
        <button className="link" onClick={() => setView("feedback")}>
          Send feedback
        </button>
        <span className="muted small">Closing this window keeps Tumbli running. Quit from the tray icon.</span>
      </footer>
    </main>
  );
}
