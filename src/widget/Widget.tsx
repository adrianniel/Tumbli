import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  availableMonitors,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,

} from "@tauri-apps/api/window";
import { Tumbler } from "../components/Tumbler";
import { TOUR } from "./tour";
import { bloop } from "../lib/sound";
import { shouldNudge, sipFor } from "../lib/schedule";
import { cheerFor, nudgeMessage, randomFact, type Fact } from "../lib/facts";
import { anchorOf, placeAt, snapToEdge, type Anchor, type Side } from "../lib/dock";
import {
  drink as logDrink,
  finishTumbler,
  fmtMl,
  goalGlasses,
  liters,
  loadLevel,
  refill,
  CHANGED_EVENT,
  markTourDone,
  TOUR_EVENT,
  loadHistory,
  loadPausedUntil,
  loadSettings,
  pauseEnd,
  savePausedUntil,
  streak,
  todayMl,
  type DrinkResult,
  type Settings,
} from "../lib/store";

const COMPACT = { w: 100, h: 140 };
const EXPANDED = { w: 350, h: 240 };
const CHEERING = { w: 300, h: 170 }; // room for the floating cheer text
const CHEER_MS = 2800;
const SNOOZE_MIN = 10;
const IDLE_SECS = 5 * 60; // user counts as "away" after 5 min without input
const TICK_MS = 5000;
const FACT_MS = 12_000; // a fact bubble closes by itself after this, unless hovered
const DRAG_PX = 4; // a press that moves less than this is a click
const POS_KEY = "tumbli.widget.anchor.v3"; // docked side + edge + bottom, physical px
const EDGE_MARGIN = 12; // logical px between the window and the screen edge (Tumbli has its own padding too)

type SystemStatus = { idle_secs: number; busy: boolean };

const win = getCurrentWindow();

let anchor: Anchor | null = null;

const workAreas = async () =>
  (await availableMonitors()).map((m) => ({
    x: m.workArea.position.x,
    y: m.workArea.position.y,
    w: m.workArea.size.width,
    h: m.workArea.size.height,
  }));

async function windowRect() {
  const pos = await win.outerPosition();
  const size = await win.outerSize();
  return { x: pos.x, y: pos.y, w: size.width, h: size.height };
}

/** Resize while keeping the docked edge and the bottom where they are. */
async function resizeAnchored(w: number, h: number) {
  const sf = await win.scaleFactor();
  const pw = Math.round(w * sf);
  const ph = Math.round(h * sf);
  const a = anchor ?? anchorOf(await windowRect(), "right");
  const at = placeAt(a, pw, ph);
  await win.setSize(new LogicalSize(w, h));
  await win.setPosition(new PhysicalPosition(at.x, at.y));
}

/** Slide to the nearest side edge after a drag, with a little gap. Returns the side. */
async function snapAfterDrag(): Promise<Side> {
  const sf = await win.scaleFactor();
  const from = await windowRect();
  const to = snapToEdge(from, await workAreas(), Math.round(EDGE_MARGIN * sf));
  const steps = 9;
  for (let i = 1; i <= steps; i++) {
    const t = 1 - Math.pow(1 - i / steps, 3); // ease-out
    await win.setPosition(
      new PhysicalPosition(Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t)),
    );
    await new Promise((r) => setTimeout(r, 16));
  }
  anchor = anchorOf(to, to.side);
  localStorage.setItem(POS_KEY, JSON.stringify(anchor));
  return to.side;
}

