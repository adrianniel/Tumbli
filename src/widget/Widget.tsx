/**
 * The floating widget. This file wires things together; the pieces live next to it:
 *  - windowing.ts / useDocking.ts  the window: size per mode, docking to a screen edge
 *  - useReminders.ts               the reminder loop (idle, fullscreen, pause)
 *  - useMedReminders.ts            medicine reminders at the times the user set
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
import {
  AwardBubble,
  FactBubble,
  MedBubble,
  RatingBubble,
  RecapBubble,
  ReminderBubble,
  SNOOZE_MIN,
  TourBubble,
  UpdateBubble,
  WelcomeBackBubble,
} from "./bubbles";
import { appVersion, CHANGELOG, markVersionSeen, pendingReleases } from "../lib/changelog";
import { awayLabel } from "../lib/schedule";
import { closePastDays, doseKey, dosesBetween, fmtTime, joinNames, loadMedLog, loadMeds, setDose } from "../lib/meds";
import { useMedReminders } from "./useMedReminders";
import { askLater, neverAsk, rated, shouldAskForRating } from "../lib/rating";
import { storeReviewUrl } from "../config";
import { openUrl } from "@tauri-apps/plugin-opener";
import { emit } from "@tauri-apps/api/event";
import { markRecapShown, pendingRecap, recapFor, type Recap } from "../lib/recap";
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
const PIN_HOVER = import.meta.env.DEV && new URLSearchParams(location.search).has("hover");

export function Widget() {
  // ---------- data ----------
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [doneMl, setDoneMl] = useState(() => todayMl());
  const [level, setLevel] = useState(() => loadLevel()); // ml left in the tumbler (tumbler mode)
  useEffect(() => void closePastDays(), []); // days since the last run (the PC was off)

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
  const [recap, setRecap] = useState<Recap | null>(null);
  const [askRating, setAskRating] = useState(false);
  const [update, setUpdate] = useState<{ version: string; titles: string[] } | null>(null);
  // dev preview: widget.html?outfit=crown shows an outfit without touching storage
  const [devOutfit] = useState(() =>
    import.meta.env.DEV ? new URLSearchParams(location.search).get("outfit") : null,
  );
  const [hover, setHover] = useState(false);
  const hovering = useRef(false);
  const ignoreHover = useRef(false);
  const hoverTimer = useRef<number | undefined>(undefined);
  const factTimer = useRef<number | undefined>(undefined);

  const reminders = useReminders({
    settings,
    onNewDay: () => {
      closePastDays(); // yesterday's unmarked medicine doses count as missed
      refresh();
      celebrateAchievements();
      window.setTimeout(showRecap, 5000);
      window.setTimeout(maybeAskRating, 30_000);
    },
    canNudge: () => !touring.current,
    onNudge: () => {
      setFact(null); // a reminder wins over a fun fact
      setMessage(nudgeMessage(settings.name));
      if (settings.sound) bloop();
    },
    onWelcome: () => {
      setFact(null);
      if (settings.sound) bloop();
    },
  });
  const { nudging, welcome } = reminders;
  const welcomeRef = useRef(welcome);
  welcomeRef.current = welcome;

  const meds = useMedReminders({
    canShow: () => !touring.current && !welcomeRef.current, // the welcome back asks about meds itself
    onShow: () => {
      setFact(null);
      if (loadSettings().sound) bloop();
    },
    snoozeMin: SNOOZE_MIN,
  });
  const medDue = meds.due.length > 0;
  // medicine doses from the time away that are still unanswered (re-read on every render, so
  // a dose answered in its own reminder or in Settings drops out); null: nothing left to ask
  const awayDoses = (() => {
    if (!welcome) return null;
    const d = dosesBetween(loadMeds(), loadMedLog(), welcome.from, welcome.to);
    return welcome.water || d.length ? d : null;
  })();
  useEffect(() => {
    if (welcome && !awayDoses) reminders.closeWelcome();
  });

  /** Tumbli is asking for something: water or medicine, or saying welcome back */
  const asking = nudging || medDue || welcome !== null;

  const talking =
    asking || fact !== null || tour !== null || award !== null || recap !== null || askRating || update !== null;
  const talkingRef = useRef(talking);
  talkingRef.current = talking;
  const mode: WindowMode = talking ? "talk" : cheer ? "cheer" : hover ? "hover" : "idle";

  const { side, startDrag, peek } = useDocking(
    mode,
    () => {
      reminders.dismiss();
      setFact(null);
    },
    // just tucked into the edge with the mouse still on it: stay tucked until the mouse leaves
    () => {
      ignoreHover.current = true;
      window.clearTimeout(hoverTimer.current);
      setHover(false);
    },
  );

  // ---------- quick tour (started from the settings window) ----------
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;
  // dev builds only: let the ad/teaser recorder bring up a reminder mid-clip
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { tumbliDev: object }).tumbliDev = {
      nudge: () => {
        setMessage(nudgeMessage(loadSettings().name));
        remindersRef.current.forceNudge();
      },
    };
  }, []);
  useEffect(() => {
    const un = listen(TOUR_EVENT, () => {
      remindersRef.current.dismiss();
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
    reminders.scheduleIn(import.meta.env.DEV ? 15_000 : reminders.intervalNow() * 60_000);
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
    if (asking || touring.current) return; // during a reminder or the tour a click just makes Tumbli jump
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
  const sipMl = sipFor(settings, doneMl);

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

  /** a new week: show how the last one went (once) */
  const showRecap = useCallback(() => {
    if (touring.current) return;
    const s = loadSettings();
    const r = pendingRecap(loadHistory(), s.goalMl);
    if (r) setRecap(r);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(showRecap, 9000); // after any achievement bubble
    return () => window.clearTimeout(t);
  }, [showRecap]);
  /** after 3 days of use, ask (once in a while) for a Store rating */
  const maybeAskRating = useCallback(function check() {
    if (!shouldAskForRating(loadHistory())) return;
    // wait until Tumbli isn't busy with something else
    if (talkingRef.current || touring.current) window.setTimeout(check, 60_000);
    else setAskRating(true);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(maybeAskRating, 20_000);
    return () => window.clearTimeout(t);
  }, [maybeAskRating]);

  /** just updated: say what's new (once), when Tumbli isn't busy with something else */
  useEffect(() => {
    const t = window.setTimeout(async function check() {
      if (talkingRef.current || touring.current) {
        window.setTimeout(check, 30_000);
        return;
      }
      const version = await appVersion();
      const releases = pendingReleases(version);
      if (releases.length) setUpdate({ version, titles: releases.flatMap((r) => r.changes.map((c) => c.title)) });
    }, 12_000); // after any achievement or weekly recap
    return () => window.clearTimeout(t);
  }, []);
  const closeUpdate = () => {
    if (update) markVersionSeen(update.version);
    setUpdate(null);
  };

  const closeRecap = () => {
    if (recap) markRecapShown(recap);
    setRecap(null);
  };

  /** after any drink: animate, cheer, schedule the next reminder */
  const afterDrink = (before: number, r: DrinkResult) => {
    setDoneMl(r.total);
    if (r.level >= 0) setLevel(r.level);
    reminders.dismiss();
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
    if (q.has("med")) {
      const med = { id: "demo", name: q.get("med") || "Vitamin D", times: ["08:00"], note: "After breakfast", on: true };
      meds.force([{ med, time: "08:00", at: Date.now(), status: "due" }]);
    }
    if (q.has("away")) {
      const to = Date.now();
      const from = to - (Number(q.get("away")) || 110) * 60_000;
      reminders.forceWelcome({ awayMin: (to - from) / 60_000, missed: 2, water: true, from, to });
    }
    if (q.has("fact")) setFact(FACTS[Number(q.get("fact")) || 0]);
    if (q.has("hover")) setHover(true);
    if (q.has("rating")) setAskRating(true);
    if (q.has("whatsnew")) setUpdate({ version: CHANGELOG[0].version, titles: CHANGELOG[0].changes.map((c) => c.title) });
    if (q.has("award")) setAward(ACHIEVEMENTS[Number(q.get("award")) || 3]);
    // last week's real numbers, the same ones the dashboard shows
    if (q.has("recap")) setRecap(recapFor(loadHistory(), loadSettings().goalMl));
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
        asking ? "nudging" : "",
        tour !== null ? `touring tour-${TOUR[tour].demo ?? "none"}` : "",
        cheer && !talking ? "cheering" : "",
        mode === "hover" ? "hovering" : "",
        gulping ? "gulping" : "",
        celebrate ? "celebrate" : "",
        sleeping ? "sleeping" : "",
        peek && mode === "idle" ? "peeking" : "",
        done ? "done" : "",
        empty ? "empty" : "",
      ].join(" ")}
      onMouseEnter={() => {
        hovering.current = true;
        window.clearTimeout(hoverTimer.current);
        if (!ignoreHover.current) setHover(true);
      }}
      onMouseLeave={() => {
        hovering.current = false;
        ignoreHover.current = false;
        if (PIN_HOVER) return; // dev preview (?hover): keep the buttons for screenshots
        // a short grace period so moving onto the buttons doesn't flicker
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => setHover(false), HOVER_GRACE_MS);
      }}
    >
      {medDue && tour === null && (
        <MedBubble
          names={joinNames(meds.due.map((d) => d.med.name))}
          time={meds.due.every((d) => d.time === meds.due[0].time) ? fmtTime(meds.due[0].time) : ""}
          note={meds.due.length === 1 ? meds.due[0].med.note : ""}
          onTaken={() => {
            meds.taken();
            setBoing((n) => n + 1);
            cheerUp("Nice! 💊 Now some water");
          }}
          onSnooze={meds.snooze}
          onSkip={meds.skip}
        />
      )}

      {welcome && awayDoses && !medDue && tour === null && (
        <WelcomeBackBubble
          name={settings.name}
          away={awayLabel(welcome.awayMin)}
          missed={welcome.missed}
          water={
            welcome.water
              ? [
                  { label: "None", ml: 0 },
                  ...[1, 2, 3].map((n) =>
                    tumblerMode
                      ? { label: `${n * 250} ml`, ml: n * 250 }
                      : { label: String(n), ml: n * settings.glassMl },
                  ),
                ]
              : null
          }
          doses={awayDoses.map((d) => ({ key: doseKey(d.med.id, d.time), name: d.med.name, time: fmtTime(d.time) }))}
          onDone={(ml, picked) => {
            for (const d of awayDoses) {
              const state = picked[doseKey(d.med.id, d.time)];
              if (state) setDose(d.med.id, d.time, state);
            }
            reminders.closeWelcome();
            if (ml > 0) {
              // water had away from the desk: counts toward today, the tumbler level stays as it is
              const before = todayMl();
              afterDrink(before, logDrink(ml, { ...settings, mode: "glass" }));
            } else if (welcome.water) {
              reminders.closeWelcome(5);
              cheerUp("Okay! Let's grab some soon 💧");
            }
          }}
          onClose={() => reminders.closeWelcome()}
        />
      )}

      {nudging && !medDue && !welcome && (
        <ReminderBubble
          message={message}
          sub={reminderSub}
          empty={empty}
          drinkLabel={tumblerMode ? "Drank some" : "I drank!"}
          onDrink={drink}
          onRefill={doRefill}
          onSnooze={() => reminders.dismiss(SNOOZE_MIN)}
          onSkip={() => reminders.dismiss()}
        />
      )}

      {tour !== null && <TourBubble step={tour} onNext={nextTour} onSkip={endTour} />}

      {award && !asking && tour === null && (
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

      {recap && !award && !asking && tour === null && (
        <RecapBubble
          liters={(recap.totalMl / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
          goalDays={recap.goalDays}
          best={recap.best ? recap.best.label : null}
          changePct={recap.changePct}
          onStats={() => {
            closeRecap();
            openSettings();
          }}
          onClose={closeRecap}
        />
      )}

      {askRating && !award && !recap && !asking && tour === null && (
        <RatingBubble
          onRate={() => {
            rated();
            setAskRating(false);
            void openUrl(storeReviewUrl()).catch(() => {});
          }}
          onLater={() => {
            askLater();
            setAskRating(false);
          }}
          onNever={() => {
            neverAsk();
            setAskRating(false);
          }}
          onFeedback={() => {
            askLater();
            setAskRating(false);
            openSettings();
            void emit("tumbli:feedback");
          }}
        />
      )}

      {update && !award && !recap && !askRating && !asking && tour === null && (
        <UpdateBubble
          version={update.version}
          titles={update.titles}
          onSee={() => {
            closeUpdate();
            openSettings();
            void emit("tumbli:whats-new");
          }}
          onClose={closeUpdate}
        />
      )}

      {tour === null && !asking && !award && !update && !recap && !askRating && fact && (
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
        outfit={award?.outfit ?? devOutfit ?? settings.outfit}
        badge={badge}
        empty={empty}
        onRefill={doRefill}
        plusOne={plusOne}
        nudging={asking}
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
