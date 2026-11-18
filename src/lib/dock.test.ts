import { describe, expect, it } from "vitest";
import { anchorOf, pickArea, placeAt, snapToEdge } from "./dock";

// one 1920x1080 screen with a 48px taskbar at the bottom
const screen = { x: 0, y: 0, w: 1920, h: 1032 };
const win = (x: number, y: number) => ({ x, y, w: 100, h: 140 });

describe("snapToEdge", () => {
  it("snaps to the right edge with a margin", () => {
    expect(snapToEdge(win(1500, 400), [screen], 8)).toEqual({ x: 1812, y: 400, w: 100, h: 140, side: "right" });
  });

  it("snaps to the left edge with a margin", () => {
    expect(snapToEdge(win(300, 400), [screen], 8)).toMatchObject({ x: 8, y: 400, side: "left" });
  });

  it("keeps it on screen vertically", () => {
    expect(snapToEdge(win(1500, -50), [screen], 8).y).toBe(8);
    expect(snapToEdge(win(1500, 1000), [screen], 8).y).toBe(1032 - 140 - 8);
  });

  it("uses the screen the widget was dropped on", () => {
    const second = { x: 1920, y: 0, w: 1280, h: 984 };
    const r = snapToEdge(win(2000, 300), [screen, second], 8);
    expect(r).toMatchObject({ x: 1928, side: "left" });
  });

  it("falls back to the nearest screen when dropped off screen", () => {
    expect(pickArea(win(-500, 300), [screen])).toBe(screen);
  });
});

describe("anchors", () => {
  it("keeps the docked edge and bottom when the window changes size", () => {
    const right = anchorOf({ x: 1812, y: 400, w: 100, h: 140 }, "right");
    expect(placeAt(right, 350, 240)).toEqual({ x: 1562, y: 300 });
    const left = anchorOf({ x: 8, y: 400, w: 100, h: 140 }, "left");
    expect(placeAt(left, 350, 240)).toEqual({ x: 8, y: 300 });
  });
});
