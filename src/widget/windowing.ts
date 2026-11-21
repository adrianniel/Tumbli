/**
 * The widget's own window: where it sits on screen and which part of it shows.
 *
 * The window always has the size of the biggest mode (a speech bubble) and stays
 * put. Each mode only changes the window *region*, the part that is drawn and takes
 * clicks; the rest is not there at all, so clicks go to the apps behind it.
 * Resizing the window instead made Tumbli jump for a frame (WebView2 redraws a
 * moment after the window changes size), which showed as a flicker on hover.
 */
import { invoke } from "@tauri-apps/api/core";
import { availableMonitors, getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import { anchorOf, dockTo, pastEdge, placeAt, snapToEdge, type Anchor, type Side } from "../lib/dock";

/** The part of the window (logical px) each thing the widget can be doing needs. */
export const SIZES = {
  idle: { w: 76, h: 140 }, // just Tumbli, hugging the screen edge
  hover: { w: 140, h: 140 }, // room for the 2x2 quick buttons
  talk: { w: 350, h: 240 }, // a speech bubble (reminder, fact, tour, recap...)
  cheer: { w: 300, h: 170 }, // floating cheer text
} as const;
export type WindowMode = keyof typeof SIZES;

/** The window itself: big enough for every mode. */
const FRAME = { w: 350, h: 240 };

const POS_KEY = "tumbli.widget.anchor.v3"; // docked side + edge + bottom, physical px
const EDGE_MARGIN = 2; // logical px between the window and the screen edge
const PEEK_KEY = "tumbli.widget.peek";
/** dropped this far (logical px) past the screen edge, Tumbli tucks into it */
const PEEK_DROP = 16;
/** share of Tumbli's width hidden past the edge while it peeks */
const PEEK_HIDE = 0.45;

/** Where the window sits when docked (physical px, top-left). */
export type Home = { x: number; y: number };

/** Is Tumbli tucked into the screen edge, peeking out? */
export const loadPeek = () => localStorage.getItem(PEEK_KEY) === "1";
const savePeek = (on: boolean) => localStorage.setItem(PEEK_KEY, on ? "1" : "0");

let slideGen = 0;
/** Glide the window to (x, y). A newer slide cancels one still running. */
export async function slideTo(x: number, y: number, steps = 7) {
  const gen = ++slideGen;
  const from = await win.outerPosition().catch(() => null);
  if (!from || (from.x === x && from.y === y)) return;
  for (let i = 1; i <= steps; i++) {
    if (gen !== slideGen) return;
    const t = 1 - Math.pow(1 - i / steps, 3); // ease-out
    await win
      .setPosition(new PhysicalPosition(Math.round(from.x + (x - from.x) * t), Math.round(from.y + (y - from.y) * t)))
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 16));
  }
}

/** The window position that hides part of Tumbli past the edge it is docked to. */
export async function peekPos(home: Home, side: Side): Promise<Home> {
  const sf = await win.scaleFactor();
  const shift = Math.round(SIZES.idle.w * PEEK_HIDE * sf) + Math.round(EDGE_MARGIN * sf);
  return { x: home.x + (side === "right" ? shift : -shift), y: home.y };
}

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

/** Move + resize in one native step so there's no in-between frame. */
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

/** Physical size of what a mode shows, in the docked bottom corner of the window. */
function regionFor(mode: WindowMode, side: Side, sf: number, frame: { w: number; h: number }) {
  const w = Math.min(frame.w, Math.round(SIZES[mode].w * sf));
  const h = Math.min(frame.h, Math.round(SIZES[mode].h * sf));
  return { x: side === "right" ? frame.w - w : 0, y: frame.h - h, w, h };
}

/** Show the part of the window this mode needs. Instant: nothing moves or resizes. */
export async function showMode(mode: WindowMode, side: Side) {
  try {
    const sf = await win.scaleFactor();
    const size = await win.outerSize();
    await invoke("set_widget_region", regionFor(mode, side, sf, { w: size.width, h: size.height }));
  } catch {
    // the browser preview has no window region; the page there is sized per mode
  }
}

/** Where Tumbli itself is: the docked bottom corner of the window. */
function tumbliIn(win: { x: number; y: number; w: number; h: number }, side: Side, sf: number) {
  const w = Math.round(SIZES.idle.w * sf);
  const h = Math.round(SIZES.idle.h * sf);
  return { x: side === "right" ? win.x + win.w - w : win.x, y: win.y + win.h - h, w, h };
}

/**
 * After a drag: slide Tumbli to the nearest side edge, with a little gap, and keep
 * the whole window on screen so a speech bubble always fits. `onSide` runs as soon
 * as the side is known, so Tumbli can move to the other end of the window first.
 * Dropped past the screen edge, Tumbli tucks into it and peeks out instead.
 */
export async function snapAfterDrag(
  side: Side,
  onSide: (side: Side) => void,
): Promise<{ side: Side; home: Home; peek: boolean }> {
  const sf = await win.scaleFactor();
  const margin = Math.round(EDGE_MARGIN * sf);
  const areas = await workAreas();
  let from = await windowRect();
  const tumbli = tumbliIn(from, side, sf);
  const newSide = snapToEdge(tumbli, areas, margin).side;
  const peek = pastEdge(tumbli, newSide, areas, Math.round(PEEK_DROP * sf));

  if (newSide !== side) {
    // Tumbli is drawn at the other end of the window on this side: shift the
    // window so Tumbli stays where the user dropped it, then slide from there
    from = { ...from, x: newSide === "right" ? tumbli.x + tumbli.w - from.w : tumbli.x };
    onSide(newSide);
    await win.setPosition(new PhysicalPosition(from.x, from.y));
  }
  const to = dockTo({ ...from, y: tumbli.y + tumbli.h - from.h }, newSide, areas, margin);
  const home = { x: to.x, y: to.y };
  const target = peek ? await peekPos(home, newSide) : home;
  await slideTo(target.x, target.y, 9);
  localStorage.setItem(POS_KEY, JSON.stringify(anchorOf(to, newSide)));
  savePeek(peek);
  return { side: newSide, home, peek };
}

/** Put the widget where it was last docked (or bottom-right the first time). */
export async function placeInitially(reset = false): Promise<{ side: Side; home: Home }> {
  if (reset) {
    localStorage.removeItem(POS_KEY);
    savePeek(false);
  }
  const sf = await win.scaleFactor();
  const w = Math.round(FRAME.w * sf);
  const h = Math.round(FRAME.h * sf);

  let saved: Anchor | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
  } catch {
    saved = null;
  }
  const areas = await workAreas();
  if (!areas.length) {
    await setBounds(0, 0, w, h);
    return { side: "right", home: { x: 0, y: 0 } };
  }
  const a = areas[0];
  const start = saved ? { ...placeAt(saved, w, h), w, h } : { x: a.x + a.w - w, y: a.y + a.h - h, w, h };
  // docking also pulls back a spot that is no longer on any monitor
  const to = dockTo(start, saved?.side ?? "right", areas, Math.round(EDGE_MARGIN * sf));
  await setBounds(to.x, to.y, w, h);
  return { side: to.side, home: { x: to.x, y: to.y } };
}
