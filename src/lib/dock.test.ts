import { describe, expect, it } from "vitest";
import { anchorOf, dockTo, pastEdge, pickArea, placeAt, snapToEdge } from "./dock";

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

describe("dockTo", () => {
  it("docks to the side it's told, even when the window is mostly on the other half", () => {
    expect(dockTo(win(300, 400), "right", [screen], 2)).toEqual({ x: 1818, y: 400, w: 100, h: 140, side: "right" });
    expect(dockTo(win(1500, 400), "left", [screen], 2)).toMatchObject({ x: 2, side: "left" });
  });

  it("keeps the whole window on screen, so a speech bubble always fits", () => {
    const frame = { x: 1500, y: -100, w: 350, h: 240 };
    expect(dockTo(frame, "right", [screen], 2)).toMatchObject({ x: 1920 - 350 - 2, y: 2 });
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

import { keepOnScreen } from "./dock";

describe("keepOnScreen", () => {
  it("pulls a window that grew past the left edge back in", () => {
    expect(keepOnScreen({ x: -230, y: 600, w: 350, h: 240 }, [screen])).toEqual({ x: 0, y: 600 });
  });

  it("respects a taskbar at the top", () => {
    const topBar = { x: 0, y: 48, w: 1920, h: 1032 };
    expect(keepOnScreen({ x: 100, y: 10, w: 100, h: 140 }, [topBar])).toEqual({ x: 100, y: 48 });
  });

  it("leaves a window that already fits alone", () => {
    expect(keepOnScreen({ x: 500, y: 300, w: 350, h: 240 }, [screen])).toEqual({ x: 500, y: 300 });
  });
});

describe("pastEdge", () => {
  const tumbli = (x: number) => ({ x, y: 400, w: 76, h: 140 });
  it("tucks in when dropped past the right edge", () => {
    expect(pastEdge(tumbli(1920 - 76 + 30), "right", [screen], 16)).toBe(true);
    expect(pastEdge(tumbli(1920 - 76 + 10), "right", [screen], 16)).toBe(false);
  });
  it("works on the left edge too", () => {
    expect(pastEdge(tumbli(-20), "left", [screen], 16)).toBe(true);
    expect(pastEdge(tumbli(4), "left", [screen], 16)).toBe(false);
  });
  it("not at an edge shared with a second monitor", () => {
    const second = { x: 1920, y: 0, w: 1920, h: 1032 };
    expect(pastEdge(tumbli(1920 - 76 + 30), "right", [screen, second], 16)).toBe(false);
    // the second screen's own right edge still works
    expect(pastEdge(tumbli(3840 - 76 + 30), "right", [screen, second], 16)).toBe(true);
  });
});
