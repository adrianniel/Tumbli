import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  availableMonitors,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  primaryMonitor,
} from "@tauri-apps/api/window";
import { Tumbler } from "../components/Tumbler";
import { bloop } from "../lib/sound";
import {
  addGlasses,
  CHANGED_EVENT,
  loadHistory,
  loadSettings,
  streak,
  todayCount,
  type Settings,
} from "../lib/store";

const COMPACT = { w: 92, h: 120 };
const EXPANDED = { w: 320, h: 132 };
const SNOOZE_MIN = 10;
const IDLE_SECS = 5 * 60; // user counts as "away" after 5 min without input
const TICK_MS = 5000;
const POS_KEY = "tumbli.widget.anchor.v2"; // bottom-right corner, physical px

type SystemStatus = { idle_secs: number; busy: boolean };

const win = getCurrentWindow();

const NUDGES = [
  "Tumbli says: sip time! 💧",
  "Water break! 💧",
  "Your brain is ~75% water. Top it up!",
  "Sip, sip, hooray! 🥤",
  "Hydrate, then dominate 💪",
];

/** Resize while keeping the bottom-right corner where it is. */
async function resizeAnchored(w: number, h: number) {
  const sf = await win.scaleFactor();
  const pos = await win.outerPosition();
  const size = await win.outerSize();
  const right = pos.x + size.width;
  const bottom = pos.y + size.height;
  await win.setSize(new LogicalSize(w, h));
  await win.setPosition(
    new PhysicalPosition(right - Math.round(w * sf), bottom - Math.round(h * sf)),
  );
}

async function placeInitially(reset = false) {
  const sf = await win.scaleFactor();
  const w = Math.round(COMPACT.w * sf);
  const h = Math.round(COMPACT.h * sf);
  await win.setSize(new LogicalSize(COMPACT.w, COMPACT.h));

  let anchor: { x: number; y: number } | null = null;
  if (!reset) {
    try {
      anchor = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
    } catch {
      anchor = null;
    }
    // ignore a saved spot that is no longer on any monitor
    if (anchor) {
      const a = anchor;
      const monitors = await availableMonitors();
      const onScreen = monitors.some((m) => {
        const wa = m.workArea;
        return (
          a.x - w >= wa.position.x - 8 &&
          a.y - h >= wa.position.y - 8 &&
          a.x <= wa.position.x + wa.size.width + 8 &&
          a.y <= wa.position.y + wa.size.height + 8
        );
      });
      if (!onScreen) anchor = null;
    }
  }
  if (!anchor) {
    const m = await primaryMonitor();
    if (m) {
      const margin = Math.round(24 * m.scaleFactor);
      anchor = {
        x: m.workArea.position.x + m.workArea.size.width - margin,
        y: m.workArea.position.y + m.workArea.size.height - margin,
      };
    } else {
      anchor = { x: 1200, y: 700 };
    }
  }
  await win.setPosition(new PhysicalPosition(anchor.x - w, anchor.y - h));
}

function withinActiveHours(s: Settings, d = new Date()) {
  const h = d.getHours();
  if (s.startHour === s.endHour) return true; // all day
  if (s.startHour < s.endHour) return h >= s.startHour && h < s.endHour;
  return h >= s.startHour || h < s.endHour; // overnight range, e.g. 20 -> 4
}

