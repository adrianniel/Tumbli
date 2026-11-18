/**
 * Dev-only: lets the settings and widget pages run in a normal browser
 * (http://localhost:1420/settings.html) with the Tauri backend mocked.
 * The browser has its own localStorage, so this never touches the real app's data.
 *
 *   ?fresh   start from an empty state (first-run setup)
 *   ?demo    fill in a sample week of history
 *   ?tumbler use tumbler mode for the sample data
 */
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

export function inBrowser() {
  return !("__TAURI_INTERNALS__" in window);
}

export function setupBrowserMocks(label: string) {
  mockWindows(label, "widget", "settings");
  mockIPC(
    (cmd) => {
      switch (cmd) {
        case "system_status":
          return { idle_secs: 0, busy: false };
        case "primary_button_down":
          return false;
        case "startup_status":
          return { packaged: false, state: "" };
        case "plugin:autostart|is_enabled":
          return false;
        // widget window geometry
        case "plugin:window|scale_factor":
          return 1;
        case "plugin:window|outer_position":
          return { x: new URLSearchParams(location.search).has("left") ? 40 : 1000, y: 500 };
        case "plugin:window|outer_size":
          return { width: 100, height: 140 };
        case "plugin:window|available_monitors":
          return [
            {
              name: "mock",
              size: { width: 1920, height: 1080 },
              position: { x: 0, y: 0 },
              workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1032 } },
              scaleFactor: 1,
            },
          ];
        default:
          return null;
      }
    },
    { shouldMockEvents: true },
  );

  const q = new URLSearchParams(location.search);
  if (q.has("fresh")) localStorage.clear();
  if (q.has("left")) localStorage.setItem("tumbli.widget.anchor.v3", JSON.stringify({ side: "left", x: 0, bottom: 1000 }));
  if (q.has("fresh") && q.has("tumbler")) localStorage.setItem("tumbli.profile", JSON.stringify({ mode: "tumbler" }));
  if (q.has("demo")) {
    const mode = q.has("tumbler") ? "tumbler" : "glass";
    const day = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    localStorage.setItem(
      "tumbli.settings",
      JSON.stringify({ mode, goalMl: 2000, glassMl: 250, tumblerMl: 750, intervalMin: 60, startHour: 8, endHour: 20, name: "Ana" }),
    );
    // three weeks of history, so the week chart, "last week" and the recap all have data
    const ml = [1250, 2000, 2250, 1500, 2000, 750, 2000, 1750, 2250, 2000, 1500, 2000, 2250, 1500, 1750, 2000, 1250, 1750, 2000, 1500];
    localStorage.setItem("tumbli.historyMl", JSON.stringify(Object.fromEntries(ml.map((v, n) => [day(n), v]))));
    localStorage.setItem("tumbli.level", q.has("empty") ? "0" : "300");
    localStorage.setItem("tumbli.onboarded", "1");
    // a few unlocked outfits for the wardrobe preview
    localStorage.setItem("tumbli.achievements", JSON.stringify({ "first-sip": day(5), "goal-getter": day(4), "on-a-roll": day(2) }));
    if (q.get("outfit")) {
      const st = JSON.parse(localStorage.getItem("tumbli.settings") ?? "{}");
      localStorage.setItem("tumbli.settings", JSON.stringify({ ...st, outfit: q.get("outfit") }));
    }
    localStorage.setItem("tumbli.tourDone", "1");
  }
}
