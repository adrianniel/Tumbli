import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { awaySummary, AWAY_MIN, currentInterval, rescheduled, shouldNudge, withinActiveHours } from "../lib/schedule";
import { dosesBetween, loadMedLog, loadMeds } from "../lib/meds";
import {
  loadLastActive,
  loadPausedUntil,
  pauseEnd,
  saveLastActive,
  saveNextReminder,
  savePausedUntil,
  todayMl,
  type Settings,
} from "../lib/store";
import { win } from "./windowing";

const IDLE_SECS = 5 * 60; // the user counts as "away" after 5 min without input
const TICK_MS = 5000;

type SystemStatus = { idle_secs: number; busy: boolean };
/**
 * Back after a while away: how long, how many water reminders went by (`water` false when
 * there is nothing to ask about water), and the time away, to find the medicine doses in it.
 */
export type Welcome = { awayMin: number; missed: number; water: boolean; from: number; to: number };

/**
 * The reminder loop: every few seconds it checks the time, idle and fullscreen state
 * and pauses, then decides whether Tumbli should pop up a reminder.
 */
export function useReminders({
  settings,
  onNewDay,
  canNudge,
  onNudge,
  onWelcome,
}: {
  settings: Settings;
  /** called once when the date changes (midnight) */
  onNewDay: () => void;
  /** false while something else has the stage (the tour) */
  canNudge: () => boolean;
  /** a reminder is starting */
  onNudge: () => void;
  /** a welcome-back message is starting */
  onWelcome: () => void;
}) {
  const [nudging, setNudging] = useState(false);
  const [pausedUntil, setPausedUntil] = useState(loadPausedUntil);
  const [now, setNow] = useState(() => Date.now());
  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const welcomeRef = useRef(welcome);
  welcomeRef.current = welcome;
  /** the user's last keyboard / mouse input that Tumbli saw (survives restarts and shutdowns) */
  const lastInput = useRef(loadLastActive() || Date.now());
  const lastSaved = useRef(0);

  /** minutes until the next reminder: the chosen interval, or Auto's pace for what is left today */
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const intervalNow = () => currentInterval(settingsRef.current, todayMl(), new Date());

  // in `tauri dev` the first reminder comes after 15 s so the pop-up is easy to test
  const nextAt = useRef(Date.now() + (import.meta.env.DEV ? 15_000 : intervalNow() * 60_000));
  /** when the current countdown started, to re-time it if the interval changes */
  const startedAt = useRef(Date.now());
  const { autoInterval, intervalMin, goalMl, startHour, endHour, mode, glassMl, tumblerMl } = settings;
  const pace = [autoInterval, intervalMin, goalMl, startHour, endHour, mode, glassMl, tumblerMl].join();
  const paceRef = useRef(pace);
  const hidden = useRef(false);
  const lastDay = useRef(new Date().toDateString());
  const cb = useRef({ onNewDay, canNudge, onNudge, onWelcome });
  cb.current = { onNewDay, canNudge, onNudge, onWelcome };

  /** move the next reminder; `restart` starts a new countdown from now */
  const setNext = (at: number, restart = true) => {
    nextAt.current = at;
    if (restart) startedAt.current = Date.now();
    saveNextReminder(at);
  };

  useEffect(() => saveNextReminder(nextAt.current), []);

  // "Remind me every" (or something Auto paces by: goal, hours, glass) changed in settings:
  // re-time the running countdown right away, instead of waiting out the old interval first
  useEffect(() => {
    if (pace === paceRef.current) return;
    paceRef.current = pace;
    if (nudging) return; // closing the reminder schedules with the new interval
    setNext(rescheduled(startedAt.current, intervalNow(), Date.now()), false);
  }, [pace, nudging]);

  // tray: pause / resume
  useEffect(() => {
    const un = listen<string>("tumbli:pause", (e) => {
      const until = e.payload === "resume" ? 0 : pauseEnd(e.payload === "day" ? "day" : "hour");
      savePausedUntil(until);
      setPausedUntil(until);
      setNudging(false);
      if (until === 0) setNext(Date.now() + 60_000); // check in soon after resuming
    });
    return () => {
      void un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(async () => {
      const today = new Date();
      if (today.toDateString() !== lastDay.current) {
        lastDay.current = today.toDateString();
        cb.current.onNewDay();
      }
      setNow(Date.now());
      setPausedUntil(loadPausedUntil());

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
        // a hidden WebView still draws its animations: keep them still while hidden
        document.documentElement.classList.toggle("window-idle", shouldHide);
        if (shouldHide) await win.hide();
        else await win.show();
      }

      // back after a while away (lid closed, asleep, idle, or the PC was off): say hi, tell
      // them how many reminders went by, and let them log the water and medicine they took
      const t = Date.now();
      if (status.idle_secs < IDLE_SECS) {
        const inputAt = t - status.idle_secs * 1000;
        const prev = lastInput.current;
        lastInput.current = inputAt;
        // (the saved time stays old while the welcome back is up: medicine reminders wait for it)
        const save = () => {
          if (inputAt - lastSaved.current > 30_000) {
            lastSaved.current = inputAt;
            saveLastActive(inputAt);
          }
        };
        if (welcomeRef.current) {
          /* answered or closed first */
        } else if (inputAt - prev >= AWAY_MIN * 60_000 && !nudging) {
          const every = intervalNow();
          const away = awaySummary(prev, inputAt, settings, every);
          const water =
            away.sameDay &&
            away.missed >= 1 &&
            withinActiveHours(settings, today) &&
            todayMl() < settings.goalMl &&
            loadPausedUntil() <= t;
          const doses = dosesBetween(loadMeds(), loadMedLog(), prev, t).length;
          if ((water || doses > 0) && !status.busy && cb.current.canNudge()) {
            if (water) setNext(t + every * 60_000);
            setWelcome({ awayMin: away.awayMin, missed: away.missed, water, from: prev, to: t });
            welcomeRef.current = { awayMin: 0, missed: 0, water, from: prev, to: t };
            cb.current.onWelcome();
            return;
          }
          save();
        } else save();
      }

      // away from the computer: don't nag; remind shortly after they return
      if (status.idle_secs >= IDLE_SECS) {
        if (nextAt.current < Date.now() + 60_000) setNext(Date.now() + 60_000, false);
        return;
      }

      const due = shouldNudge({
        now: today,
        nextAt: nextAt.current,
        settings,
        doneMl: todayMl(),
        busy: status.busy,
        pausedUntil: loadPausedUntil(),
      });
      if (due && !nudging && !welcomeRef.current && cb.current.canNudge()) {
        cb.current.onNudge();
        setNudging(true);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [settings, nudging]);

  return {
    nudging,
    welcome,
    /** close the welcome-back message; `askAgainMin` brings a reminder that soon */
    closeWelcome: (askAgainMin?: number) => {
      setWelcome(null);
      if (askAgainMin) setNext(Date.now() + askAgainMin * 60_000);
    },
    /** dev preview: show a welcome-back message */
    forceWelcome: (w: Welcome) => setWelcome(w),
    paused: pausedUntil > now,
    /** close the reminder and ask again in `minutes` (default: the next interval) */
    dismiss: (minutes = intervalNow()) => {
      setNudging(false);
      setNext(Date.now() + minutes * 60_000);
    },
    /** minutes until the next reminder if one were answered now */
    intervalNow,
    /** open a reminder right now (dev preview) */
    forceNudge: () => setNudging(true),
    /** ask again after `ms` without closing anything */
    scheduleIn: (ms: number) => {
      setNext(Date.now() + ms);
    },
  };
}