async function placeInitially(reset = false): Promise<Side> {
  const sf = await win.scaleFactor();
  const w = Math.round(COMPACT.w * sf);
  const h = Math.round(COMPACT.h * sf);
  await win.setSize(new LogicalSize(COMPACT.w, COMPACT.h));

  let saved: Anchor | null = null;
  if (!reset) {
    try {
      saved = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
    } catch {
      saved = null;
    }
  }
  const areas = await workAreas();
  const start = saved
    ? { ...placeAt(saved, w, h), w, h }
    : (() => {
        const a = areas[0] ?? { x: 0, y: 0, w: 1280, h: 720 };
        return { x: a.x + a.w - w, y: a.y + a.h - h, w, h };
      })();
  // snapping also pulls back a spot that is no longer on any monitor
  const to = areas.length
    ? snapToEdge(start, areas, Math.round(EDGE_MARGIN * sf))
    : { ...start, side: "right" as Side };
  anchor = anchorOf(to, to.side);
  await win.setPosition(new PhysicalPosition(to.x, to.y));
  return to.side;
}


export function Widget() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [doneMl, setDoneMl] = useState(() => todayMl());
  const [level, setLevel] = useState(() => loadLevel()); // ml left in the tumbler (tumbler mode)
  const [lastDrank, setLastDrank] = useState(0);
  const [nudging, setNudging] = useState(false);
  const [message, setMessage] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [gulping, setGulping] = useState(false);
  const [boing, setBoing] = useState(0); // bumps on every click to replay the animation
  const [fact, setFact] = useState<Fact | null>(null);
  const [cheer, setCheer] = useState<{ text: string; id: number } | null>(null);
  const [tour, setTour] = useState<number | null>(null); // step of the quick tour, if running
  const touring = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const [pausedUntil, setPausedUntil] = useState(loadPausedUntil);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [side, setSide] = useState<Side>("right");

  // in `tauri dev` the first reminder comes after 15 s so the pop-up is easy to test
  const nextAt = useRef(Date.now() + (import.meta.env.DEV ? 15_000 : loadSettings().intervalMin * 60_000));
  const hidden = useRef(false);
  const lastDay = useRef(new Date().toDateString());
  const factTimer = useRef<number | undefined>(undefined);
  const hovering = useRef(false);

  const refresh = useCallback(() => {
    const s = loadSettings();
    setSettings(s);
    setDoneMl(todayMl());
    setLevel(loadLevel(s));
    setPausedUntil(loadPausedUntil());
  }, []);

  // first placement + show (resizing waits for this, or the two race)
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    (async () => {
      setSide(await placeInitially());
      await win.show();
      setPlaced(true);
    })();
  }, []);

  // after a drag, dock to the nearest side edge and remember it
  const userDragging = useRef(false);
  useEffect(() => {
    let t: number | undefined;
    const un = win.onMoved(() => {
      if (!userDragging.current) return; // ignore our own setPosition calls
      window.clearTimeout(t);
      // snap only once the button is released, even if the user pauses mid-drag
      t = window.setTimeout(async function settle() {
        const held = await invoke<boolean>("primary_button_down").catch(() => false);
        if (held) {
          t = window.setTimeout(settle, 120);
          return;
        }
        userDragging.current = false;
        setSide(await snapAfterDrag());
      }, 150);
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
    const d = listen(TOUR_EVENT, () => {
      setNudging(false);
      setFact(null);
      setCheer(null);
      touring.current = true;
      setTour(0);
      setBoing((n) => n + 1);
    });
    const b = listen("tumbli:reset-position", async () => {
      localStorage.removeItem(POS_KEY);
      setNudging(false);
      setFact(null);
      setSide(await placeInitially(true));
      await win.show();
    });
    return () => {
      void a.then((f) => f());
      void b.then((f) => f());
      void c.then((f) => f());
      void d.then((f) => f());
    };
  }, [refresh]);

  // expand / collapse the window for the speech bubble or the cheer text
  const talking = nudging || fact !== null || tour !== null;
  const mode = talking ? "talk" : cheer ? "cheer" : "idle";
  useEffect(() => {
    if (!placed) return;
    const target = mode === "talk" ? EXPANDED : mode === "cheer" ? CHEERING : COMPACT;
    void resizeAnchored(target.w, target.h);
  }, [mode, placed]);

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
        doneMl: todayMl(),
        busy: status.busy,
        pausedUntil: loadPausedUntil(),
      });

      if (due && !nudging && !touring.current) {
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
    if (nudging || touring.current) return; // during a reminder or the tour a click just makes Tumbli jump
    setFact(randomFact());
    setRevealed(false);
    armFactTimer();
  }, [nudging, armFactTimer]);

  useEffect(() => () => window.clearTimeout(factTimer.current), []);

  // ---------- actions ----------

  const cheerUp = (text: string) => {
    const id = Date.now();
    setCheer({ text, id });
    window.setTimeout(() => setCheer((c) => (c?.id === id ? null : c)), CHEER_MS);
  };

  /** after any drink: animate, cheer, schedule the next reminder */
  const afterDrink = (before: number, r: DrinkResult) => {
    setDoneMl(r.total);
    if (r.level >= 0) setLevel(r.level);
    setNudging(false);
    setLastDrank(r.drank);
    setGulping(true);
    window.setTimeout(() => setGulping(false), 1100);
    cheerUp(
      cheerFor({ before, after: r.total, goalMl: settings.goalMl, name: settings.name, empty: r.level === 0 }),
    );
    nextAt.current = Date.now() + settings.intervalMin * 60_000;
    if (before < settings.goalMl && r.total >= settings.goalMl) {
      setCelebrate(true);
      if (settings.sound) bloop();
      window.setTimeout(() => setCelebrate(false), 3500);
    }
  };

  const tumblerMode = settings.mode === "tumbler";
  const sipMl = sipFor(settings);

  /** a glass (glass mode) or a few sips (tumbler mode) */
  const drink = () => {
    if (tumblerMode && loadLevel(settings) <= 0) {
      cheerUp("I'm empty! Refill me first 🔄");
      return;
    }
    const before = todayMl();
    afterDrink(before, logDrink(tumblerMode ? sipMl : settings.glassMl, settings));
  };

  const finishIt = () => {
    const before = todayMl();
    const r = finishTumbler(settings);
    if (r.drank > 0) afterDrink(before, r);
  };

  const doRefill = () => {
    refill(settings);
    setLevel(settings.tumblerMl);
    setBoing((n) => n + 1);
    cheerUp("All full! 💧");
  };

  const snooze = () => {
    setNudging(false);
    nextAt.current = Date.now() + SNOOZE_MIN * 60_000;
  };

  const skip = () => {
    setNudging(false);
    nextAt.current = Date.now() + settings.intervalMin * 60_000;
  };

  const endTour = () => {
    markTourDone();
    touring.current = false;
    setTour(null);
    // the first reminder comes one interval after the tour (15 s in dev)
    nextAt.current = Date.now() + (import.meta.env.DEV ? 15_000 : settings.intervalMin * 60_000);
  };
  const nextTour = () => {
    if (tour === null) return;
    if (tour >= TOUR.length - 1) endTour();
    else {
      setTour(tour + 1);
      setBoing((n) => n + 1);
    }
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

  const glasses = Math.floor(doneMl / settings.glassMl);
  const goalG = goalGlasses(settings);
  const empty = tumblerMode && level <= 0;
  // glass mode fills up toward the goal; tumbler mode mirrors the real tumbler
  const fill = tumblerMode ? level / settings.tumblerMl : doneMl / settings.goalMl;
  const done = doneMl >= settings.goalMl;
  const days = streak(loadHistory(), settings.goalMl);
  const badge = tumblerMode ? `${liters(doneMl)}/${liters(settings.goalMl)} L` : `${glasses}/${goalG}`;
  const sleeping = pausedUntil > nowTick && !talking;

  return (
    <div
      className={[
        "widget",
        side === "left" ? "side-left" : "side-right",
        talking ? "expanded" : "compact",
        nudging ? "nudging" : "",
        tour !== null ? `touring tour-${TOUR[tour].demo ?? "none"}` : "",
        cheer && !talking ? "cheering" : "",
        gulping ? "gulping" : "",
        celebrate ? "celebrate" : "",
        sleeping ? "sleeping" : "",
        done ? "done" : "",
        empty ? "empty" : "",
      ].join(" ")}
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
    >
      {nudging && (
        <div className="bubble-card" role="dialog" aria-label="Water reminder">
          <div className="bubble-kicker">💧 Reminder</div>
          <div className="nudge-title">{message}</div>
          <div className="nudge-sub">
            {tumblerMode ? (
              empty ? (
                <>Your tumbler is empty. Refill it first!</>
              ) : (
                <>
                  Drink about {sipMl} ml · {fmtMl(doneMl)} of {fmtMl(settings.goalMl)}
                </>
              )
            ) : (
              <>
                {glasses} of {goalG} glasses today
              </>
            )}
            {days > 0 && <> · 🔥 {days}</>}
          </div>
          <div className="nudge-actions">
            {empty ? (
              <button className="btn primary" onClick={doRefill}>
                Refilled 🔄
              </button>
            ) : (
              <button className="btn primary" onClick={drink}>
                {tumblerMode ? "Drank some" : "I drank!"}
              </button>
            )}
            <button className="btn" onClick={snooze}>
              {SNOOZE_MIN} min
            </button>
            <button className="btn ghost" onClick={skip} title="Skip this reminder" aria-label="Skip">
              ✕
            </button>
          </div>
        </div>
      )}

      {tour !== null && (
        <div className="bubble-card tour-card" role="dialog" aria-label="Quick tour">
          <div className="bubble-head">
            <div className="bubble-kicker">
              Quick tour · {tour + 1}/{TOUR.length}
            </div>
            <button className="close" onClick={endTour} aria-label="Skip tour">
              Skip
            </button>
          </div>
          <div className="tour-title">{TOUR[tour].title}</div>
          <div className="tour-body">{TOUR[tour].body}</div>
          <div className="tour-foot">
            <div className="tour-dots" aria-hidden>
              {TOUR.map((_, i) => (
                <span key={i} className={i === tour ? "on" : ""} />
              ))}
            </div>
            <button className="btn primary" onClick={nextTour}>
              {tour === TOUR.length - 1 ? "Got it! 💧" : "Next"}
            </button>
          </div>
        </div>
      )}

      {tour === null && !nudging && fact && (
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

      {cheer && !talking && (
        <div className="cheer" key={cheer.id} role="status">
          {cheer.text}
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
        <div className="count">{badge}</div>
        {sleeping && (
          <div className="zzz" aria-hidden>
            <span>z</span>
            <span>z</span>
          </div>
        )}
        {gulping && <div className="plus-one">{tumblerMode ? `+${lastDrank} ml` : "+1"}</div>}
        {nudging && (
          <>
            <div className="ripples" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <div className="alert-mark" aria-hidden>
              !
            </div>
            <div className="splash" aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </div>
          </>
        )}
        {celebrate && (
          <div className="sparkles" aria-hidden>
            <span>✦</span>
            <span>✦</span>
            <span>✦</span>
          </div>
        )}
      </div>

      {empty && !talking && (
        <button className="refill-chip" onClick={doRefill} title="I refilled my tumbler">
          🔄 Refill
        </button>
      )}

      {!talking && (
        <div className="hover-actions">
          <button
            className="mini plus"
            onClick={drink}
            title={tumblerMode ? `I drank ~${sipMl} ml` : "I drank a glass"}
            aria-label={tumblerMode ? "I drank some" : "I drank a glass"}
          >
            +
          </button>
          {tumblerMode && (
            <>
              <button className="mini" onClick={finishIt} title="I finished my tumbler" aria-label="Finished my tumbler">
                ✓
              </button>
              <button className="mini" onClick={doRefill} title="I refilled my tumbler" aria-label="Refilled my tumbler">
                🔄
              </button>
            </>
          )}
          <button className="mini" onClick={openSettings} title="Settings" aria-label="Settings">
            ⚙
          </button>
        </div>
      )}
    </div>
  );
}
