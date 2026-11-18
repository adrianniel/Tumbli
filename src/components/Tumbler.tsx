type Props = {
  /** water level, 0..1 */
  fill: number;
  /** rendered height in px; width is 70% of it */
  size?: number;
  /** happy eyes when the goal is reached */
  happy?: boolean;
};

const BODY =
  "M37 24 L63 24 Q71 24 71 33 L71 88 Q71 97 62 97 L38 97 Q29 97 29 88 L29 33 Q29 24 37 24 Z";
const INK = "#0E3F6E";

/** Tumbli: a tall sport bottle with a carry loop, a cap and a face. Water follows `fill`. */
export function Tumbler({ fill, size = 64, happy = false }: Props) {
  const level = Math.max(0, Math.min(1, fill));
  // Body interior spans y = 24..97 in the viewBox.
  const waterTop = 97 - level * 73;
  return (
    <svg
      className="tumbler"
      width={Math.round(size * 0.7)}
      height={size}
      viewBox="15 0 70 100"
      aria-hidden
    >
      <defs>
        <clipPath id="tumbli-body">
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* body + water */}
      <path d={BODY} fill="#FFFFFF" />
      <g clipPath="url(#tumbli-body)">
        <g className="water" style={{ transform: `translateY(${waterTop}px)` }}>
          <path
            className="wave"
            d="M-100 3 Q-87.5 -1 -75 3 T-50 3 T-25 3 T0 3 T25 3 T50 3 T75 3 T100 3 T125 3 T150 3 T175 3 T200 3 V200 H-100 Z"
            fill="#7FD3FF"
          />
        </g>
      </g>
      <path d={BODY} fill="none" stroke={INK} strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M35 36 L35 82" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />

      {/* carry loop + cap */}
      <path d="M42 13 Q42 3 50 3 Q58 3 58 13" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <rect x="34" y="11" width="32" height="15" rx="5" fill={INK} />
      <rect x="38" y="14" width="13" height="3" rx="1.5" fill="#2E8BE6" />

      {/* face */}
      <g className="face">
        {happy ? (
          <>
            <path d="M41 51 Q44 47 47 51" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M53 51 Q56 47 59 51" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse className="eye" cx="44" cy="50" rx="2.8" ry="3.4" fill={INK} />
            <ellipse className="eye" cx="56" cy="50" rx="2.8" ry="3.4" fill={INK} />
          </>
        )}
        <path d="M45.5 57.5 Q50 61.5 54.5 57.5" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <ellipse cx="38.5" cy="56.5" rx="3.3" ry="2" fill="#FF8FA6" />
        <ellipse cx="61.5" cy="56.5" rx="3.3" ry="2" fill="#FF8FA6" />
      </g>
    </svg>
  );
}