export function Widget() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [count, setCount] = useState(() => todayCount());
  const [nudging, setNudging] = useState(false);
  const [message, setMessage] = useState(NUDGES[0]);
  const [celebrate, setCelebrate] = useState(false);

  // in `tauri dev` the first reminder comes after 15 s so the pop-up is easy to test
  const nextAt = useRef(
    Date.now() + (import.meta.env.DEV ? 15_000 : loadSettings().intervalMin * 60_000),
  );
  const hidden = useRef(false);
  const lastDay = useRef(new Date().toDateString());

  const refresh = useCallback(() => {
    const s = loadSettings();
    setSettings(s);
    setCount(todayCount());
  }, []);

  // first placement + show (resizing waits for this, or the two race)
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    (async () => {
      await placeInitially();
      await win.show();
      setPlaced(true);
    })();
  }, []);

  // remember where the user dragged the widget (bottom-right anchor)
  const userDragging = useRef(false);
  useEffect(() => {
    let t: number | undefined;
    const un = win.onMoved(() => {
      if (!userDragging.current) return; // ignore our own setPosition calls
      window.clearTimeout(t);
      t = window.setTimeout(async () => {
        userDragging.current = false;
        const pos = await win.outerPosition();
        const size = await win.outerSize();
        localStorage.setItem(
          POS_KEY,
          JSON.stringify({ x: pos.x + size.width, y: pos.y + size.height }),
        );
      }, 400);
    });
    return () => {
      void un.then((f) => f());
    };
  }, []);

  // sync with the settings window and the tray menu
  useEffect(() => {
    const a = listen(CHANGED_EVENT, refresh);
    const b = listen("tumbli:reset-position", async () => {
      localStorage.removeItem(POS_KEY);
      setNudging(false);
      await placeInitially(true);
      await win.show();
    });
    return () => {
      void a.then((f) => f());
      void b.then((f) => f());
    };
  }, [refresh]);

  // expand / collapse the window with the nudge
  useEffect(() => {
    if (!placed) return;
    const target = nudging ? EXPANDED : COMPACT;
    void resizeAnchored(target.w, target.h);
  }, [nudging, placed]);

  // reminder loop
  useEffect(() => {
    const id = window.setInterval(async () => {
      const now = new Date();

      // new day: counts come from history keyed by date, so just re-read
      if (now.toDateString() !== lastDay.current) {
        lastDay.current = now.toDateString();
        refresh();
      }

      let status: SystemStatus = { idle_secs: 0, busy: false };
      try {
        status = await invoke<SystemStatus>("system_status");
      } catch {
        /* not fatal */
      }

      // step out of the way of fullscreen apps (games, videos, presentations)
      const shouldHide = settings.hideOnFullscreen && status.busy;
      if (shouldHide !== hidden.current) {
        hidden.current = shouldHide;
        if (shouldHide) await win.hide();
        else await win.show();
      }

      // away from the computer: don't nag; remind shortly after they return
      if (status.idle_secs >= IDLE_SECS) {
        nextAt.current = Math.max(nextAt.current, Date.now() + 60_000);
        return;
      }

      const due =
        Date.now() >= nextAt.current &&
        withinActiveHours(settings, now) &&
        todayCount() < settings.goal &&
        !status.busy;

      if (due && !nudging) {
        setMessage(NUDGES[Math.floor(Math.random() * NUDGES.length)]);
        setNudging(true);
        if (settings.sound) bloop();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [settings, nudging, refresh]);

  const drink = () => {
    const n = addGlasses(1);
    setCount(n);
    setNudging(false);
    nextAt.current = Date.now() + settings.intervalMin * 60_000;
    if (n === settings.goal) {
      setCelebrate(true);
      if (settings.sound) bloop();
      window.setTimeout(() => setCelebrate(false), 4000);
    }
  };

  const snooze = () => {
    setNudging(false);
    nextAt.current = Date.now() + SNOOZE_MIN * 60_000;
  };

  const skip = () => {
    setNudging(false);
    nextAt.current = Date.now() + settings.intervalMin * 60_000;
  };

  const openSettings = () => void invoke("open_settings");

  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    userDragging.current = true;
    void win.startDragging();
  };

  const fill = count / settings.goal;
  const done = count >= settings.goal;
  const days = streak(loadHistory(), settings.goal);

  return (
    <div className={`widget ${nudging ? "expanded" : "compact"} ${celebrate ? "celebrate" : ""}`}>
      <div
        className="glass-wrap"
        onMouseDown={startDrag}
        onDoubleClick={openSettings}
        title="Drag to move · double-click for settings"
      >
        <Tumbler fill={fill} size={nudging ? 86 : 64} happy={done} />
        <div className="count">
          {count}/{settings.goal}
        </div>
      </div>

      {!nudging && (
        <div className="hover-actions">
          <button className="mini plus" onClick={drink} title="I drank a glass">
            +
          </button>
          <button className="mini" onClick={openSettings} title="Settings">
            ⚙
          </button>
        </div>
      )}

      {nudging && (
        <div className="nudge">
          <div className="nudge-title">{message}</div>
          <div className="nudge-sub">
            {count} of {settings.goal} glasses today
            {days > 0 && <> · 🔥 {days}</>}
          </div>
          <div className="nudge-actions">
            <button className="btn primary" onClick={drink}>
              💧 I drank!
            </button>
            <button className="btn" onClick={snooze}>
              ⏰ {SNOOZE_MIN}m
            </button>
            <button className="btn ghost" onClick={skip} title="Skip this reminder">
              ✕
            </button>
          </div>
        </div>
      )}

      {celebrate && done && !nudging && (
        <div className="toast" title="Goal reached!">
          🎉
        </div>
      )}
    </div>
  );
}
