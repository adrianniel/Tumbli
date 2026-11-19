import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { rescheduled, shouldNudge } from "../lib/schedule";
import { loadPausedUntil, pauseEnd, saveNextReminder, savePausedUntil, todayMl, type Settings } from "../lib/store";
import { win } from "./windowing";

const IDLE_SECS = 5 * 60; // the user counts as "away" after 5 min without input
const TICK_MS = 5000;

type SystemStatus = { idle_secs: number; busy: boolean };

/**
 * The reminder loop: every few seconds it checks the time, idle and fullscreen state
 * and pauses, then decides whether Tumbli should pop up a reminder.
 */
export function useReminders({
  settings,
  onNewDay,
  canNudge,
  onNudge,
}: {
  settings: Settings;
  /** called once when the date changes (midnight) */
  onNewDay: () => void;
  /** false while something else has the stage (the tour) */
  canNudge: () => boolean;
  /** a reminder is starting */
  onNudge: () => void;
}) {
  const [nudging, setNudging] = useState(false);
  const [pausedUntil, setPausedUntil] = useState(loadPausedUntil);
  const [now, setNow] = useState(() => Date.now());

  // in `tauri dev` the first reminder comes after 15 s so the pop-up is easy to test
  const nextAt = useRef(Date.now() + (import.meta.env.DEV ? 15_000 : settings.intervalMin * 60_000));
  /** when the current countdown started, to re-time it if the interval changes */
  const startedAt = useRef(Date.now());
  const interval = useRef(settings.intervalMin);
  const hidden = useRef(false);
  const lastDay = useRef(new Date().toDateString());
  const cb = useRef({ onNewDay, canNudge, onNudge });
  cb.current = { onNewDay, canNudge, onNudge };

  /** move the next reminder; `restart` starts a new countdown from now */
  const setNext = (at: number, restart = true) => {
    nextAt.current = at;
    if (restart) startedAt.current = Date.now();
    saveNextReminder(at);
  };

  useEffect(() => saveNextReminder(nextAt.current), []);

  // "Remind me every" changed in settings: re-time the running countdown right away,
  // instead of waiting out the old interval first
  useEffect(() => {
    if (settings.intervalMin === interval.current) return;
    interval.current = settings.intervalMin;
    if (nudging) return; // closing the reminder schedules with the new interval
    setNext(rescheduled(startedAt.current, settings.intervalMin, Date.now()), false);
  }, [settings.intervalMin, nudging]);

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
        if (shouldHide) await win.hide();
        else await win.show();
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
      if (due && !nudging && cb.current.canNudge()) {
        cb.current.onNudge();
        setNudging(true);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [settings, nudging]);

  return {
    nudging,
    paused: pausedUntil > now,
    /** close the reminder and ask again in `minutes` */
    dismiss: (minutes: number) => {
      setNudging(false);
      setNext(Date.now() + minutes * 60_000);
    },
    /** open a reminder right now (dev preview) */
    forceNudge: () => setNudging(true),
    /** ask again after `ms` without closing anything */
    scheduleIn: (ms: number) => {
      setNext(Date.now() + ms);
    },
  };
}
