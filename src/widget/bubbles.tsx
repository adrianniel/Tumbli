/** The speech bubbles Tumbli shows next to itself. */
import { useState, type ReactNode } from "react";
import { IconBell, IconBulb, IconClose, IconDrop, IconPill, IconQuestion, IconRefill } from "../components/Icons";
import type { Fact } from "../lib/facts";
import { TOUR } from "./tour";

export const SNOOZE_MIN = 10;

function Bubble({ className = "", label, children }: { className?: string; label: string; children: ReactNode }) {
  return (
    <div className={`bubble-card ${className}`} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}

export function ReminderBubble({
  message,
  sub,
  empty,
  drinkLabel,
  onDrink,
  onRefill,
  onSnooze,
  onSkip,
}: {
  message: string;
  sub: ReactNode;
  empty: boolean;
  drinkLabel: string;
  onDrink: () => void;
  onRefill: () => void;
  onSnooze: () => void;
  onSkip: () => void;
}) {
  return (
    <Bubble label="Water reminder">
      <div className="bubble-kicker">
        <IconBell size={13} strokeWidth={2.4} /> Water break
      </div>
      <div className="nudge-title">{message}</div>
      <div className="nudge-sub">{sub}</div>
      <div className="nudge-actions">
        {empty ? (
          <button className="btn primary" onClick={onRefill}>
            <IconRefill size={14} /> Refilled
          </button>
        ) : (
          <button className="btn primary" onClick={onDrink}>
            {drinkLabel}
          </button>
        )}
        <button className="btn" onClick={onSnooze}>
          {SNOOZE_MIN} min
        </button>
        <button className="btn ghost" onClick={onSkip} title="Skip this reminder" aria-label="Skip">
          <IconClose size={15} />
        </button>
      </div>
    </Bubble>
  );
}

export function MedBubble({
  names,
  time,
  note,
  onTaken,
  onSnooze,
  onSkip,
}: {
  /** "Metformin and Vitamin D" */
  names: string;
  /** "8:00 am"; empty when the doses are from different times */
  time: string;
  note: string;
  onTaken: () => void;
  onSnooze: () => void;
  onSkip: () => void;
}) {
  return (
    <Bubble className="med-card" label="Medicine reminder">
      <div className="bubble-kicker">
        <IconPill size={13} strokeWidth={2.4} /> Medicine{time && ` · ${time}`}
      </div>
      <div className="nudge-title">Time for your {names}</div>
      <div className="nudge-sub">
        {note ? `${note} · ` : ""}Take it with a glass of water
      </div>
      <div className="nudge-actions">
        <button className="btn primary" onClick={onTaken}>
          Taken
        </button>
        <button className="btn" onClick={onSnooze}>
          {SNOOZE_MIN} min
        </button>
        <button className="btn ghost" onClick={onSkip} title="Skip this dose" aria-label="Skip this dose">
          <IconClose size={15} />
        </button>
      </div>
    </Bubble>
  );
}

export type AwayDose = { key: string; name: string; time: string };

/**
 * Back after time away: how long, and a quick check-in to log the water and the medicine
 * doses the user had while away (or say they missed them).
 */
export function WelcomeBackBubble({
  name,
  away,
  missed,
  water,
  doses,
  onDone,
  onClose,
}: {
  name: string;
  /** "almost 2 hours" */
  away: string;
  /** water reminders that went by */
  missed: number;
  /** what to offer for water ("1", "2", "3" glasses or "250 ml"...), null: don't ask about water */
  water: { label: string; ml: number }[] | null;
  /** medicine doses from the time away nobody has answered yet */
  doses: AwayDose[];
  onDone: (waterMl: number, doses: Record<string, "taken" | "missed">) => void;
  onClose: () => void;
}) {
  const [ml, setMl] = useState<number | null>(null);
  const [picked, setPicked] = useState<Record<string, "taken" | "missed">>({});
  const shown = doses.slice(0, water ? 2 : 3);
  const glasses = water && water[1]?.label === "1";
  return (
    <Bubble className="welcome-card" label="Welcome back">
      <div className="bubble-kicker">
        <IconDrop size={13} strokeWidth={2.4} /> Welcome back{name ? `, ${name}` : ""}!
      </div>
      <div className="nudge-title">Away for {away}</div>
      {/* (room is tight with medicine rows: the question goes then) */}
      {doses.length === 0 ? (
        <div className="nudge-sub">
          {missed === 1 ? "1 water break" : `${missed} water breaks`} went by. How much did you drink?
        </div>
      ) : (
        <div className="nudge-sub">{water ? "What did you have while away?" : "Did you take your medicine?"}</div>
      )}
      {water && (
        <div className="checkin-row">
          <span>{glasses ? "Glasses" : "Water"}</span>
          <div className="seg" role="radiogroup" aria-label="Water while away">
            {water.map((o) => (
              <button
                key={o.ml}
                role="radio"
                aria-checked={ml === o.ml}
                className={ml === o.ml ? "on" : ""}
                onClick={() => setMl(o.ml)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {shown.map((d) => (
        <div className="checkin-row" key={d.key}>
          <span className="checkin-med" title={`${d.name} at ${d.time}`}>
            <IconPill size={12} strokeWidth={2.4} /> {d.name} <small>{d.time}</small>
          </span>
          <div className="seg" role="radiogroup" aria-label={`${d.name} at ${d.time}`}>
            {(["taken", "missed"] as const).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={picked[d.key] === s}
                className={picked[d.key] === s ? `on ${s}` : ""}
                onClick={() => setPicked({ ...picked, [d.key]: s })}
              >
                {s === "taken" ? "Taken" : "Missed"}
              </button>
            ))}
          </div>
        </div>
      ))}
      {doses.length > shown.length && (
        <div className="checkin-more">+{doses.length - shown.length} more in Settings</div>
      )}
      <div className="nudge-actions">
        <button className="btn primary" onClick={() => onDone(ml ?? 0, picked)}>
          Done
        </button>
        <button className="btn ghost" onClick={onClose} title="Close" aria-label="Close">
          <IconClose size={15} />
        </button>
      </div>
    </Bubble>
  );
}

export function TourBubble({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
  const last = step === TOUR.length - 1;
  return (
    <Bubble className="tour-card" label="Quick tour">
      <div className="bubble-head">
        <div className="bubble-kicker">
          Quick tour · {step + 1}/{TOUR.length}
        </div>
        <button className="close" onClick={onSkip} aria-label="Skip tour">
          Skip
        </button>
      </div>
      <div className="tour-title">{TOUR[step].title}</div>
      <div className="tour-body">{TOUR[step].body}</div>
      <div className="tour-foot">
        <div className="tour-dots" aria-hidden>
          {TOUR.map((_, i) => (
            <span key={i} className={i === step ? "on" : ""} />
          ))}
        </div>
        <button className="btn primary" onClick={onNext}>
          {last ? "Got it!" : "Next"}
        </button>
      </div>
    </Bubble>
  );
}

export function FactBubble({
  fact,
  revealed,
  onReveal,
  onAnother,
  onClose,
}: {
  fact: Fact;
  revealed: boolean;
  onReveal: () => void;
  onAnother: () => void;
  onClose: () => void;
}) {
  const trivia = fact.kind === "trivia";
  return (
    <Bubble className="fact" label={trivia ? "Trivia" : "Fun fact"}>
      <div className="bubble-head">
        <div className="bubble-kicker">
          {trivia ? (
            <>
              <IconQuestion size={13} strokeWidth={2.4} /> Trivia time
            </>
          ) : (
            <>
              <IconBulb size={13} strokeWidth={2.4} /> Did you know?
            </>
          )}
        </div>
        <button className="close" onClick={onClose} aria-label="Close">
          <IconClose size={14} />
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
        {trivia && !revealed ? (
          <button className="btn primary" onClick={onReveal}>
            Show answer
          </button>
        ) : (
          <button className="btn primary" onClick={onAnother}>
            Tell me another
          </button>
        )}
      </div>
    </Bubble>
  );
}

export function AwardBubble({
  title,
  desc,
  outfitName,
  onWear,
  onClose,
}: {
  title: string;
  desc: string;
  /** set when the achievement unlocks an outfit */
  outfitName?: string;
  onWear: () => void;
  onClose: () => void;
}) {
  return (
    <Bubble className="award" label="Achievement unlocked">
      <div className="bubble-kicker">Achievement unlocked!</div>
      <div className="nudge-title">{title}</div>
      <div className="nudge-sub">
        {desc}
        {outfitName && <> · New outfit: {outfitName}</>}
      </div>
      <div className="nudge-actions">
        {outfitName ? (
          <>
            <button className="btn primary" onClick={onWear}>
              Wear it
            </button>
            <button className="btn" onClick={onClose}>
              Not now
            </button>
          </>
        ) : (
          <button className="btn primary" onClick={onClose}>
            Nice!
          </button>
        )}
      </div>
    </Bubble>
  );
}

export function RecapBubble({
  liters,
  goalDays,
  best,
  changePct,
  onStats,
  onClose,
}: {
  liters: string;
  goalDays: number;
  best: string | null;
  changePct: number | null;
  onStats: () => void;
  onClose: () => void;
}) {
  return (
    <Bubble className="recap" label="Your week">
      <div className="bubble-kicker">Your week with Tumbli</div>
      <div className="nudge-title">{liters} L last week</div>
      <div className="nudge-sub">
        Goal reached on {goalDays} of 7 days{best && <> · best: {best}</>}
        {changePct !== null && (
          <span className={changePct >= 0 ? "trend up" : "trend down"}>
            {" "}
            · {changePct >= 0 ? "↑" : "↓"} {Math.abs(changePct)}% vs the week before
          </span>
        )}
      </div>
      <div className="nudge-actions">
        <button className="btn primary" onClick={onStats}>
          See my stats
        </button>
        <button className="btn" onClick={onClose}>
          Nice!
        </button>
      </div>
    </Bubble>
  );
}

export function RatingBubble({
  onRate,
  onLater,
  onNever,
  onFeedback,
}: {
  onRate: () => void;
  onLater: () => void;
  onNever: () => void;
  onFeedback: () => void;
}) {
  return (
    <Bubble className="rating" label="Rate Tumbli">
      <div className="bubble-kicker">Enjoying Tumbli?</div>
      <div className="nudge-title">Would you rate me on the Store?</div>
      <div className="nudge-sub">
        It takes a few seconds and helps other people find me.{" "}
        <button className="inline-link" onClick={onFeedback}>
          Something off? Tell me
        </button>
      </div>
      <div className="nudge-actions">
        <button className="btn primary" onClick={onRate}>
          Rate Tumbli
        </button>
        <button className="btn" onClick={onLater}>
          Later
        </button>
        <button className="btn ghost" onClick={onNever}>
          No thanks
        </button>
      </div>
    </Bubble>
  );
}
