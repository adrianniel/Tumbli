import { useRef, type MouseEvent } from "react";

const DRAG_PX = 4; // a press that moves less than this is a click
const DOUBLE_CLICK_MS = 240; // wait this long so a double-click can win over a click

/** Tells a click, a drag and a double-click on Tumbli apart. */
export function useGestures(handlers: { onClick: () => void; onDoubleClick: () => void; onDragStart: () => void }) {
  const h = useRef(handlers);
  h.current = handlers;
  const press = useRef<{ x: number; y: number } | null>(null);
  const clickTimer = useRef<number | undefined>(undefined);

  return {
    onMouseDown: (e: MouseEvent) => {
      if (e.button === 0) press.current = { x: e.screenX, y: e.screenY };
    },
    onMouseMove: (e: MouseEvent) => {
      const p = press.current;
      if (!p) return;
      if (Math.abs(e.screenX - p.x) + Math.abs(e.screenY - p.y) > DRAG_PX) {
        press.current = null;
        h.current.onDragStart();
      }
    },
    onMouseUp: () => {
      if (!press.current) return;
      press.current = null;
      window.clearTimeout(clickTimer.current);
      clickTimer.current = window.setTimeout(() => h.current.onClick(), DOUBLE_CLICK_MS);
    },
    onMouseLeave: () => {
      press.current = null;
    },
    onDoubleClick: () => {
      window.clearTimeout(clickTimer.current);
      h.current.onDoubleClick();
    },
  };
}
