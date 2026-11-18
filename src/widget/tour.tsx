import type { ReactNode } from "react";

/** The quick tour Tumbli gives on the desktop right after setup. */
export type TourStep = { title: string; body: ReactNode; demo?: "drag" | "click" | "log" };

const Key = ({ children }: { children: ReactNode }) => <span className="key">{children}</span>;

export const TOUR: TourStep[] = [
  {
    title: "Hi, I'm Tumbli!",
    body: (
      <>
        I'm a tumbler, just like the one on your desk. I'll float right here while you work, and I fill up
        as you drink.
      </>
    ),
  },
  {
    title: "Drank some water?",
    body: (
      <>
        Hover over me and press <Key>+</Key>, or press <Key>Ctrl + Alt + W</Key> from any app. Using a tumbler?{" "}
        <Key>✓</Key> means you finished it and <Key>↻</Key> that you refilled it.
      </>
    ),
    demo: "log",
  },
  {
    title: "Click me!",
    body: <>Click me anytime and I'll tell you a fun fact or some water trivia.</>,
    demo: "click",
  },
  {
    title: "Move me around",
    body: <>Drag me anywhere. When you let go, I'll stick to the nearest side of your screen.</>,
    demo: "drag",
  },
  {
    title: "Your stats and plan",
    body: (
      <>
        <Key>Double-click</Key> me to see your progress, streak and settings.
      </>
    ),
  },
  {
    title: "Need a break?",
    body: (
      <>
        Find my icon in the taskbar tray (the <Key>^</Key> arrow) to pause reminders or quit.
      </>
    ),
  },
];
