import { useState } from "react";
import { enable } from "@tauri-apps/plugin-autostart";
import { Tumbler } from "../components/Tumbler";
import { markOnboarded, saveSettings, type Settings } from "../lib/store";

type Props = { initial: Settings; onDone: (s: Settings) => void };

/** First-run screen: Tumbli says hi and the user picks a goal. */
export function Welcome({ initial, onDone }: Props) {
  const [s, setS] = useState<Settings>(initial);
  const [autostart, setAutostart] = useState(true);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    saveSettings(s);
    // dev builds never register themselves to start with Windows
    if (autostart && !import.meta.env.DEV) {
      try {
        await enable();
      } catch {
        // not fatal: it can be switched on later in settings
      }
    }
    markOnboarded();
    onDone(s);
  };

  return (
    <main className="welcome">
      <div className="welcome-buddy">
        <Tumbler fill={0.35} size={120} arms />
      </div>
      <h1>Hi, I'm Tumbli!</h1>
      <p className="muted">
        I'll float on your screen and remind you to drink water while you work or study.
      </p>

      <section className="card">
        <label className="row">
          <span>Daily goal</span>
          <span className="stepper">
            <button onClick={() => setS({ ...s, goal: Math.max(1, s.goal - 1) })} aria-label="Fewer glasses">
              −
            </button>
            <b>{s.goal} glasses</b>
            <button onClick={() => setS({ ...s, goal: Math.min(20, s.goal + 1) })} aria-label="More glasses">
              +
            </button>
          </span>
        </label>
        <label className="row">
          <span>Glass size</span>
          <select value={s.glassMl} onChange={(e) => setS({ ...s, glassMl: Number(e.target.value) })}>
            {[150, 200, 250, 300, 350, 500].map((ml) => (
              <option key={ml} value={ml}>
                {ml} ml
              </option>
            ))}
          </select>
        </label>
        <label className="row">
          <span>Remind me every</span>
          <select value={s.intervalMin} onChange={(e) => setS({ ...s, intervalMin: Number(e.target.value) })}>
            {[30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}
              </option>
            ))}
          </select>
        </label>
        <label className="row">
          <span>Start with Windows</span>
          <input type="checkbox" checked={autostart} onChange={(e) => setAutostart(e.target.checked)} />
        </label>
      </section>

      <p className="muted small">
        That's {((s.goal * s.glassMl) / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L a day.
        Drag me anywhere, double-click me for settings.
      </p>

      <button className="primary-btn" onClick={() => void finish()} disabled={busy}>
        Let's go 💧
      </button>
    </main>
  );
}
