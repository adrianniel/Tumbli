import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Tumbler } from "../components/Tumbler";
import { IconBell, IconLock, IconTarget } from "../components/Icons";

/** What Tumbli says on the intro, typed out one after another. */
const LINES = ["Hi there!", "I'm Tumbli.", "A tumbler, just like yours.", "Let's drink some water!"];
/** What it says when you poke it. */
const POKES = ["Hehe, that tickles!", "Careful, I'm full of water!", "Boing!", "Hi again!", "Splish splash!"];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** First screen of the setup: Tumbli drops in, says hi, and follows your mouse with its eyes. */
export function Intro({ onStart }: { onStart: () => void }) {
  const buddy = useRef<HTMLButtonElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [line, setLine] = useState(0);
  const [poke, setPoke] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [boing, setBoing] = useState(0);

  // eyes follow the mouse
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = buddy.current?.getBoundingClientRect();
      if (!r) return;
      const dx = (e.clientX - (r.left + r.width / 2)) / 180;
      const dy = (e.clientY - (r.top + r.height * 0.42)) / 180;
      setLook({ x: clamp(dx, -1, 1), y: clamp(dy, -1, 1) });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // type out the current line, then move on to the next one
  const text = poke ?? LINES[line];
  useEffect(() => {
    if (reduceMotion()) {
      setTyped(text);
      return;
    }
    let i = 0;
    let t: number | undefined;
    setTyped("");
    const start = window.setTimeout(
      function tick() {
        i++;
        setTyped(text.slice(0, i));
        if (i < text.length) t = window.setTimeout(tick, 38);
        else
          t = window.setTimeout(
            () => {
              if (poke) setPoke(null);
              else setLine((l) => (l + 1) % LINES.length);
            },
            poke ? 1400 : 1900,
          );
      },
      line === 0 && !poke ? 1000 : 250, // the first line waits for Tumbli to land
    );
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(t);
    };
  }, [text, line, poke]);

  const onPoke = () => {
    setBoing((n) => n + 1);
    setPoke(POKES[Math.floor(Math.random() * POKES.length)]);
  };

  const traits = [
    { icon: <IconTarget size={16} />, label: "Fits your body" },
    { icon: <IconBell size={16} />, label: "Gentle nudges" },
    { icon: <IconLock size={16} />, label: "Stays on your PC" },
  ];

  return (
    <main className="onb intro intro2">
      <div className="stage">
        <div className="halo2" aria-hidden>
          <span className="bub b1" />
          <span className="bub b2" />
          <span className="bub b3" />
          <span className="bub b4" />
        </div>
        <div className="shadow2" aria-hidden />
        <div className="dropper">
          <button
            ref={buddy}
            className={boing ? `buddy-btn poke-${boing % 2}` : "buddy-btn"}
            onClick={onPoke}
            aria-label="Poke Tumbli"
          >
            <span className="floaty">
              <Tumbler fill={0.55} size={150} arms look={look} calling={!!poke} />
            </span>
          </button>
        </div>
        <div className="splash2" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
        <div className="says2" aria-live="polite">
          {typed}
          <span className="caret" aria-hidden />
        </div>
      </div>

      <h1 className="wordmark" aria-label="Tumbli">
        {[..."Tumbli"].map((c, i) => (
          <span key={i} aria-hidden style={{ "--i": i } as CSSProperties}>
            {c}
          </span>
        ))}
      </h1>
      <p className="tagline">
        Your tumbler buddy. I live on your screen, fill up as you drink, and nudge you when it's time for water.
      </p>
      <div className="traits">
        {traits.map((t, i) => (
          <span key={t.label} className="trait" style={{ "--i": i } as CSSProperties}>
            {t.icon}
            {t.label}
          </span>
        ))}
      </div>

      <footer className="onb-nav intro-cta">
        <button className="primary-btn" onClick={onStart}>
          Let's get started
        </button>
        <p className="fine">Takes about 30 seconds · psst, try clicking Tumbli</p>
      </footer>
    </main>
  );
}
