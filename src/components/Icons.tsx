/** Tumbli's own little line icons (24px grid, rounded strokes) instead of emoji. */
import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconChair = (p: P) => (
  <Svg {...p}>
    <path d="M7 3v9h10" />
    <path d="M7 12l-1 9M17 12l1 9M7 16h10" />
  </Svg>
);
export const IconWalk = (p: P) => (
  <Svg {...p}>
    <circle cx="13" cy="4" r="1.8" />
    <path d="M10 21l2.5-6.5L15 17v4M9 11l3-3 3 3 2.5 1M12 8l-1 6.5" />
  </Svg>
);
export const IconRun = (p: P) => (
  <Svg {...p}>
    <circle cx="15" cy="4" r="1.8" />
    <path d="M5 12l4-3h5l-2 5 3 3-1 4M12 14l-4 2-3-1M14 9l3 3h3" />
  </Svg>
);
export const IconDumbbell = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
  </Svg>
);
export const IconSnow = (p: P) => (
  <Svg {...p}>
    <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
    <path d="M9.5 3.5L12 5.5l2.5-2M9.5 20.5L12 18.5l2.5 2" />
  </Svg>
);
export const IconCloudSun = (p: P) => (
  <Svg {...p}>
    <path d="M8 3.5v1.2M3.5 8h1.2M4.8 4.8l.8.8M11.2 4.8l-.8.8" />
    <path d="M10.6 9.2A3.4 3.4 0 0 0 5 10.6" />
    <path d="M7.5 20h10a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8.4 13 3.5 3.5 0 0 0 7.5 20z" />
  </Svg>
);
export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Svg>
);
export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Svg>
);
export const IconDrop = (p: P) => (
  <Svg {...p}>
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
  </Svg>
);
export const IconGlass = (p: P) => (
  <Svg {...p}>
    <path d="M6 4h12l-1.5 16h-9z" />
    <path d="M6.8 11h10.4" />
  </Svg>
);
export const IconBottle = (p: P) => (
  <Svg {...p}>
    <path d="M10 2.5h4v3h-4z" />
    <path d="M9.5 5.5h5c2 0 3 1.5 3 3.5v10.5a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V9c0-2 1-3.5 3-3.5z" />
    <path d="M6.5 13h11" />
  </Svg>
);
export const IconRefill = (p: P) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
    <path d="M4 3.5V8h4.5" />
    <path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" />
    <path d="M20 20.5V16h-4.5" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconUndo = (p: P) => (
  <Svg {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);
export const IconFlame = (p: P) => (
  <Svg {...p}>
    <path d="M12 21a6 6 0 0 0 6-6c0-4-3.5-6-3.5-10C11 7 8 9.5 8 13c-1-.5-1.5-1.5-1.5-2.5C5 12 6 14 6 15a6 6 0 0 0 6 6z" />
  </Svg>
);
export const IconTrophy = (p: P) => (
  <Svg {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4l.5 3.5h-5z" />
  </Svg>
);
export const IconBulb = (p: P) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </Svg>
);
export const IconTarget = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <path d="M10 21h4" />
  </Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </Svg>
);
export const IconQuestion = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconGear = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
  </Svg>
);
