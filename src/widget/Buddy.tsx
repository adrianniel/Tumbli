import type { MouseEvent } from "react";
import { Tumbler } from "../components/Tumbler";
import { IconCheck, IconGear, IconPlus, IconRefill } from "../components/Icons";

/** Tumbli on the desktop: the bottle, its shadow, the badge underneath and the little effects. */
export function Buddy({
  gestures,
  boing,
  fill,
  happy,
  calling,
  sleeping,
  outfit,
  badge,
  empty,
  onRefill,
  plusOne,
  nudging,
  celebrate,
}: {
  gestures: {
    onMouseDown: (e: MouseEvent) => void;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
    onDoubleClick: () => void;
  };
  /** bumps on every click to replay the jump animation */
  boing: number;
  fill: number;
  happy: boolean;
  calling: boolean;
  sleeping: boolean;
  outfit?: string | null;
  badge: string;
  /** tumbler mode with an empty tumbler: the badge becomes a Refill button */
  empty: boolean;
  onRefill: () => void;
  /** "+250 ml" after a drink, or null */
  plusOne: string | null;
  nudging: boolean;
  celebrate: boolean;
}) {
  return (
    <div className="buddy" {...gestures}>
      <div className="hop">
        <div className={boing ? `boing boing-${boing % 2}` : "boing"}>
          <div className="bob">
            <div className="squish">
              <Tumbler
                fill={fill}
                size={84}
                happy={happy}
                arms
                calling={calling}
                sleeping={sleeping}
                outfit={outfit}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="ground" />
      {empty && !nudging ? (
        <button
          className="count refill-badge"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={onRefill}
          title="I refilled my tumbler"
        >
          <IconRefill size={11} strokeWidth={2.8} /> Refill
        </button>
      ) : (
        <div className="count">{badge}</div>
      )}
      {sleeping && (
        <div className="zzz" aria-hidden>
          <span>z</span>
          <span>z</span>
        </div>
      )}
      {plusOne && <div className="plus-one">{plusOne}</div>}
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
  );
}

/** The quick buttons that slide out on hover. */
export function HoverActions({
  tumblerMode,
  sipMl,
  onDrink,
  onFinish,
  onRefill,
  onSettings,
}: {
  tumblerMode: boolean;
  sipMl: number;
  onDrink: () => void;
  onFinish: () => void;
  onRefill: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="hover-actions">
      <button
        className="mini plus"
        onClick={onDrink}
        title={tumblerMode ? `I drank ~${sipMl} ml` : "I drank a glass"}
        aria-label={tumblerMode ? "I drank some" : "I drank a glass"}
      >
        <IconPlus size={14} strokeWidth={3} />
      </button>
      {tumblerMode && (
        <>
          <button className="mini" onClick={onFinish} title="I finished my tumbler" aria-label="Finished my tumbler">
            <IconCheck size={13} strokeWidth={2.8} />
          </button>
          <button className="mini" onClick={onRefill} title="I refilled my tumbler" aria-label="Refilled my tumbler">
            <IconRefill size={13} strokeWidth={2.4} />
          </button>
        </>
      )}
      <button className="mini" onClick={onSettings} title="Settings" aria-label="Settings">
        <IconGear size={14} strokeWidth={2.2} />
      </button>
    </div>
  );
}
