import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  availableMonitors,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  primaryMonitor,
} from "@tauri-apps/api/window";
import { Tumbler } from "../components/Tumbler";
import { bloop } from "../lib/sound";
import { shouldNudge } from "../lib/schedule";
import { nudgeMessage, randomFact, type Fact } from "../lib/facts";
import {
  addGlasses,
  CHANGED_EVENT,
  loadHistory,
  loadPausedUntil,
  loadSettings,
  pauseEnd,
  savePausedUntil,
  streak,
  todayCount,
  type Settings,
} from "../lib/store";

const COMPACT = { w: 100, h: 140 };
const EXPANDED = { w: 350, h: 240 };
const SNOOZE_MIN = 10;
const IDLE_SECS = 5 * 60; // user counts as "away" after 5 min without input
const TICK_MS = 5000;
const FACT_MS = 12_000; // a fact bubble closes by itself after this, unless hovered
const DRAG_PX = 4; // a press that moves less than this is a click
const POS_KEY = "tumbli.widget.anchor.v2"; // bottom-right corner, physical px

type SystemStatus = { idle_secs: number; busy: boolean };

const win = getCurrentWindow();

/** Resize while keeping the bottom-right corner where it is. */
async function resizeAnchored(w: number, h: number) {
  const sf = await win.scaleFactor();
  const pos = await win.outerPosition();
  const size = await win.outerSize();
  const right = pos.x + size.width;
  const bottom = pos.y + size.height;
  await win.setSize(new LogicalSize(w, h));
  await win.setPosition(new PhysicalPosition(right - Math.round(w * sf), bottom - Math.round(h * sf)));
}

async function placeInitially(reset = false) {
  const sf = await win.scaleFactor();
  const w = Math.round(COMPACT.w * sf);
  const h = Math.round(COMPACT.h * sf);
  await win.setSize(new LogicalSize(COMPACT.w, COMPACT.h));

  let anchor: { x: number; y: number } | null = null;
  if (!reset) {
    try {
      anchor = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
    } catch {
      anchor = null;
    }
    // ignore a saved spot that is no longer on any monitor
    if (anchor) {
      const a = anchor;
      const monitors = await availableMonitors();
      const onScreen = monitors.some((m) => {
        const wa = m.workArea;
        return (
          a.x - w >= wa.position.x - 8 &&
          a.y - h >= wa.position.y - 8 &&
          a.x <= wa.position.x + wa.size.width + 8 &&
          a.y <= wa.position.y + wa.size.height + 8
        );
      });
      if (!onScreen) anchor = null;
    }
  }
  if (!anchor) {
    const m = await primaryMonitor();
    if (m) {
      const margin = Math.round(24 * m.scaleFactor);
      anchor = {
        x: m.workArea.position.x + m.workArea.size.width - margin,
        y: m.workArea.position.y + m.workArea.size.height - margin,
      };
    } else {
      anchor = { x: 1200, y: 700 };
    }
  }
  await win.setPosition(new PhysicalPosition(anchor.x - w, anchor.y - h));
}

