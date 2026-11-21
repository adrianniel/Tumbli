/**
 * Tumbli's own time and date pickers: a button that opens a small themed panel, in place of
 * the browser's built-in ones (which look like a plain system list and ignore the theme).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronLeft } from "./Icons";

/** A panel under `trigger` that closes on Esc or a click anywhere else. */
function Popover({
  open,
  onClose,
  trigger,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  label: string;
}) {
  const box = useRef<HTMLSpanElement>(null);
  // open toward the side with room, so the panel never runs off the window
  const [right, setRight] = useState(false);
  useEffect(() => {
    if (!open || !box.current) return;
    const r = box.current.getBoundingClientRect();
    setRight(r.left + 244 > window.innerWidth - 8);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !box.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open, onClose]);
  return (
    <span className="picker" ref={box}>
      {trigger}
      {open && (
        <div className={right ? "picker-pop right" : "picker-pop"} role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </span>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "08:00" -> "8:00 am" */
export function timeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "am" : "pm"}`;
}

/** Pick a time of day ("HH:MM", 24 h): hour, minute in 5-minute steps, am / pm. */
export function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [h, m] = value.split(":").map(Number);
  const pm = h >= 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const set = (hour12: number, minute: number, isPm: boolean) =>
    onChange(`${pad((hour12 % 12) + (isPm ? 12 : 0))}:${pad(minute)}`);
  const minute5 = Math.round(m / 5) * 5;

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      label={label}
      trigger={
        <button
          type="button"
          className={open ? "picker-btn open" : "picker-btn"}
          aria-label={`${label}: ${timeLabel(value)}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {timeLabel(value)}
        </button>
      }
    >
      <div className="tp-head">
        <span className="tp-now">{timeLabel(value)}</span>
        <span className="seg-switch" role="radiogroup" aria-label="AM or PM">
          {(["am", "pm"] as const).map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={(x === "pm") === pm}
              className={(x === "pm") === pm ? "on" : ""}
              onClick={() => set(h12, m, x === "pm")}
            >
              {x.toUpperCase()}
            </button>
          ))}
        </span>
      </div>
      <div className="tp-label">Hour</div>
      <div className="tp-grid" role="radiogroup" aria-label="Hour">
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((x) => (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={x === h12}
            className={x === h12 ? "on" : ""}
            onClick={() => set(x, m, pm)}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="tp-label">Minute</div>
      <div className="tp-grid" role="radiogroup" aria-label="Minute">
        {Array.from({ length: 12 }, (_, i) => i * 5).map((x) => (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={x === minute5}
            className={x === minute5 ? "on" : ""}
            onClick={() => set(h12, x, pm)}
          >
            :{pad(x)}
          </button>
        ))}
      </div>
      <button type="button" className="pill primary tp-done" onClick={() => setOpen(false)}>
        Done
      </button>
    </Popover>
  );
}

const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const dateLabel = (s: string) =>
  parse(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** Pick a day (YYYY-MM-DD) on a small month calendar; days before `min` can't be picked. */
export function DatePicker({
  value,
  min,
  onChange,
  label,
}: {
  value: string;
  min: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = parse(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const today = key(new Date());
  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const minMonth = parse(min);
  const canBack = month > new Date(minMonth.getFullYear(), minMonth.getMonth(), 1);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      label={label}
      trigger={
        <button
          type="button"
          className={open ? "picker-btn open" : "picker-btn"}
          aria-label={`${label}: ${dateLabel(value)}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {dateLabel(value)}
        </button>
      }
    >
      <div className="dp-head">
        <button
          type="button"
          className="dp-nav"
          disabled={!canBack}
          aria-label="Previous month"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          <IconChevronLeft size={16} />
        </button>
        <b>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b>
        <button
          type="button"
          className="dp-nav next"
          aria-label="Next month"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          <IconChevronLeft size={16} />
        </button>
      </div>
      <div className="dp-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="dp-dow">
            {d}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={i}
              type="button"
              disabled={key(d) < min}
              className={[key(d) === value ? "on" : "", key(d) === today ? "today" : ""].join(" ")}
              onClick={() => {
                onChange(key(d));
                setOpen(false);
              }}
            >
              {d.getDate()}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </Popover>
  );
}
