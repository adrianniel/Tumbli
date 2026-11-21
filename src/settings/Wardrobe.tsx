import { Tumbler } from "../components/Tumbler";
import { useState } from "react";
import { IconCheck, IconChevronLeft, IconLock, IconTrophy } from "../components/Icons";
import {
  ACHIEVEMENTS,
  computeStats,
  loadUnlocked,
  OUTFITS,
  unlockedOutfits,
  type Outfit,
} from "../lib/achievements";
import type { History } from "../lib/store";

/** Pick what Tumbli wears; locked outfits show what earns them. */
export function Wardrobe({
  current,
  onWear,
}: {
  current: string | null;
  onWear: (o: Outfit | null) => void;
}) {
  const owned = unlockedOutfits();
  const how = (o: Outfit) => ACHIEVEMENTS.find((a) => a.outfit === o)?.desc ?? "";
  return (
    <section className="card">
      <h2>Tumbli's wardrobe</h2>
      <p className="muted small card-sub">Earn outfits by keeping your streak going.</p>
      <div className="wardrobe">
        <button className={current === null ? "outfit-tile on" : "outfit-tile"} onClick={() => onWear(null)}>
          <span className="outfit-art">
            <Tumbler fill={0.6} size={58} />
          </span>
          <b>Just me</b>
        </button>
        {OUTFITS.map((o) => {
          const has = owned.has(o.id);
          return (
            <button
              key={o.id}
              className={`outfit-tile ${current === o.id ? "on" : ""} ${has ? "" : "locked"}`}
              onClick={() => has && onWear(o.id)}
              disabled={!has}
              title={has ? `Wear the ${o.name.toLowerCase()}` : how(o.id)}
            >
              <span className="outfit-art">
                <Tumbler fill={0.6} size={58} outfit={o.id} />
                {!has && (
                  <span className="outfit-lock" aria-hidden>
                    <IconLock size={13} strokeWidth={2.4} />
                  </span>
                )}
              </span>
              <b>{o.name}</b>
              {!has && <small>{how(o.id)}</small>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const OPEN_KEY = "tumbli.achievementsOpen";

/**
 * Every achievement with its progress. Folded by default (the list is long): a shelf of
 * badges and a "Show all" handle that unfolds it.
 */
export function Achievements({ history, goalMl }: { history: History; goalMl: number }) {
  const stats = computeStats(history, goalMl);
  const unlocked = loadUnlocked();
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, open ? "0" : "1");
    } catch {
      /* not fatal */
    }
  };
  const rows = ACHIEVEMENTS.map((a) => {
    const p = a.progress(stats);
    return { a, p, done: !!unlocked[a.id] || p.value >= p.target };
  });
  const count = rows.filter((r) => r.done).length;

  return (
    <section className={open ? "card ach-card open" : "card ach-card"}>
      <div className="ach-head">
        <h2>Achievements</h2>
        <span className="ach-count">
          {count} of {rows.length}
        </span>
      </div>

      <div className="ach-shelf" aria-hidden={open}>
        <div className="ach-badges">
          {rows.map(({ a, done }) => (
            <span key={a.id} className={done ? "ach-badge done" : "ach-badge"} title={`${a.title}${done ? "" : " (locked)"}`}>
              {done ? <IconCheck size={13} strokeWidth={2.8} /> : <IconTrophy size={13} />}
            </span>
          ))}
        </div>
        <div className="ach-progress" aria-hidden>
          <div style={{ width: `${(count / rows.length) * 100}%` }} />
        </div>
      </div>

      <div className="ach-fold" id="ach-list">
        <div className="ach-fold-inner">
          <ul className="achievements">
            {rows.map(({ a, p, done }) => (
              <li key={a.id} className={done ? "done" : ""}>
                <span className="ach-icon" aria-hidden>
                  {done ? <IconCheck size={16} strokeWidth={2.6} /> : <IconTrophy size={16} />}
                </span>
                <div className="ach-main">
                  <div className="ach-top">
                    <b>{a.title}</b>
                    <small>{done ? "Done" : `${p.value}/${p.target} ${p.unit}`}</small>
                  </div>
                  <small className="muted">{a.desc}</small>
                  {!done && (
                    <div className="ach-bar" aria-hidden>
                      <div style={{ width: `${(p.value / p.target) * 100}%` }} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button className="ach-toggle" onClick={toggle} aria-expanded={open} aria-controls="ach-list">
        {open ? "Show less" : "Show all"}
        <span className="ach-toggle-chev">
          <IconChevronLeft size={14} strokeWidth={2.6} />
        </span>
      </button>
    </section>
  );
}
