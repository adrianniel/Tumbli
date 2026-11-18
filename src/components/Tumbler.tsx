type Props = {
  /** progress, 0..1: the bottle's color rises from the bottom */
  fill: number;
  /** rendered height in px; width is 70% of it */
  size?: number;
  /** happy eyes when the goal is reached */
  happy?: boolean;
  /** little arms (the floating widget uses them to wave) */
  arms?: boolean;
  /** surprised "o" mouth, used while reminding */
  calling?: boolean;
  /** eyes shut, used while reminders are paused */
  sleeping?: boolean;
};

// A wide insulated sport bottle: straight body, rounded shoulders.
const BODY =
  "M27 41 Q27 30 39 28 L61 28 Q73 30 73 41 L73 90 Q73 97 66 97 L34 97 Q27 97 27 90 Z";
const INK = "#0E3F6E";
const EMPTY = "#D3E9FB";
const FULL = "#2E8BE6";

/** Tumbli: a sport bottle with a strap cap and a face. Its color rises with `fill`. */
export function Tumbler({ fill, size = 64, happy = false, arms = false, calling = false, sleeping = false }: Props) {
  const level = Math.max(0, Math.min(1, fill));
  // Body interior spans y = 28..97 in the viewBox.
  const waterTop = 97 - level * 69;
  return (
    <svg
      className="tumbler"
      width={Math.round(size * 0.7)}
      height={size}
      viewBox="15 0 70 100"
      overflow="visible"
      aria-hidden
    >
      <defs>
        <clipPath id="tumbli-body">
          <path d={BODY} />
        </clipPath>
      </defs>

      {arms && (
        <>
          <path className="arm arm-l" d="M28 66 Q20 70 19 78" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path className="arm arm-r" d="M72 66 Q80 62 82 54" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* body: pale color, with the strong color rising as you drink */}
      <path d={BODY} fill={EMPTY} />
      <g clipPath="url(#tumbli-body)">
        <g className="water" style={{ transform: `translateY(${waterTop}px)` }}>
          <path
            className="wave"
            d="M-100 2 Q-87.5 -1 -75 2 T-50 2 T-25 2 T0 2 T25 2 T50 2 T75 2 T100 2 T125 2 T150 2 T175 2 T200 2 V200 H-100 Z"
            fill={FULL}
          />
          <circle className="bubble b1" cx="42" cy="16" r="1.6" fill="#FFFFFF" opacity="0.7" />
          <circle className="bubble b2" cx="58" cy="24" r="1.2" fill="#FFFFFF" opacity="0.7" />
        </g>
        {/* rubber boot at the bottom */}
        <rect x="0" y="90" width="100" height="10" fill={INK} />
      </g>
      <path d={BODY} fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M33 45 L33 82" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" opacity="0.55" />

      {/* stainless neck, cap and strap handle */}
      <rect x="38" y="22" width="24" height="7" rx="1.5" fill="#C9D6E3" stroke={INK} strokeWidth="2.2" />
      <path d="M41 12 L41 6.5 Q41 2.5 45 2.5 L55 2.5 Q59 2.5 59 6.5 L59 12" fill="none" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <rect x="34" y="11" width="32" height="12" rx="3.5" fill={INK} />
      <rect x="37" y="13.5" width="26" height="2.2" rx="1.1" fill="#2E8BE6" opacity="0.8" />

      {/* face */}
      <g className="face">
        {sleeping ? (
          <>
            <path d="M40.5 52 Q43.5 55 46.5 52" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M53.5 52 Q56.5 55 59.5 52" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        ) : happy ? (
          <>
            <path d="M40.5 53 Q43.5 49 46.5 53" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M53.5 53 Q56.5 49 59.5 53" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse className="eye" cx="43.5" cy="52" rx="3" ry="3.6" fill={INK} />
            <ellipse className="eye" cx="56.5" cy="52" rx="3" ry="3.6" fill={INK} />
            <circle cx="44.6" cy="50.6" r="1" fill="#FFFFFF" />
            <circle cx="57.6" cy="50.6" r="1" fill="#FFFFFF" />
          </>
        )}
        {calling ? (
          <ellipse cx="50" cy="61" rx="2.6" ry="3" fill={INK} />
        ) : (
          <path d="M45.5 59.5 Q50 63.5 54.5 59.5" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        )}
        <ellipse cx="37" cy="58.5" rx="3.4" ry="2" fill="#FF8FA6" />
        <ellipse cx="63" cy="58.5" rx="3.4" ry="2" fill="#FF8FA6" />
      </g>
    </svg>
  );
}
