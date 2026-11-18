import { useEffect, useRef, useState } from "react";
import { Tumbler } from "../components/Tumbler";

const FILL_MS = 1700; // how long Tumbli takes to fill up
const HOLD_MS = 1100; // how long "All set!" stays before moving on

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Shown right after the setup: Tumbli fills up, jumps, and says it's ready. */
export function Ready({ name, onDone }: { name: string; onDone: () => void }) {
  const [fill, setFill] = useState(0);
  const [done, setDone] = useState(false);
  const cb = useRef(onDone);
  cb.current = onDone;

  useEffect(() => {
    let tick: number | undefined;
    let timer: number | undefined;
    const finish = () => {
      setDone(true);
      timer = window.setTimeout(() => cb.current(), HOLD_MS);
    };
    if (reduceMotion()) {
      setFill(1);
      finish();
    } else {
      // a timer rather than requestAnimationFrame, which stalls in background windows
      const start = Date.now();
      tick = window.setInterval(() => {
        const p = Math.min(1, (Date.now() - start) / FILL_MS);
        setFill(1 - Math.pow(1 - p, 3)); // ease-out
        if (p >= 1) {
          window.clearInterval(tick);
          finish();
        }
      }, 16);
    }
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(timer);
    };
  }, []);

  const first = name.trim();
  return (
    <main className="onb ready" aria-live="polite">
      <div className="ready-stage">
        <div className="ready-halo" aria-hidden />
        <div className={done ? "ready-buddy jump" : "ready-buddy filling"}>
          <Tumbler fill={fill} size={150} arms happy={done} />
        </div>
        <div className="ready-shadow" aria-hidden />
        {done && (
          <div className="ready-sparkles" aria-hidden>
            <span>✦</span>
            <span>✦</span>
            <span>✦</span>
            <span>✦</span>
          </div>
        )}
      </div>
      <h1 key={done ? "done" : "filling"} className="ready-title">
        {done ? (first ? `All set, ${first}!` : "All set!") : "Filling up Tumbli…"}
      </h1>
      <p className="sub">{done ? "Let's drink some water." : "Getting your plan ready"}</p>
      <div className="ready-bar" aria-hidden>
        <div style={{ width: `${fill * 100}%` }} />
      </div>
    </main>
  );
}
