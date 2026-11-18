import { useEffect, useRef } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { saveShortcutStatus, type Settings } from "../lib/store";

// Register/unregister one after another: overlapping calls (e.g. React running an
// effect twice) could otherwise unregister the shortcut right after it was registered.
let chain: Promise<void> = Promise.resolve();
let current: string | null = null;

function apply(combo: string | null, onPress: () => void) {
  chain = chain.then(async () => {
    if (current === combo) return;
    if (current) {
      await unregister(current).catch(() => {});
      current = null;
    }
    if (!combo) {
      saveShortcutStatus("off");
      return;
    }
    try {
      await register(combo, (e) => {
        if (e.state === "Pressed") onPress();
      });
      current = combo;
      saveShortcutStatus("ok");
    } catch (err) {
      localStorage.setItem("tumbli.shortcutError", String(err));
      saveShortcutStatus("taken");
    }
  });
}

/**
 * A system-wide keyboard shortcut (Ctrl+Alt+W by default) that logs a drink from any app.
 * If another app already owns the combination, the settings window says so.
 */
export function useShortcut(settings: Pick<Settings, "shortcutOn" | "shortcut">, onPress: () => void) {
  const cb = useRef(onPress);
  cb.current = onPress;

  useEffect(() => {
    const press = () => cb.current();
    apply(settings.shortcutOn ? settings.shortcut : null, press);
    return () => apply(null, press);
  }, [settings.shortcutOn, settings.shortcut]);
}
