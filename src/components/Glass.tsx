type Props = { fill: number; size?: number };

/** A tumbler whose water level follows `fill` (0..1), with a gentle wave. */
export function Glass({ fill, size = 64 }: Props) {
  const level = Math.max(0, Math.min(1, fill));
  // Glass interior spans y = 8..92 in the 100x100 viewBox.
  const waterTop = 92 - level * 84;
  return (
    <svg className="glass" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <clipPath id="glass-inside">
          <path d="M20 8 L80 8 L72 92 Q71 96 66 96 L34 96 Q29 96 28 92 Z" />
        </clipPath>
        <linearGradient id="water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5fd3ff" />
          <stop offset="1" stopColor="#1a8fe3" />
        </linearGradient>
      </defs>
      <g clipPath="url(#glass-inside)">
        <rect x="0" y="0" width="100" height="100" fill="rgba(255,255,255,0.55)" />
        <g className="water" style={{ transform: `translateY(${waterTop}px)` }}>
          <path
            className="wave"
            d="M-100 4 Q-87.5 0 -75 4 T-50 4 T-25 4 T0 4 T25 4 T50 4 T75 4 T100 4 T125 4 T150 4 T175 4 T200 4 V200 H-100 Z"
            fill="url(#water)"
          />
        </g>
      </g>
      <path
        d="M20 8 L80 8 L72 92 Q71 96 66 96 L34 96 Q29 96 28 92 Z"
        fill="none"
        stroke="rgba(20,70,120,0.55)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M30 16 L27 60" stroke="rgba(255,255,255,0.8)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
