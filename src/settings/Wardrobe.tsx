import { Tumbler } from "../components/Tumbler";
import { IconCheck, IconLock, IconTrophy } from "../components/Icons";
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

/** Every achievement with its progress. */
export function Achievements({ history, goalMl }: { history: History; goalMl: number }) {
  const stats = computeStats(history, goalMl);
  const unlocked = loadUnlocked();
  return (
    <section className="card">
      <h2>Achievements</h2>
      <ul className="achievements">
        {ACHIEVEMENTS.map((a) => {
          const p = a.progress(stats);
          const done = !!unlocked[a.id] || p.value >= p.target;
          return (
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
          );
        })}
      </ul>
    </section>
  );
}
