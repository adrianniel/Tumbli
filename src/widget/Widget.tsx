/**
 * The floating widget. This file wires things together; the pieces live next to it:
 *  - windowing.ts / useDocking.ts  the window: size per mode, docking to a screen edge
 *  - useReminders.ts               the reminder loop (idle, fullscreen, pause)
 *  - useGestures.ts                click vs drag vs double-click on Tumbli
 *  - Buddy.tsx, bubbles.tsx        what's drawn: Tumbli, its badge, buttons and bubbles
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { bloop } from "../lib/sound";
import { sipFor } from "../lib/schedule";
import { cheerFor, FACTS, nudgeMessage, randomFact, type Fact } from "../lib/facts";
import {
  CHANGED_EVENT,
  drink as logDrink,
  finishTumbler,
  fmtMl,
  goalGlasses,
  liters,
  loadHistory,
  loadLevel,
  loadSettings,
  markTourDone,
  refill,
  saveSettings,
  streak,
  todayMl,
  TOUR_EVENT,
  type DrinkResult,
  type Settings,
} from "../lib/store";
import { Buddy, HoverActions } from "./Buddy";
import { AwardBubble, FactBubble, ReminderBubble, SNOOZE_MIN, TourBubble } from "./bubbles";
import { ACHIEVEMENTS, checkAchievements, outfitName, type Achievement } from "../lib/achievements";
import { TOUR } from "./tour";
import { useDocking } from "./useDocking";
import { useGestures } from "./useGestures";
import { useReminders } from "./useReminders";
import { useShortcut } from "./useShortcut";
import type { WindowMode } from "./windowing";

const CHEER_MS = 2800;
const FACT_MS = 12_000; // a fact bubble closes by itself after this, unless hovered
const HOVER_GRACE_MS = 350; // keep the buttons a moment after the mouse leaves

export function Widget() {
  // ---------- data ----------
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [doneMl, setDoneMl] = useState(() => todayMl());
  const [level, setLevel] = useState(() => loadLevel()); // ml left in the tumbler (tumbler mode)

  const refresh = useCallback(() => {
    const s = loadSettings();
    setSettings(s);
    setDoneMl(todayMl());
    setLevel(loadLevel(s));
  }, []);
  useEffect(() => {
    const un = listen(CHANGED_EVENT, refresh);
    return () => {
      void un.then((f) => f());
    };
  }, [refresh]);

  // ---------- what Tumbli is doing ----------
  const [message, setMessage] = useState("");
  const [fact, setFact] = useState<Fact | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [tour, setTour] = useState<number | null>(null); // step of the quick tour, if running
  const touring = useRef(false);
  const [cheer, setCheer] = useState<{ text: string; id: number } | null>(null);
  const [plusOne, setPlusOne] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [gulping, setGulping] = useState(false);
  const [boing, setBoing] = useState(0);
  const [award, setAward] = useState<Achievement | null>(null);
  const [hover, setHover] = useState(false);
  const hovering = useRef(false);
  const hoverTimer = useRef<number | undefined>(undefined);
  const factTimer = useRef<number | undefined>(undefined);

  const reminders = useReminders({
    settings,
    onNewDay: () => {
      refresh();
      celebrateAchievements();
    },
    canNudge: () => !touring.current,
    onNudge: () => {
      setFact(null); // a reminder wins over a fun fact
      setMessage(nudgeMessage(settings.name));
      if (settings.sound) bloop();
    },
  });
  const { nudging } = reminders;

  const talking = nudging || fact !== null || tour !== null || award !== null;
  const mode: WindowMode = talking ? "talk" : cheer ? "cheer" : hover ? "hover" : "idle";

  const { side, startDrag } = useDocking(mode, () => {
    reminders.dismiss(settings.intervalMin);
    setFact(null);
  });

  // ---------- quick tour (started from the settings window) ----------
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;
  useEffect(() => {
    const un = listen(TOUR_EVENT, () => {
      remindersRef.current.dismiss(loadSettings().intervalMin);
      setFact(null);
      setCheer(null);
      touring.current = true;
      setTour(0);
      setBoing((n) => n + 1);
    });
    return () => {
      void un.then((f) => f());
    };
  }, []);

  const endTour = () => {
    markTourDone();
    touring.current = false;
    setTour(null);
    // the first reminder comes one interval after the tour (15 s in dev)
    reminders.scheduleIn(import.meta.env.DEV ? 15_000 : settings.intervalMin * 60_000);
  };
  const nextTour = () => {
    if (tour === null) return;
    if (tour >= TOUR.length - 1) endTour();
    else {
      setTour(tour + 1);
      setBoing((n) => n + 1);
    }
  };

  // ---------- fun facts ----------
  const armFactTimer = useCallback(() => {
    window.clearTimeout(factTimer.current);
    factTimer.current = window.setTimeout(function tick() {
      if (hovering.current) factTimer.current = window.setTimeout(tick, 2000);
      else setFact(null);
    }, FACT_MS);
  }, []);
  const tellFact = () => {
    setBoing((n) => n + 1);
    if (nudging || touring.current) return; // during a reminder or the tour a click just makes Tumbli jump
    setFact(randomFact());
    setRevealed(false);
    armFactTimer();
  };
  const closeFact = () => {
    window.clearTimeout(factTimer.current);
    setFact(null);
  };
  useEffect(() => () => window.clearTimeout(factTimer.current), []);

  // ---------- drinking ----------
  const tumblerMode = settings.mode === "tumbler";
  const sipMl = sipFor(settings);

  const cheerUp = (text: string) => {
    const id = Date.now();
    setCheer({ text, id });
    window.setTimeout(() => setCheer((c) => (c?.id === id ? null : c)), CHEER_MS);
  };

  /** show a newly earned achievement (prefer one that comes with an outfit) */
  const celebrateAchievements = useCallback(() => {
    const s = loadSettings();
    const fresh = checkAchievements(s.goalMl);
    if (!fresh.length || touring.current) return;
    const pick = [...fresh].reverse().find((a) => a.outfit) ?? fresh[fresh.length - 1];
    setFact(null);
    setAward(pick);
    setCelebrate(true);
    if (s.sound) bloop();
    window.setTimeout(() => setCelebrate(false), 3500);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(celebrateAchievements, 4000); // e.g. earned while Tumbli was closed
    return () => window.clearTimeout(t);
  }, [celebrateAchievements]);

  /** after any drink: animate, cheer, schedule the next reminder */
  const afterDrink = (before: number, r: DrinkResult) => {
    setDoneMl(r.total);
    if (r.level >= 0) setLevel(r.level);
    reminders.dismiss(settings.intervalMin);
    setPlusOne(tumblerMode ? `+${r.drank} ml` : "+1");
    setGulping(true);
    window.setTimeout(() => {
      setGulping(false);
      setPlusOne(null);
    }, 1100);
    cheerUp(cheerFor({ before, after: r.total, goalMl: settings.goalMl, name: settings.name, empty: r.level === 0 }));
    if (before < settings.goalMl && r.total >= settings.goalMl) {
      setCelebrate(true);
      if (settings.sound) bloop();
      window.setTimeout(() => setCelebrate(false), 3500);
    }
    // let the cheer play, then show anything newly unlocked
    window.setTimeout(celebrateAchievements, 1600);
  };

  /** a glass (glass mode) or a few sips (tumbler mode) */
  const drink = () => {
    if (tumblerMode && loadLevel(settings) <= 0) {
      cheerUp("I'm empty! Refill me first");
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
    cheerUp("All full! Let's go");
  };

  const openSettings = () => void invoke("open_settings");

  // Ctrl+Alt+W (or the chosen combo) logs a drink from any app
  useShortcut(settings, () => {
    setBoing((n) => n + 1);
    drink();
  });

  const gestures = useGestures({ onClick: tellFact, onDoubleClick: openSettings, onDragStart: startDrag });

  // ---------- dev preview in a browser: widget.html?demo&nudge | &fact= | &tour= | &hover ----------
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const q = new URLSearchParams(location.search);
    if (q.has("nudge")) {
      setMessage(nudgeMessage(loadSettings().name));
      reminders.forceNudge();
    }
    if (q.has("fact")) setFact(FACTS[Number(q.get("fact")) || 0]);
    if (q.has("hover")) setHover(true);
    if (q.has("award")) setAward(ACHIEVEMENTS[Number(q.get("award")) || 3]);
    if (q.has("tour")) {
      touring.current = true;
      setTour(Number(q.get("tour")) || 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- what to draw ----------
  const glasses = Math.floor(doneMl / settings.glassMl);
  const goalG = goalGlasses(settings);
  const empty = tumblerMode && level <= 0;
  // glass mode fills up toward the goal; tumbler mode mirrors the real tumbler
  const fill = tumblerMode ? level / settings.tumblerMl : doneMl / settings.goalMl;
  const done = doneMl >= settings.goalMl;
  const days = streak(loadHistory(), settings.goalMl);
  const badge = tumblerMode ? `${liters(doneMl)}/${liters(settings.goalMl)} L` : `${glasses}/${goalG}`;
  const sleeping = reminders.paused && !talking;

  const reminderSub = (
    <>
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
      {days > 1 && <> · {days}-day streak</>}
    </>
  );

  return (
    <div
      className={[
        "widget",
        side === "left" ? "side-left" : "side-right",
        talking ? "expanded" : "compact",
        nudging ? "nudging" : "",
        tour !== null ? `touring tour-${TOUR[tour].demo ?? "none"}` : "",
        cheer && !talking ? "cheering" : "",
        mode === "hover" ? "hovering" : "",
        gulping ? "gulping" : "",
        celebrate ? "celebrate" : "",
        sleeping ? "sleeping" : "",
        done ? "done" : "",
        empty ? "empty" : "",
      ].join(" ")}
      onMouseEnter={() => {
        hovering.current = true;
        window.clearTimeout(hoverTimer.current);
        setHover(true);
      }}
      onMouseLeave={() => {
        hovering.current = false;
        // a short grace period so moving onto the buttons doesn't flicker
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => setHover(false), HOVER_GRACE_MS);
      }}
    >
      {nudging && (
        <ReminderBubble
          message={message}
          sub={reminderSub}
          empty={empty}
          drinkLabel={tumblerMode ? "Drank some" : "I drank!"}
          onDrink={drink}
          onRefill={doRefill}
          onSnooze={() => reminders.dismiss(SNOOZE_MIN)}
          onSkip={() => reminders.dismiss(settings.intervalMin)}
        />
      )}

      {tour !== null && <TourBubble step={tour} onNext={nextTour} onSkip={endTour} />}

      {award && !nudging && tour === null && (
        <AwardBubble
          title={award.title}
          desc={award.desc}
          outfitName={award.outfit ? outfitName(award.outfit) : undefined}
          onWear={() => {
            saveSettings({ ...loadSettings(), outfit: award.outfit ?? null });
            setAward(null);
            setBoing((n) => n + 1);
          }}
          onClose={() => setAward(null)}
        />
      )}

      {tour === null && !nudging && !award && fact && (
        <FactBubble
          fact={fact}
          revealed={revealed}
          onReveal={() => {
            setRevealed(true);
            armFactTimer();
          }}
          onAnother={tellFact}
          onClose={closeFact}
        />
      )}

      {cheer && !talking && (
        <div className="cheer" key={cheer.id} role="status">
          {cheer.text}
        </div>
      )}

      <Buddy
        gestures={gestures}
        boing={boing}
        fill={fill}
        happy={done && !talking}
        calling={talking}
        sleeping={sleeping}
        outfit={award?.outfit ?? settings.outfit}
        badge={badge}
        empty={empty}
        onRefill={doRefill}
        plusOne={plusOne}
        nudging={nudging}
        celebrate={celebrate}
      />

      {mode === "hover" && (
        <HoverActions
          tumblerMode={tumblerMode}
          sipMl={sipMl}
          onDrink={drink}
          onFinish={finishIt}
          onRefill={doRefill}
          onSettings={openSettings}
        />
      )}
    </div>
  );
}
