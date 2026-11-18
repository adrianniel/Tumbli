import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Tumbler } from "../components/Tumbler";
import { Welcome } from "./Welcome";
import {
  addGlasses,
  CHANGED_EVENT,
  isOnboarded,
  lastDays,
  loadHistory,
  loadSettings,
  resetToday,
  saveSettings,
  streak,
  type History,
  type Settings as SettingsT,
} from "../lib/store";

function hourLabel(h: number) {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

export function Settings() {
  const [s, setS] = useState<SettingsT>(loadSettings);
  const [history, setHistory] = useState<History>(loadHistory);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [onboarded, setOnboarded] = useState(isOnboarded);

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

  useEffect(() => {
    const un = listen(CHANGED_EVENT, refresh);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    isEnabled()
      .then(setAutostart)
      .catch(() => setAutostart(false));
    return () => {
      void un.then((f) => f());
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const update = (patch: Partial<SettingsT>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
  };

  const toggleAutostart = async (on: boolean) => {
    try {
      if (on) await enable();
      else await disable();
      setAutostart(await isEnabled());
    } catch {
      setAutostart(await isEnabled().catch(() => false));
    }
  };

  if (!onboarded) {
    return (
      <Welcome
        initial={s}
        onDone={(next) => {
          setS(next);
          setOnboarded(true);
          void isEnabled().then(setAutostart).catch(() => {});
        }}
      />
    );
  }

  const today = lastDays(history, 1)[0].count;
  const week = lastDays(history, 7);
  const days = streak(history, s.goal);
  const maxBar = Math.max(s.goal, ...week.map((d) => d.count));

  return (
    <main className="settings">
      <header className="hero">
        <Tumbler fill={today / s.goal} size={88} happy={today >= s.goal} />
        <div>
          <h1>Tumbli</h1>
          <div className="big">
            {today} <span>/ {s.goal} glasses</span>
          </div>
          <div className="muted">
            {(today * s.glassMl).toLocaleString()} ml today
            {days > 0 && <> · 🔥 {days}-day streak</>}
          </div>
        </div>
        <div className="today-actions">
          <button onClick={() => addGlasses(1)} title="Add a glass">
            +
          </button>
          <button onClick={() => addGlasses(-1)} title="Remove a glass" disabled={today === 0}>
            −
          </button>
        </div>
      </header>

      <section className="card">
        <h2>Last 7 days</h2>
        <div className="bars">
          {week.map((d) => (
            <div className="bar-col" key={d.key}>
              <div className="bar-track">
                <div
                  className={`bar ${d.count >= s.goal ? "met" : ""}`}
                  style={{ height: `${(d.count / maxBar) * 100}%` }}
                />
                <div className="goal-line" style={{ bottom: `${(s.goal / maxBar) * 100}%` }} />
              </div>
              <div className="bar-num">{d.count}</div>
              <div className="bar-label">{d.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Reminders</h2>

        <label className="row">
          <span>Daily goal</span>
          <span className="stepper">
            <button onClick={() => update({ goal: Math.max(1, s.goal - 1) })}>−</button>
            <b>{s.goal} glasses</b>
            <button onClick={() => update({ goal: Math.min(20, s.goal + 1) })}>+</button>
          </span>
        </label>

        <label className="row">
          <span>Glass size</span>
          <select value={s.glassMl} onChange={(e) => update({ glassMl: Number(e.target.value) })}>
            {[150, 200, 250, 300, 350, 500].map((ml) => (
              <option key={ml} value={ml}>
                {ml} ml
              </option>
            ))}
          </select>
        </label>

        <label className="row">
          <span>Remind me every</span>
          <select
            value={s.intervalMin}
            onChange={(e) => update({ intervalMin: Number(e.target.value) })}
          >
            {[15, 20, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}
              </option>
            ))}
          </select>
        </label>

        <label className="row">
          <span>Active hours</span>
          <span className="hours">
            <select value={s.startHour} onChange={(e) => update({ startHour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            to
            <select value={s.endHour} onChange={(e) => update({ endHour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </span>
        </label>
      </section>

      <section className="card">
        <h2>Behavior</h2>
        <label className="row">
          <span>Play a sound</span>
          <input type="checkbox" checked={s.sound} onChange={(e) => update({ sound: e.target.checked })} />
        </label>
        <label className="row">
          <span>
            Hide during fullscreen
            <small>Games, videos and presentations</small>
          </span>
          <input
            type="checkbox"
            checked={s.hideOnFullscreen}
            onChange={(e) => update({ hideOnFullscreen: e.target.checked })}
          />
        </label>
        <label className="row">
          <span>Start with Windows</span>
          <input
            type="checkbox"
            disabled={autostart === null}
            checked={!!autostart}
            onChange={(e) => void toggleAutostart(e.target.checked)}
          />
        </label>
      </section>

      <footer>
        <button
          className="link"
          onClick={() => {
            if (confirm("Reset today's count to 0?")) resetToday();
          }}
        >
          Reset today
        </button>
        <span className="muted">Closing this window keeps Tumbli running. Quit from the tray icon.</span>
      </footer>
    </main>
  );
}
