/**
 * Tumbli's own time and date pickers: a button that opens a small themed panel, in place of
 * the browser's built-in ones (which look like a plain system list and ignore the theme).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

const ITEM = 34; // px per row in a wheel

/**
 * A scrolling column of choices (like a phone's time picker): scroll or click, and the row
 * that settles in the middle band is picked. Arrow keys work too.
 */
function Wheel({
  items,
  index,
  onPick,
  label,
}: {
  items: string[];
  index: number;
  onPick: (i: number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // show the picked row in the middle (on open, or when it changes from outside)
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM) !== index) el.scrollTop = index * ITEM;
  }, [index]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const settle = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM)));
      if (i !== index) onPick(i);
    }, 80);
  };
  const go = (i: number) => ref.current?.scrollTo({ top: i * ITEM, behavior: "smooth" });
  return (
    <div
      className="wheel"
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={settle}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const i = Math.max(0, Math.min(items.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)));
          onPick(i);
          go(i);
        }
      }}
    >
      <div className="wheel-pad" aria-hidden />
      {items.map((x, i) => (
        <div
          key={x}
          role="option"
          aria-selected={i === index}
          className={i === index ? "wheel-item on" : "wheel-item"}
          onClick={() => go(i)}
        >
          {x}
        </div>
      ))}
      <div className="wheel-pad" aria-hidden />
    </div>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));
const HALVES = ["AM", "PM"];

/** Pick any time of day ("HH:MM", 24 h) on three wheels: hour, minute, am / pm. */
export function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [h, m] = value.split(":").map(Number);
  const pm = h >= 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  // the latest value, so two wheels settling at once both count
  const latest = useRef(value);
  latest.current = value;
  const set = (part: { hour12?: number; minute?: number; pm?: boolean }) => {
    const [ch, cm] = latest.current.split(":").map(Number);
    const hour12 = part.hour12 ?? (ch % 12 === 0 ? 12 : ch % 12);
    const isPm = part.pm ?? ch >= 12;
    const next = `${pad((hour12 % 12) + (isPm ? 12 : 0))}:${pad(part.minute ?? cm)}`;
    latest.current = next;
    onChange(next);
  };

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
      <div className="tp-now">{timeLabel(value)}</div>
      <div className="wheels">
        <Wheel items={HOURS} index={h12 - 1} label="Hour" onPick={(i) => set({ hour12: i + 1 })} />
        <span className="wheel-colon" aria-hidden>
          :
        </span>
        <Wheel items={MINUTES} index={m} label="Minute" onPick={(i) => set({ minute: i })} />
        <Wheel items={HALVES} index={pm ? 1 : 0} label="AM or PM" onPick={(i) => set({ pm: i === 1 })} />
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
