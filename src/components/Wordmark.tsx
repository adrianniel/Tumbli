import { useId, type CSSProperties } from "react";
import "./wordmark.css";

/** the tumbler's outline on the 52 x 170 grid (1 unit = 1 px at a 168 px font size) */
const BODY = "M3 92 Q3 80 15 79 L37 79 Q49 80 49 92 L49 160 Q49 170 39 170 L13 170 Q3 170 3 160 Z";

/**
 * The Tumbli wordmark: "Tumbl" and an "i" drawn as a little tumbler whose floating cap
 * is the dot (the same design as the ad and the brand images, scripts/ad/wordmark.mjs).
 * With `animate`, the letters pop in one by one and the cap drops onto the "i", then bobs.
 */
export function Wordmark({ size = 56, animate = false, className = "" }: { size?: number; animate?: boolean; className?: string }) {
  const clip = useId();
  return (
    <span
      className={`wm ${animate ? "wm-animate" : ""} ${className}`}
      style={{ "--wm-size": `${size}px` } as CSSProperties}
      role="img"
      aria-label="Tumbli"
    >
      {[..."Tumbl"].map((c, i) => (
        <span key={i} className="wm-l" aria-hidden style={{ "--i": i } as CSSProperties}>
          {c}
        </span>
      ))}
      <svg className="wm-i" viewBox="0 0 52 170" aria-hidden style={{ "--i": 5 } as CSSProperties}>
        <defs>
          <clipPath id={clip}>
            <path d={BODY} />
          </clipPath>
        </defs>
        <g className="wm-body">
          <rect x="17" y="71" width="18" height="10" rx="2.5" className="wm-neck" />
          <path d={BODY} className="wm-ink" />
          <g clipPath={`url(#${clip})`}>
            <path d="M0 124 Q13 117 26 124 T52 124 V170 H0Z" className="wm-water" />
          </g>
          <path d="M11 96 L11 140" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".55" />
        </g>
        <g className="wm-cap">
          <path d="M18 41 L18 33 Q18 27 24 27 L28 27 Q34 27 34 33 L34 41" fill="none" className="wm-strap" strokeWidth="5" strokeLinejoin="round" />
          <rect x="8" y="40" width="36" height="17" rx="5.5" className="wm-capfill" />
          <rect x="12" y="44" width="28" height="3.4" rx="1.7" fill="#fff" opacity=".5" />
        </g>
      </svg>
    </span>
  );
}
