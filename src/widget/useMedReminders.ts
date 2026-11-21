import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { doseKey, dueDoses, loadMedLog, loadMeds, setDose, type Dose } from "../lib/meds";
import { CHANGED_EVENT, loadLastActive } from "../lib/store";
import { AWAY_MIN } from "../lib/schedule";

const TICK_MS = 5000;

/**
 * Medicine reminders: when a dose's time comes, Tumbli asks about it until it is marked
 * taken or skipped (or snoozed). Unlike water reminders these don't follow the active
 * hours or the tray's pause, since a dose time is set on purpose.
 */
export function useMedReminders({
  canShow,
  onShow,
  snoozeMin,
}: {
  /** false while something else has the stage (the tour) */
  canShow: () => boolean;
  /** a medicine reminder is starting */
  onShow: () => void;
  snoozeMin: number;
}) {
  const [due, setDue] = useState<Dose[]>([]);
  const snoozed = useRef<Record<string, number>>({});
  const cb = useRef({ canShow, onShow });
  cb.current = { canShow, onShow };
  const showing = useRef(false);
  showing.current = due.length > 0;

  const check = useCallback(() => {
    const doses = dueDoses(loadMeds(), loadMedLog(), new Date(), snoozed.current);
    if (showing.current) {
      // answered in the settings window, or the medicine was removed: drop what is no longer due
      setDue((cur) => {
        const still = cur.filter((d) => doses.some((x) => doseKey(x.med.id, x.time) === doseKey(d.med.id, d.time)));
        return still.length === cur.length ? cur : still;
      });
      return;
    }
    // the user hasn't been around for a while: the welcome back asks about these when they return
    const away = Date.now() - loadLastActive() >= AWAY_MIN * 60_000;
    if (doses.length && !away && cb.current.canShow()) {
      setDue(doses);
      cb.current.onShow();
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(check, TICK_MS);
    const un = listen(CHANGED_EVENT, check);
    return () => {
      window.clearInterval(id);
      void un.then((f) => f());
    };
  }, [check]);

  const answer = (state: "taken" | "skipped") => {
    for (const d of due) setDose(d.med.id, d.time, state);
    setDue([]);
  };

  return {
    due,
    taken: () => answer("taken"),
    skip: () => answer("skipped"),
    snooze: () => {
      const until = Date.now() + snoozeMin * 60_000;
      for (const d of due) snoozed.current[doseKey(d.med.id, d.time)] = until;
      setDue([]);
    },
    /** dev preview: show these doses right away */
    force: (doses: Dose[]) => setDue(doses),
  };
}
