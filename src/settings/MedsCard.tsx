import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { IconCheck, IconClose, IconPill, IconPlus, IconTrash } from "../components/Icons";
import { DatePicker, TimePicker } from "../components/Pickers";
import { MedLogs } from "./MedLogs";
import {
  cleanTimes,
  closePastDays,
  dosesToday,
  fmtTime,
  loadMedLog,
  loadMeds,
  MAX_MEDS,
  MAX_TIMES,
  medHistory,
  newMedId,
  saveMeds,
  scheduleLabel,
  setDose,
  type Dose,
  type Med,
} from "../lib/meds";
import { CHANGED_EVENT, dayKey } from "../lib/store";
import { ConfirmDialog } from "./ConfirmDialog";

type Draft = { id: string | null; name: string; times: string[]; note: string; days: number[]; until: string | null };
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** `days` is what's picked while editing: all 7 = every day, empty = nothing yet */
const EMPTY: Draft = { id: null, name: "", times: ["08:00"], note: "", days: ALL_DAYS, until: null };
const DOW = ["S", "M", "T", "W", "TH", "F", "S"];
const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const inDays = (n: number) => dayKey(new Date(Date.now() + n * 86_400_000));
const draftOf = (m: Med): Draft => ({
  id: m.id,
  name: m.name,
  times: m.times,
  note: m.note,
  days: m.days?.length ? m.days : ALL_DAYS,
  until: m.until ?? null,
});

const STATUS_LABEL: Record<Dose["status"], string> = {
  taken: "Taken",
  skipped: "Skipped",
  due: "Due now",
  missed: "Missed",
  later: "Later",
};

/**
 * "Medicines": the user's medicines and vitamins with their times, and today's doses,
 * which can be ticked off here too (for a dose taken before Tumbli asked).
 */
