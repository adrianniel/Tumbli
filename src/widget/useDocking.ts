import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Side } from "../lib/dock";
import { placeInitially, resizeTo, snapAfterDrag, win, type WindowMode } from "./windowing";

/**
 * Keeps the widget window docked to a screen edge: first placement, snapping after a
 * drag, the tray's "Reset widget position", and resizing whenever the mode changes.
 */
export function useDocking(mode: WindowMode, onReset: () => void) {
  const [side, setSide] = useState<Side>("right");
  const [placed, setPlaced] = useState(false);
  const userDragging = useRef(false);
  const resetRef = useRef(onReset);
  resetRef.current = onReset;

  // first placement + show (resizing waits for this, or the two race)
  useEffect(() => {
    (async () => {
      setSide(await placeInitially());
      await win.show();
      setPlaced(true);
    })();
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
        setSide(await snapAfterDrag());
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
      setSide(await placeInitially(true));
      await win.show();
    });
    return () => {
      void un.then((f) => f());
    };
  }, []);

  // grow / shrink around the docked edge whenever the mode changes
  useEffect(() => {
    if (placed) void resizeTo(mode, side);
  }, [mode, placed, side]);

  const startDrag = () => {
    userDragging.current = true;
    void win.startDragging();
  };

  return { side, startDrag };
}
