import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Side } from "../lib/dock";
import { loadPeek, peekPos, placeInitially, showMode, slideTo, snapAfterDrag, win, type Home, type WindowMode } from "./windowing";

/**
 * Keeps the widget window docked to a screen edge: first placement, snapping after a
 * drag, the tray's "Reset widget position", and showing the right part of the
 * window whenever the mode changes.
 *
 * Peek: dropped past the screen edge, Tumbli tucks half of itself into the edge while
 * idle. Anything else (hover buttons, a speech bubble, a cheer) brings it all the way
 * out, and it tucks back in afterwards. Only dragging it out of the edge ends peeking.
 */
export function useDocking(mode: WindowMode, onReset: () => void, onPeek: () => void) {
  const [side, setSide] = useState<Side>("right");
  const [placed, setPlaced] = useState(false);
  const [peek, setPeek] = useState(loadPeek);
  const home = useRef<Home | null>(null);
  /** the window is shifted into the edge right now */
  const tucked = useRef(false);
  const peekRef = useRef(onPeek);
  peekRef.current = onPeek;
  const userDragging = useRef(false);
  const snapping = useRef(false);
  const [settled, setSettled] = useState(0);
  const resetRef = useRef(onReset);
  resetRef.current = onReset;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const sideRef = useRef(side);
  sideRef.current = side;

  /** place, show only Tumbli's part, then make the window visible */
  const place = async (reset: boolean) => {
    const p = await placeInitially(reset);
    home.current = p.home;
    tucked.current = false;
    if (reset) setPeek(false);
    setSide(p.side);
    await showMode(modeRef.current, p.side);
    await win.show();
  };

  // first placement + show (showing modes waits for this, or the two race)
  useEffect(() => {
    void place(false).then(() => setPlaced(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // after a drag, dock to the nearest side edge and remember it
  useEffect(() => {
    let t: number | undefined;
    const un = win.onMoved(() => {
      if (!userDragging.current) return; // ignore our own setPosition calls
      window.clearTimeout(t);
      // snap only once the button is released, even if the user pauses mid-drag
      t = window.setTimeout(async function settle() {
        const held = await invoke<boolean>("primary_button_down").catch(() => false);
        if (held) {
          t = window.setTimeout(settle, 120);
          return;
        }
        userDragging.current = false; // from here on the moves are ours
        snapping.current = true;
        const r = await snapAfterDrag(sideRef.current, (next) => {
          setSide(next);
          void showMode(modeRef.current, next);
        });
        home.current = r.home;
        tucked.current = r.peek;
        snapping.current = false;
        if (r.peek) peekRef.current(); // the mouse is still on Tumbli: don't pop right back out
        setPeek(r.peek);
        setSide(r.side);
        setSettled((n) => n + 1); // apply the mode again: it may have changed during the drag
      }, 150);
    });
    return () => {
      void un.then((f) => f());
    };
  }, []);

  // tray: Reset widget position
  useEffect(() => {
    const un = listen("tumbli:reset-position", async () => {
      resetRef.current();
      await place(true);
    });
    return () => {
      void un.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a new display scale resizes the window: show the right part again
  useEffect(() => {
    // (Windows resizes the window right after the scale event, so wait a moment)
    const un = win.onScaleChanged(() => window.setTimeout(() => void showMode(modeRef.current, sideRef.current), 150));
    return () => {
      void un.then((f) => f());
    };
  }, []);

  // show the part of the window this mode needs (instant, nothing moves); while peeking,
  // come out of the edge first for anything bigger than idle, and tuck back in after
  useEffect(() => {
    if (!placed || userDragging.current || snapping.current) return;
    const h = home.current;
    const tuck = peek && mode === "idle" && h !== null;
    void (async () => {
      if (tuck) {
        await showMode(mode, side);
        if (!tucked.current) {
          tucked.current = true;
          const p = await peekPos(h, side);
          await slideTo(p.x, p.y);
        }
      } else {
        if (tucked.current && h) {
          tucked.current = false;
          await slideTo(h.x, h.y, 5);
        }
        await showMode(mode, side);
      }
    })();
  }, [mode, placed, side, peek, settled]);

  const startDrag = () => {
    userDragging.current = true;
    void win.startDragging();
  };

  return { side, startDrag, peek };
}
