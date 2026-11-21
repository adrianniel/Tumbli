import { useEffect, useMemo, useState } from "react";
import { Tumbler } from "../components/Tumbler";
import { IconCheck, IconClose } from "../components/Icons";
import { dosesOn, fmtTime, type LoggedDose, type Med, type MedLog } from "../lib/meds";
import { dayKey } from "../lib/store";

const DAYS = 14;
const LABEL: Record<LoggedDose["status"], string> = {
  taken: "Taken",
  skipped: "Skipped",
  missed: "Missed",
  due: "Due now",
  later: "Later",
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * The last two weeks of medicine doses as a little calendar: each day shows a dot per dose
 * (green taken, coral missed, grey skipped); pick a day to see which doses it had.
 */
export function MedLogs({ meds, log, now, onClose }: { meds: Med[]; log: MedLog; now: number; onClose: () => void }) {
  const [only, setOnly] = useState<string | null>(null);
  const today = useMemo(() => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    return d;
  }, [now]);
  const [picked, setPicked] = useState(() => dayKey(today));

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const shown = only ? meds.filter((m) => m.id === only) : meds;
  const first = addDays(today, -(DAYS - 1));
  // whole weeks, Sunday to Saturday, around the last 14 days
  const start = addDays(first, -first.getDay());
  const end = addDays(today, 6 - today.getDay());
  const cells: { date: Date; inRange: boolean; doses: LoggedDose[] }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const inRange = d >= addDays(first, -0.5) && d <= today;
    cells.push({ date: d, inRange, doses: inRange ? dosesOn(shown, log, d, new Date(now)) : [] });
  }
  const done = cells.flatMap((c) => c.doses).filter((d) => d.status !== "later" && d.status !== "due");
  const taken = done.filter((d) => d.status === "taken").length;
  const pct = done.length ? Math.round((taken / done.length) * 100) : 0;
  const day = cells.find((c) => dayKey(c.date) === picked) ?? cells[cells.length - 1];

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog logs" role="dialog" aria-modal="true" aria-labelledby="logs-title">
        <div className="logs-head">
          <div className="logs-face" aria-hidden>
            <Tumbler fill={done.length ? taken / done.length : 0.5} size={46} happy={pct >= 80} />
          </div>
          <div>
            <h2 id="logs-title">Your last 2 weeks</h2>
            <span className="muted small">
              {done.length ? `${taken} of ${done.length} doses taken · ${pct}%` : "No doses yet"}
            </span>
          </div>
          <button className="icon-btn logs-close" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>

        {meds.length > 1 && (
          <div className="logs-filter" role="radiogroup" aria-label="Medicine">
            <button role="radio" aria-checked={only === null} className={only === null ? "on" : ""} onClick={() => setOnly(null)}>
              All
            </button>
            {meds.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={only === m.id}
                className={only === m.id ? "on" : ""}
                onClick={() => setOnly(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}

        <div className="cal" role="grid" aria-label="Doses per day">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className="cal-dow">
              {d}
            </span>
          ))}
          {cells.map((c) => {
            const k = dayKey(c.date);
            const answered = c.doses.filter((d) => d.status !== "later" && d.status !== "due");
            const mood = !answered.length
              ? ""
              : answered.every((d) => d.status === "taken")
                ? "good"
                : answered.some((d) => d.status === "taken")
                  ? "mixed"
                  : "bad";
            return c.inRange ? (
              <button
                key={k}
                role="gridcell"
                className={["cal-day", mood, k === picked ? "picked" : "", k === dayKey(today) ? "today" : ""].join(" ")}
                aria-label={`${c.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}: ${
                  c.doses.length ? `${c.doses.filter((d) => d.status === "taken").length} of ${c.doses.length} taken` : "no doses"
                }`}
                onClick={() => setPicked(k)}
              >
                <span className="cal-num">{c.date.getDate()}</span>
                <span className="cal-dots" aria-hidden>
                  {c.doses.slice(0, 4).map((d, i) => (
                    <i key={i} className={d.status} />
                  ))}
                  {c.doses.length > 4 && <em>+</em>}
                </span>
              </button>
            ) : (
              <span key={k} className="cal-day out" aria-hidden>
                <span className="cal-num">{c.date.getDate()}</span>
              </span>
            );
          })}
        </div>

        <div className="cal-legend" aria-hidden>
          <span>
            <i className="taken" /> Taken
          </span>
          <span>
            <i className="missed" /> Missed
          </span>
          <span>
            <i className="skipped" /> Skipped
          </span>
          <span>
            <i className="later" /> To come
          </span>
        </div>

        <div className="logs-day">
          <b>
            {dayKey(day.date) === dayKey(today)
              ? "Today"
              : day.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </b>
          {day.doses.length ? (
            <ul>
              {day.doses.map((d) => (
                <li key={`${d.med.id}@${d.time}`} className={d.status}>
                  <span className="ld-time">{fmtTime(d.time)}</span>
                  <span className="ld-name">{d.med.name}</span>
                  <span className="ld-status">
                    {d.status === "taken" && <IconCheck size={12} strokeWidth={3} />} {LABEL[d.status]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No doses on this day.</p>
          )}
        </div>
      </div>
    </div>
  );
}
