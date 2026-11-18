/**
 * The widget's own window: its sizes per mode, where it sits on screen, and how it
 * grows/shrinks while staying docked to a screen edge.
 */
import { invoke } from "@tauri-apps/api/core";
import { availableMonitors, getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import { anchorOf, keepOnScreen, placeAt, snapToEdge, type Anchor, type Side } from "../lib/dock";

/** Window size (logical px) for each thing the widget can be doing. */
export const SIZES = {
  idle: { w: 76, h: 140 }, // just Tumbli, hugging the screen edge
  hover: { w: 140, h: 140 }, // room for the 2x2 quick buttons
  talk: { w: 350, h: 240 }, // a speech bubble (reminder, fact, tour, recap...)
  cheer: { w: 300, h: 170 }, // floating cheer text
} as const;
export type WindowMode = keyof typeof SIZES;

const POS_KEY = "tumbli.widget.anchor.v3"; // docked side + edge + bottom, physical px
const EDGE_MARGIN = 2; // logical px between the window and the screen edge

export const win = getCurrentWindow();

const workAreas = async () =>
  (await availableMonitors()).map((m) => ({
    x: m.workArea.position.x,
    y: m.workArea.position.y,
    w: m.workArea.size.width,
    h: m.workArea.size.height,
  }));

async function windowRect() {
  const pos = await win.outerPosition();
  const size = await win.outerSize();
  return { x: pos.x, y: pos.y, w: size.width, h: size.height };
}

/** Move + resize in one native step so there's no in-between frame (no flicker). */
async function setBounds(x: number, y: number, w: number, h: number) {
  try {
    await invoke("set_widget_bounds", { x, y, w, h });
  } catch {
    // not available (e.g. the browser preview): fall back to two steps
    const sf = await win.scaleFactor();
    await win.setSize(new LogicalSize(w / sf, h / sf));
    await win.setPosition(new PhysicalPosition(x, y));
  }
}

/**
 * Resize while keeping the docked edge and the bottom where they are:
 * docked right it grows to the left, docked left it grows to the right,
 * and the result always stays inside the screen.
 */
export async function resizeTo(mode: WindowMode, side: Side) {
  const { w, h } = SIZES[mode];
  const sf = await win.scaleFactor();
  const pw = Math.round(w * sf);
  const ph = Math.round(h * sf);
  const at = placeAt(anchorOf(await windowRect(), side), pw, ph);
  const fit = keepOnScreen({ ...at, w: pw, h: ph }, await workAreas());
  await setBounds(fit.x, fit.y, pw, ph);
}

/** Slide to the nearest side edge after a drag, with a little gap. Returns the side. */
export async function snapAfterDrag(): Promise<Side> {
  const sf = await win.scaleFactor();
  const from = await windowRect();
  const to = snapToEdge(from, await workAreas(), Math.round(EDGE_MARGIN * sf));
  const steps = 9;
  for (let i = 1; i <= steps; i++) {
    const t = 1 - Math.pow(1 - i / steps, 3); // ease-out
    await win.setPosition(
      new PhysicalPosition(Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t)),
    );
    await new Promise((r) => setTimeout(r, 16));
  }
  localStorage.setItem(POS_KEY, JSON.stringify(anchorOf(to, to.side)));
  return to.side;
}

/** Put the widget where it was last docked (or bottom-right the first time). */
export async function placeInitially(reset = false): Promise<Side> {
  if (reset) localStorage.removeItem(POS_KEY);
  const sf = await win.scaleFactor();
  const w = Math.round(SIZES.idle.w * sf);
  const h = Math.round(SIZES.idle.h * sf);

  let saved: Anchor | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
  } catch {
    saved = null;
  }
  const areas = await workAreas();
  const start = saved
    ? { ...placeAt(saved, w, h), w, h }
    : (() => {
        const a = areas[0] ?? { x: 0, y: 0, w: 1280, h: 720 };
        return { x: a.x + a.w - w, y: a.y + a.h - h, w, h };
      })();
  // snapping also pulls back a spot that is no longer on any monitor
  const to = areas.length ? snapToEdge(start, areas, Math.round(EDGE_MARGIN * sf)) : { ...start, side: "right" as Side };
  await setBounds(to.x, to.y, w, h);
  return to.side;
}
