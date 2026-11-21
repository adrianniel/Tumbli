import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { IconMoon, IconSun } from "./Icons";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function hourLabel(h: number) {
  const hh = ((h % 24) + 24) % 24;
  if (hh === 0) return "12 am";
  if (hh === 12) return "12 pm";
  return hh < 12 ? `${hh} am` : `${hh - 12} pm`;
}

/**
 * A day timeline with two handles for "from" and "to".
 * Hours are 0..24 on the track; an end of 24 is stored as 0 (midnight).
 */
export function HourRange({
  start,
  end,
  onChange,
}: {
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}) {
  const s = clamp(start, 0, 23);
  // 0 (or an overnight end) shows as midnight at the far right
  const e = end === 0 || end <= s ? 24 : end;
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef<"s" | "e" | null>(null);

  const emit = (ns: number, ne: number) => onChange(ns, ne % 24);
  const setS = (h: number) => emit(clamp(h, 0, e - 1), e);
  const setE = (h: number) => emit(s, clamp(h, s + 1, 24));

  const hourAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.round(clamp((clientX - r.left) / r.width, 0, 1) * 24);
  };

  const onDown = (ev: PointerEvent<HTMLDivElement>) => {
    const h = hourAt(ev.clientX);
    dragging.current = Math.abs(h - s) <= Math.abs(h - e) ? "s" : "e";
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    if (dragging.current === "s") setS(h);
    else setE(h);
  };
  const onMove = (ev: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const h = hourAt(ev.clientX);
    if (dragging.current === "s") setS(h);
    else setE(h);
  };
  const onUp = () => (dragging.current = null);

  const key = (which: "s" | "e") => (ev: KeyboardEvent) => {
    const d = ev.key === "ArrowLeft" || ev.key === "ArrowDown" ? -1 : ev.key === "ArrowRight" || ev.key === "ArrowUp" ? 1 : 0;
    if (!d) return;
    ev.preventDefault();
    if (which === "s") setS(s + d);
    else setE(e + d);
  };

  const pct = (h: number) => `${(h / 24) * 100}%`;
  const hours = e - s;

  return (
    <div className="hr">
      <div className="hr-read">
        <b>{hourLabel(s)}</b>
        <span className="hr-dash" aria-hidden />
        <b>{hourLabel(e)}</b>
        <small>{hours === 24 ? "all day" : `${hours} hours`}</small>
      </div>
      <div className="hr-track" ref={track} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
        <div className="hr-sky" aria-hidden />
        <div className="hr-fill" style={{ left: pct(s), width: pct(hours) }} />
        <div
          className="hr-handle"
          role="slider"
          tabIndex={0}
          aria-label="Start time"
          aria-valuemin={0}
          aria-valuemax={23}
          aria-valuenow={s}
          aria-valuetext={hourLabel(s)}
          style={{ left: pct(s) }}
          onKeyDown={key("s")}
        />
        <div
          className="hr-handle"
          role="slider"
          tabIndex={0}
          aria-label="End time"
          aria-valuemin={1}
          aria-valuemax={24}
          aria-valuenow={e}
          aria-valuetext={hourLabel(e)}
          style={{ left: pct(e) }}
          onKeyDown={key("e")}
        />
      </div>
      <div className="hr-ticks" aria-hidden>
        <span>
          <IconMoon size={13} /> 12 am
        </span>
        <span>6 am</span>
        <span>
          <IconSun size={13} /> noon
        </span>
        <span>6 pm</span>
        <span>12 am</span>
      </div>
    </div>
  );
}

/** A row of pill chips, one selected. */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? "chip-opt on" : "chip-opt"}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const INTERVAL_CHIPS = [15, 20, 30, 45, 60, 90, 120].map((m) => ({
  value: m,
  label: m < 60 ? `${m}m` : m === 90 ? "1½h" : `${m / 60}h`,
}));

/** "Remind me every" chip value for Auto (Tumbli paces the reminders to the goal) */
export const AUTO_CHIP = 0;
export const REMIND_CHIPS = [{ value: AUTO_CHIP, label: "Auto" }, ...INTERVAL_CHIPS];

/** A glass or bottle drawn at a height that matches its size. */
export function Vessel({ kind, ml, max }: { kind: "glass" | "tumbler"; ml: number; max: number }) {
  const h = Math.round(24 + (ml / max) * 34);
  const w = kind === "glass" ? Math.round(h * 0.62) : Math.round(h * 0.5);
  return (
    <svg className="vessel" width={w + 4} height={h + 4} viewBox={`-2 -2 ${w + 4} ${h + 4}`} aria-hidden>
      {kind === "glass" ? (
        <>
          <path d={`M0 0 H${w} L${w * 0.86} ${h} H${w * 0.14} Z`} className="v-body" />
          <path d={`M${w * 0.06} ${h * 0.42} H${w * 0.94} L${w * 0.86} ${h} H${w * 0.14} Z`} className="v-water" />
          <path d={`M0 0 H${w} L${w * 0.86} ${h} H${w * 0.14} Z`} className="v-line" />
        </>
      ) : (
        <>
          <rect x={w * 0.3} y={0} width={w * 0.4} height={h * 0.1} rx={2} className="v-cap" />
          <path
            d={`M${w * 0.22} ${h * 0.12} H${w * 0.78} Q${w} ${h * 0.14} ${w} ${h * 0.3} V${h - 4} Q${w} ${h} ${w - 4} ${h} H4 Q0 ${h} 0 ${h - 4} V${h * 0.3} Q0 ${h * 0.14} ${w * 0.22} ${h * 0.12} Z`}
            className="v-body"
          />
          <path
            d={`M0 ${h * 0.5} H${w} V${h - 4} Q${w} ${h} ${w - 4} ${h} H4 Q0 ${h} 0 ${h - 4} Z`}
            className="v-water"
          />
          <path
            d={`M${w * 0.22} ${h * 0.12} H${w * 0.78} Q${w} ${h * 0.14} ${w} ${h * 0.3} V${h - 4} Q${w} ${h} ${w - 4} ${h} H4 Q0 ${h} 0 ${h - 4} V${h * 0.3} Q0 ${h * 0.14} ${w * 0.22} ${h * 0.12} Z`}
            className="v-line"
          />
        </>
      )}
    </svg>
  );
}

/** Size tiles with a drawn glass / bottle each. */
export function SizePicker({
  kind,
  sizes,
  value,
  onChange,
}: {
  kind: "glass" | "tumbler";
  sizes: { ml: number; hint: string }[];
  value: number;
  onChange: (ml: number) => void;
}) {
  const max = Math.max(...sizes.map((x) => x.ml));
  return (
    <div
      className="sizes"
      style={{ gridTemplateColumns: `repeat(${sizes.length <= 4 ? sizes.length : 3}, minmax(0, 1fr))` }}
      role="radiogroup"
      aria-label={kind === "glass" ? "Glass size" : "Tumbler size"}
    >
      {sizes.map((x) => (
        <button
          key={x.ml}
          role="radio"
          aria-checked={x.ml === value}
          className={x.ml === value ? "size on" : "size"}
          onClick={() => onChange(x.ml)}
        >
          <span className="size-art">
            <Vessel kind={kind} ml={x.ml} max={max} />
          </span>
          <b>{x.ml >= 1000 ? `${x.ml / 1000} L` : `${x.ml} ml`}</b>
          <small>{x.hint}</small>
        </button>
      ))}
    </div>
  );
}
