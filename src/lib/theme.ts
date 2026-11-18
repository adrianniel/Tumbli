/** Dark or light look for a window, from the setting (dark by default). */
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CHANGED_EVENT, loadSettings, type Theme } from "./store";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  root.dataset.theme = theme; // the CSS keys its dark styles on this
  root.style.colorScheme = theme; // scrollbars and form controls
  try {
    // the settings window's title bar follows too
    void getCurrentWindow()
      .setTheme(theme)
      .catch(() => {});
  } catch {
    // not inside Tauri (tests)
  }
}

/** Apply the saved theme now, and again whenever the settings change (in any window). */
export function followTheme() {
  applyTheme(loadSettings().theme);
  void listen(CHANGED_EVENT, () => applyTheme(loadSettings().theme)).catch(() => {});
}
