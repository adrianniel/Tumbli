type Props = {
  /** water level, 0..1 */
  fill: number;
  size?: number;
  /** happy face when the goal is reached */
  happy?: boolean;
};

const BODY = "M23 30 L77 30 L70.5 91 Q70 96 64.5 96 L35.5 96 Q30 96 29.5 91 Z";

/** Tumbli: a little tumbler with a lid, a straw and a face. Water follows `fill`. */
export function Tumbler({ fill, size = 64, happy = false }: Props) {
  const level = Math.max(0, Math.min(1, fill));
  // Body interior spans y = 30..96 in the 100x100 viewBox.
  const waterTop = 96 - level * 66;
  return (
    <svg className="tumbler" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <clipPath id="tumbler-body">
          <path d={BODY} />
        </clipPath>
        <linearGradient id="tumbler-water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#6fdcff" />
          <stop offset="1" stopColor="#1a8fe3" />
        </linearGradient>
      </defs>

      {/* straw */}
      <path d="M57 22 L66 3" stroke="#ff7b93" strokeWidth="6" strokeLinecap="round" />
      <path d="M66 3 L75 5" stroke="#ff7b93" strokeWidth="6" strokeLinecap="round" />

      {/* body + water */}
      <g clipPath="url(#tumbler-body)">
        <rect x="0" y="0" width="100" height="100" fill="rgba(255,255,255,0.6)" />
        <g className="water" style={{ transform: `translateY(${waterTop}px)` }}>
          <path
            className="wave"
            d="M-100 3 Q-87.5 -1 -75 3 T-50 3 T-25 3 T0 3 T25 3 T50 3 T75 3 T100 3 T125 3 T150 3 T175 3 T200 3 V200 H-100 Z"
            fill="url(#tumbler-water)"
          />
        </g>
      </g>
      <path d={BODY} fill="none" stroke="#1f5f99" strokeWidth="3" strokeLinejoin="round" />
      <path d="M31 38 L35 84" stroke="rgba(255,255,255,0.85)" strokeWidth="4" strokeLinecap="round" />

      {/* lid */}
      <rect x="18" y="20" width="64" height="12" rx="5" fill="#1f5f99" />
      <rect x="24" y="22.5" width="30" height="3" rx="1.5" fill="rgba(255,255,255,0.35)" />

      {/* face */}
      <g className="face" fill="#103a5e">
        {happy ? (
          <>
            <path d="M40 60 Q43 56 46 60" stroke="#103a5e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M54 60 Q57 56 60 60" stroke="#103a5e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse className="eye" cx="43" cy="59" rx="2.6" ry="3.2" />
            <ellipse className="eye" cx="57" cy="59" rx="2.6" ry="3.2" />
          </>
        )}
        <path d="M44.5 67 Q50 72 55.5 67" stroke="#103a5e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <ellipse cx="37" cy="66" rx="3.4" ry="2" fill="#ff9fb2" opacity="0.7" />
        <ellipse cx="63" cy="66" rx="3.4" ry="2" fill="#ff9fb2" opacity="0.7" />
      </g>
    </svg>
  );
}
