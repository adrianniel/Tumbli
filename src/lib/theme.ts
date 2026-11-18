/** Dark or light look for a window, from the setting (dark by default). */
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CHANGED_EVENT, loadSettings, type Theme } from "./store";

/**
 * `colorScheme` also switches scrollbars and form controls. The floating widget
 * must not use it: on a transparent window a dark color scheme paints the page
 * background, which would put a dark box behind Tumbli.
 */
export function applyTheme(theme: Theme, { colorScheme = true } = {}) {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  root.dataset.theme = theme; // the CSS keys its dark styles on this
  if (!colorScheme) return;
  root.style.colorScheme = theme;
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
export function followTheme(opts?: { colorScheme?: boolean }) {
  applyTheme(loadSettings().theme, opts);
  void listen(CHANGED_EVENT, () => applyTheme(loadSettings().theme, opts)).catch(() => {});
}