export function MedsCard({ now }: { now: number }) {
  const [meds, setMeds] = useState<Med[]>(loadMeds);
  const [log, setLog] = useState(loadMedLog);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Med | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [noDays, setNoDays] = useState(false);

  // a new day (or the first look today): yesterday's unmarked doses count as missed
  const today = dayKey(new Date(now));
  useEffect(() => {
    if (closePastDays()) setLog(loadMedLog());
  }, [today]);

  useEffect(() => {
    const reload = () => {
      setMeds(loadMeds());
      setLog(loadMedLog());
    };
    const un = listen(CHANGED_EVENT, reload);
    return () => {
      void un.then((f) => f());
    };
  }, []);

  const store = (next: Med[]) => {
    setMeds(next);
    saveMeds(next);
  };
  const toggleDose = (d: Dose) => {
    setDose(d.med.id, d.time, d.status === "taken" ? null : "taken");
    setLog(loadMedLog());
  };

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim().slice(0, 40);
    const times = cleanTimes(draft.times);
    if (!name || !times.length) return;
    if (!draft.days.length) {
      setNoDays(true);
      return;
    }
    const note = draft.note.trim().slice(0, 60);
    const days = draft.days.length === 7 ? [] : [...draft.days].sort();
    const plan = { name, times, note, days: days.length ? days : undefined, until: draft.until ?? undefined };
    store(
      draft.id
        ? meds.map((m) => (m.id === draft.id ? { ...m, ...plan } : m))
        : [...meds, { id: newMedId(), on: true, since: dayKey(), ...plan }],
    );
    setDraft(null);
  };

  const doses = dosesToday(meds, log, new Date(now));
  const canSave = !!draft && draft.name.trim() !== "" && cleanTimes(draft.times).length > 0;

  return (
    <section className="card meds">
      <div className="card-head">
        <h2>Medicines</h2>
        {meds.length > 0 && (
          <button className="link" onClick={() => setLogsOpen(true)}>
            View logs
          </button>
        )}
      </div>
      <p className="muted small card-sub">
        Tumbli can remind you to take your medicine or vitamins too, at the times you set.
      </p>

      {doses.length > 0 && (
        <div className="row stack">
          <span className="row-label">Today</span>
          <ul className="doses">
            {doses.map((d) => (
              <li key={`${d.med.id}@${d.time}`} className={`dose ${d.status}`}>
                <button
                  className="dose-check"
                  role="checkbox"
                  aria-checked={d.status === "taken"}
                  aria-label={`${d.med.name} at ${fmtTime(d.time)}: ${STATUS_LABEL[d.status]}`}
                  title={d.status === "taken" ? "Mark as not taken" : "Mark as taken"}
                  onClick={() => toggleDose(d)}
                >
                  {d.status === "taken" && <IconCheck size={14} strokeWidth={3} />}
                </button>
                <span className="dose-time">{fmtTime(d.time)}</span>
                <span className="dose-name">{d.med.name}</span>
                <span className="dose-status">{STATUS_LABEL[d.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {meds.map((m) =>
        draft?.id === m.id ? null : (
          <div className="row med-row" key={m.id}>
            <span className="med-info">
              <span className="med-name">
                <IconPill size={15} /> {m.name}
              </span>
              <small>
                {m.times.map(fmtTime).join(" · ")} · {scheduleLabel(m)}
                {m.note && ` · ${m.note}`}
              </small>
              <MedDots med={m} log={log} now={now} />
            </span>
            <span className="med-actions">
              <button className="link" onClick={() => setDraft(draftOf(m))}>
                Edit
              </button>
              <input
                className="switch"
                type="checkbox"
                checked={m.on}
                aria-label={`Reminders for ${m.name}`}
                onChange={(e) => store(meds.map((x) => (x.id === m.id ? { ...x, on: e.target.checked } : x)))}
              />
            </span>
          </div>
        ),
      )}

      {draft ? (
        <div className="row stack med-form">
          <label className="med-field">
            <span>Name</span>
            <input
              className="text-input"
              autoFocus
              maxLength={40}
              placeholder="e.g. Vitamin D"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </label>
          <div className="med-field">
            <span>Times</span>
            <div className="med-times">
              {draft.times.map((t, i) => (
                <span className="med-time" key={i}>
                  <TimePicker
                    value={t}
                    label={`Time ${i + 1}`}
                    onChange={(v) => setDraft({ ...draft, times: draft.times.map((x, j) => (j === i ? v : x)) })}
                  />
                  {draft.times.length > 1 && (
                    <button
                      className="time-remove"
                      aria-label={`Remove time ${i + 1}`}
                      onClick={() => setDraft({ ...draft, times: draft.times.filter((_, j) => j !== i) })}
                    >
                      <IconClose size={13} strokeWidth={2.4} />
                    </button>
                  )}
                </span>
              ))}
              {draft.times.length < MAX_TIMES && (
                <button
                  className="pill small-pill"
                  onClick={() => setDraft({ ...draft, times: [...draft.times, nextTime(draft.times)] })}
                >
                  <IconPlus size={13} strokeWidth={2.6} /> Time
                </button>
              )}
            </div>
          </div>
          <div className="med-field">
            <span>Days</span>
            <div className="med-days-wrap">
              <div className="med-days">
                <button
                  type="button"
                  className={draft.days.length === 7 ? "day-chip wide on" : "day-chip wide"}
                  aria-pressed={draft.days.length === 7}
                  onClick={() => {
                    setNoDays(false);
                    // on: clear every day, so a few can be picked; off: every day
                    setDraft({ ...draft, days: draft.days.length === 7 ? [] : ALL_DAYS });
                  }}
                >
                  Every day
                </button>
                {DOW.map((d, i) => {
                  const on = draft.days.includes(i);
                  return (
                    <button
                      type="button"
                      key={i}
                      className={on ? "day-chip on" : "day-chip"}
                      aria-pressed={on}
                      aria-label={DOW_FULL[i]}
                      title={DOW_FULL[i]}
                      onClick={() => {
                        setNoDays(false);
                        const next = on ? draft.days.filter((x) => x !== i) : [...draft.days, i];
                        setDraft({ ...draft, days: next.sort() });
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              {noDays && (
                <small className="field-error" role="alert">
                  Please select at least one day.
                </small>
              )}
            </div>
          </div>
          <div className="med-field">
            <span>Ends</span>
            <div className="med-ends">
              <span className="seg-switch" role="radiogroup" aria-label="Ends">
                <button
                  type="button"
                  role="radio"
                  aria-checked={draft.until === null}
                  className={draft.until === null ? "on" : ""}
                  onClick={() => setDraft({ ...draft, until: null })}
                >
                  Never
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={draft.until !== null}
                  className={draft.until !== null ? "on" : ""}
                  onClick={() => setDraft({ ...draft, until: draft.until ?? inDays(7) })}
                >
                  On a date
                </button>
              </span>
              {draft.until !== null && (
                <DatePicker
                  value={draft.until}
                  min={dayKey()}
                  label="Last day"
                  onChange={(v) => setDraft({ ...draft, until: v })}
                />
              )}
            </div>
          </div>
          <label className="med-field">
            <span>Note</span>
            <input
              className="text-input"
              maxLength={60}
              placeholder="Optional, e.g. after meals"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </label>
          <div className="med-form-actions">
            {draft.id && (
              <button
                className="link danger-link"
                onClick={() => setRemoving(meds.find((m) => m.id === draft.id) ?? null)}
              >
                <IconTrash size={14} /> Remove
              </button>
            )}
            <span className="spacer" />
            <button
              className="pill"
              onClick={() => {
                setNoDays(false);
                setDraft(null);
              }}
            >
              Cancel
            </button>
            <button className="pill primary" onClick={save} disabled={!canSave}>
              Save
            </button>
          </div>
        </div>
      ) : (
        meds.length < MAX_MEDS && (
          <div className="row">
            <button className={meds.length ? "pill" : "pill primary"} onClick={() => setDraft(EMPTY)}>
              <IconPlus size={15} strokeWidth={2.6} /> {meds.length ? "Add another" : "Add a medicine"}
            </button>
          </div>
        )
      )}

      {meds.length > 0 && (
        <p className="muted small meds-note">
          Medicine reminders come even when water reminders are paused. Tumbli only reminds you; follow your
          doctor's or the label's instructions.
        </p>
      )}

      {logsOpen && <MedLogs meds={meds} log={log} now={now} onClose={() => setLogsOpen(false)} />}

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          confirmLabel="Remove"
          cancelLabel="Keep it"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            store(meds.filter((m) => m.id !== removing.id));
            setRemoving(null);
            setDraft(null);
          }}
        >
          Tumbli stops reminding you about it.
        </ConfirmDialog>
      )}
    </section>
  );
}

/** The last 7 days of one medicine: green all taken, coral something missed, faint no doses. */
function MedDots({ med, log, now }: { med: Med; log: ReturnType<typeof loadMedLog>; now: number }) {
  const days = medHistory(med, log, new Date(now));
  if (days.every((d) => d.total === 0)) return null;
  return (
    <span className="med-dots" aria-label="Last 7 days">
      {days.map((d) => {
        const kind = d.total === 0 ? "none" : d.taken === d.total ? "all" : d.taken > 0 ? "some" : "missed";
        const text = d.total === 0 ? "no doses" : `${d.taken} of ${d.total} taken`;
        return (
          <span key={d.day} className={`med-dot ${kind}`} title={`${d.label}: ${text}`}>
            {d.label.slice(0, 1)}
          </span>
        );
      })}
    </span>
  );
}

/** a sensible next time to suggest: 4 h after the last one */
function nextTime(times: string[]) {
  const last = [...times].sort().pop() ?? "08:00";
  const [h, m] = last.split(":").map(Number);
  return `${String((h + 4) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