export function Widget() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [count, setCount] = useState(() => todayCount());
  const [nudging, setNudging] = useState(false);
  const [message, setMessage] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [gulping, setGulping] = useState(false);
  const [boing, setBoing] = useState(0); // bumps on every click to replay the animation
  const [fact, setFact] = useState<Fact | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [pausedUntil, setPausedUntil] = useState(loadPausedUntil);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // in `tauri dev` the first reminder comes after 15 s so the pop-up is easy to test
  const nextAt = useRef(Date.now() + (import.meta.env.DEV ? 15_000 : loadSettings().intervalMin * 60_000));
  const hidden = useRef(false);
  const lastDay = useRef(new Date().toDateString());
  const factTimer = useRef<number | undefined>(undefined);
  const hovering = useRef(false);

  const refresh = useCallback(() => {
    const s = loadSettings();
    setSettings(s);
    setCount(todayCount());
    setPausedUntil(loadPausedUntil());
  }, []);

  // first placement + show (resizing waits for this, or the two race)
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    (async () => {
      await placeInitially();
      await win.show();
      setPlaced(true);
    })();
  }, []);

  // remember where the user dragged the widget (bottom-right anchor)
  const userDragging = useRef(false);
  useEffect(() => {
    let t: number | undefined;
    const un = win.onMoved(() => {
      if (!userDragging.current) return; // ignore our own setPosition calls
      window.clearTimeout(t);
      t = window.setTimeout(async () => {
        userDragging.current = false;
        const pos = await win.outerPosition();
        const size = await win.outerSize();
        localStorage.setItem(POS_KEY, JSON.stringify({ x: pos.x + size.width, y: pos.y + size.height }));
      }, 400);
    });
    return () => {
      void un.then((f) => f());
    };
  }, []);

  // sync with the settings window and the tray menu
  useEffect(() => {
    const a = listen(CHANGED_EVENT, refresh);
    const c = listen<string>("tumbli:pause", (e) => {
      const until = e.payload === "resume" ? 0 : pauseEnd(e.payload === "day" ? "day" : "hour");
      savePausedUntil(until);
      setPausedUntil(until);
      setNudging(false);
      if (until === 0) nextAt.current = Date.now() + 60_000; // check in soon after resuming
    });
    const b = listen("tumbli:reset-position", async () => {
      localStorage.removeItem(POS_KEY);
      setNudging(false);
      setFact(null);
      await placeInitially(true);
      await win.show();
    });
    return () => {
      void a.then((f) => f());
      void b.then((f) => f());
      void c.then((f) => f());
    };
  }, [refresh]);

  // expand / collapse the window for the speech bubble
  const talking = nudging || fact !== null;
  useEffect(() => {
    if (!placed) return;
    const target = talking ? EXPANDED : COMPACT;
    void resizeAnchored(target.w, target.h);
  }, [talking, placed]);

  // reminder loop
  useEffect(() => {
    const id = window.setInterval(async () => {
      const now = new Date();

      // new day: counts come from history keyed by date, so just re-read
      if (now.toDateString() !== lastDay.current) {
        lastDay.current = now.toDateString();
        refresh();
      }

      setNowTick(Date.now());

      let status: SystemStatus = { idle_secs: 0, busy: false };
      try {
        status = await invoke<SystemStatus>("system_status");
      } catch {
        /* not fatal */
      }

      // step out of the way of fullscreen apps (games, videos, presentations)
      const shouldHide = settings.hideOnFullscreen && status.busy;
      if (shouldHide !== hidden.current) {
        hidden.current = shouldHide;
        if (shouldHide) await win.hide();
        else await win.show();
      }

      // away from the computer: don't nag; remind shortly after they return
      if (status.idle_secs >= IDLE_SECS) {
        nextAt.current = Math.max(nextAt.current, Date.now() + 60_000);
        return;
      }

      const due = shouldNudge({
        now,
        nextAt: nextAt.current,
        settings,
        count: todayCount(),
        busy: status.busy,
        pausedUntil: loadPausedUntil(),
      });

      if (due && !nudging) {
        setFact(null); // a reminder wins over a fun fact
        setMessage(nudgeMessage(settings.name));
        setNudging(true);
        if (settings.sound) bloop();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [settings, nudging, refresh]);

  // ---------- fun facts ----------

  const closeFact = useCallback(() => {
    window.clearTimeout(factTimer.current);
    setFact(null);
  }, []);

  const armFactTimer = useCallback(() => {
    window.clearTimeout(factTimer.current);
    factTimer.current = window.setTimeout(function tick() {
      if (hovering.current) factTimer.current = window.setTimeout(tick, 2000);
      else setFact(null);
    }, FACT_MS);
  }, []);

  const tellFact = useCallback(() => {
    setBoing((n) => n + 1);
    if (nudging) return; // during a reminder a click just makes Tumbli jump
    setFact(randomFact());
    setRevealed(false);
    armFactTimer();
  }, [nudging, armFactTimer]);

  useEffect(() => () => window.clearTimeout(factTimer.current), []);

  // ---------- actions ----------

  const drink = () => {
    const n = addGlasses(1);
    setCount(n);
    setNudging(false);
    setGulping(true);
    window.setTimeout(() => setGulping(false), 1100);
    nextAt.current = Date.now() + settings.intervalMin * 60_000;
    if (n === settings.goal) {
      setCelebrate(true);
      if (settings.sound) bloop();
      window.setTimeout(() => setCelebrate(false), 3500);
    }
  };

  const snooze = () => {
    setNudging(false);
    nextAt.current = Date.now() + SNOOZE_MIN * 60_000;
  };

  const skip = () => {
    setNudging(false);
    nextAt.current = Date.now() + settings.intervalMin * 60_000;
  };

  const openSettings = () => void invoke("open_settings");

  // ---------- click vs drag vs double-click on Tumbli ----------

  const press = useRef<{ x: number; y: number } | null>(null);
  const clickTimer = useRef<number | undefined>(undefined);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    press.current = { x: e.screenX, y: e.screenY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const p = press.current;
    if (!p) return;
    if (Math.abs(e.screenX - p.x) + Math.abs(e.screenY - p.y) > DRAG_PX) {
      press.current = null;
      userDragging.current = true;
      void win.startDragging();
    }
  };
  const onMouseUp = () => {
    if (!press.current) return;
    press.current = null;
    // wait a moment so a double-click can open settings instead
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(tellFact, 240);
  };
  const onDoubleClick = () => {
    window.clearTimeout(clickTimer.current);
    openSettings();
  };

  const fill = count / settings.goal;
  const done = count >= settings.goal;
  const days = streak(loadHistory(), settings.goal);
  const sleeping = pausedUntil > nowTick && !talking;

  return (
    <div
      className={[
        "widget",
        talking ? "expanded" : "compact",
        nudging ? "nudging" : "",
        gulping ? "gulping" : "",
        celebrate ? "celebrate" : "",
        sleeping ? "sleeping" : "",
        done ? "done" : "",
      ].join(" ")}
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
    >
      {nudging && (
        <div className="bubble-card" role="dialog" aria-label="Water reminder">
          <div className="bubble-kicker">💧 Reminder</div>
          <div className="nudge-title">{message}</div>
          <div className="nudge-sub">
            {count} of {settings.goal} glasses today
            {days > 0 && <> · 🔥 {days} day streak</>}
          </div>
          <div className="nudge-actions">
            <button className="btn primary" onClick={drink}>
              I drank!
            </button>
            <button className="btn" onClick={snooze}>
              {SNOOZE_MIN} min
            </button>
            <button className="btn ghost" onClick={skip} title="Skip this reminder" aria-label="Skip">
              ✕
            </button>
          </div>
        </div>
      )}

      {!nudging && fact && (
        <div className="bubble-card fact" role="dialog" aria-label={fact.kind === "trivia" ? "Trivia" : "Fun fact"}>
          <div className="bubble-head">
            <div className="bubble-kicker">{fact.kind === "trivia" ? "🤔 Trivia time" : "💡 Did you know?"}</div>
            <button className="close" onClick={closeFact} aria-label="Close">
              ✕
            </button>
          </div>
          {fact.kind === "fact" ? (
            <div className="fact-text">{fact.text}</div>
          ) : (
            <>
              <div className="fact-text">{fact.q}</div>
              {revealed && <div className="fact-answer">{fact.a}</div>}
            </>
          )}
          <div className="nudge-actions">
            {fact.kind === "trivia" && !revealed ? (
              <button
                className="btn primary"
                onClick={() => {
                  setRevealed(true);
                  armFactTimer();
                }}
              >
                Show answer
              </button>
            ) : (
              <button className="btn primary" onClick={tellFact}>
                Tell me another
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className="buddy"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => (press.current = null)}
        onDoubleClick={onDoubleClick}
        title="Click me for a fun fact · drag to move · double-click for settings"
      >
        <div className="hop">
          <div className={boing ? `boing boing-${boing % 2}` : "boing"}>
            <div className="bob">
              <div className="squish">
                <Tumbler
                  fill={fill}
                  size={talking ? 92 : 84}
                  happy={done && !talking}
                  arms
                  calling={talking}
                  sleeping={sleeping}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="ground" />
        <div className="count">
          {count}/{settings.goal}
        </div>
        {sleeping && (
          <div className="zzz" aria-hidden>
            <span>z</span>
            <span>z</span>
          </div>
        )}
        {gulping && <div className="plus-one">+1</div>}
        {celebrate && (
          <div className="sparkles" aria-hidden>
            <span>✦</span>
            <span>✦</span>
            <span>✦</span>
          </div>
        )}
      </div>

      {!talking && (
        <div className="hover-actions">
          <button className="mini plus" onClick={drink} title="I drank a glass" aria-label="I drank a glass">
            +
          </button>
          <button className="mini" onClick={openSettings} title="Settings" aria-label="Settings">
            ⚙
          </button>
        </div>
      )}
    </div>
  );
}
