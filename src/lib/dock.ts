/** Docking the floating widget to the left or right edge of the screen. */

export type Rect = { x: number; y: number; w: number; h: number };
export type Side = "left" | "right";

/** Where the widget is pinned: the edge it hugs (x of that edge) and its bottom (y). */
export type Anchor = { side: Side; x: number; bottom: number };

const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** The work area (screen minus taskbar) the window belongs to: the one holding its center, else the nearest. */
export function pickArea(win: Rect, areas: Rect[]): Rect {
  const c = center(win);
  const inside = areas.find((a) => c.x >= a.x && c.x < a.x + a.w && c.y >= a.y && c.y < a.y + a.h);
  if (inside) return inside;
  let best = areas[0];
  let bestD = Infinity;
  for (const a of areas) {
    const ac = center(a);
    const d = (ac.x - c.x) ** 2 + (ac.y - c.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/**
 * Snap a window to the closer side edge of its screen, `margin` px in from the edge,
 * and keep it fully on screen vertically with the same margin.
 */
export function snapToEdge(win: Rect, areas: Rect[], margin: number): Rect & { side: Side } {
  const a = pickArea(win, areas);
  return dockTo(win, center(win).x < a.x + a.w / 2 ? "left" : "right", areas, margin);
}

/** Like snapToEdge, but to the given side. */
export function dockTo(win: Rect, side: Side, areas: Rect[], margin: number): Rect & { side: Side } {
  const a = pickArea(win, areas);
  const x = side === "left" ? a.x + margin : a.x + a.w - win.w - margin;
  const minY = a.y + margin;
  const maxY = a.y + a.h - win.h - margin;
  const y = Math.round(Math.min(Math.max(win.y, minY), Math.max(minY, maxY)));
  return { x: Math.round(x), y, w: win.w, h: win.h, side };
}

export function anchorOf(r: Rect, side: Side): Anchor {
  return { side, x: side === "left" ? r.x : r.x + r.w, bottom: r.y + r.h };
}

/** Top-left position for a window of size w x h pinned at `anchor`. */
export function placeAt(anchor: Anchor, w: number, h: number) {
  return { x: anchor.side === "left" ? anchor.x : anchor.x - w, y: anchor.bottom - h };
}

/** Nudge a window back inside the work area it mostly belongs to (taskbar top, bottom or side). */
export function keepOnScreen(win: Rect, areas: Rect[]): { x: number; y: number } {
  if (!areas.length) return { x: win.x, y: win.y };
  const a = pickArea(win, areas);
  const x = Math.min(Math.max(win.x, a.x), Math.max(a.x, a.x + a.w - win.w));
  const y = Math.min(Math.max(win.y, a.y), Math.max(a.y, a.y + a.h - win.h));
  return { x: Math.round(x), y: Math.round(y) };
}
