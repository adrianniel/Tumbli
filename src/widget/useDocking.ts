import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Side } from "../lib/dock";
import { placeInitially, showMode, snapAfterDrag, win, type WindowMode } from "./windowing";

/**
 * Keeps the widget window docked to a screen edge: first placement, snapping after a
 * drag, the tray's "Reset widget position", and showing the right part of the
 * window whenever the mode changes.
 */
export function useDocking(mode: WindowMode, onReset: () => void) {
  const [side, setSide] = useState<Side>("right");
  const [placed, setPlaced] = useState(false);
  const userDragging = useRef(false);
  const resetRef = useRef(onReset);
  resetRef.current = onReset;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const sideRef = useRef(side);
  sideRef.current = side;

  /** place, show only Tumbli's part, then make the window visible */
  const place = async (reset: boolean) => {
    const s = await placeInitially(reset);
    setSide(s);
    await showMode(modeRef.current, s);
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
        userDragging.current = false;
        const s = await snapAfterDrag(sideRef.current, (next) => {
          setSide(next);
          void showMode(modeRef.current, next);
        });
        setSide(s);
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

  // show the part of the window this mode needs (instant, nothing moves)
  useEffect(() => {
    if (placed) void showMode(mode, side);
  }, [mode, placed, side]);

  const startDrag = () => {
    userDragging.current = true;
    void win.startDragging();
  };

  return { side, startDrag };
}
