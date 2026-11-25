import React from "react";
import ReactDOM from "react-dom/client";
import { Settings } from "./Settings";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/nunito";
import "./settings.css";
import { followTheme } from "../lib/theme";
import { getCurrentWindow } from "@tauri-apps/api/window";

async function boot() {
  // `npm run dev` + a normal browser: mock the Tauri backend (see src/dev/mocks.ts)
  let preview = false;
  if (import.meta.env.DEV) {
    const { inBrowser, setupBrowserMocks } = await import("../dev/mocks");
    preview = inBrowser();
    if (preview) setupBrowserMocks("settings");
  }
  followTheme();
  // This window is only hidden when closed, and a hidden WebView still draws every frame
  // of every animation (GPU time all day): keep them still while it's hidden. Shown, even
  // behind other apps, everything moves as usual.
  if (!preview) {
    const win = getCurrentWindow();
    const check = () =>
      void win
        .isVisible()
        .then((shown) => document.documentElement.classList.toggle("window-idle", !shown))
        .catch(() => {});
    window.addEventListener("focus", check);
    window.addEventListener("blur", () => window.setTimeout(check, 300)); // closing hides it
    window.setInterval(check, 3000); // shown without focus (rare): catch up soon
    check();
  }
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Settings />
    </React.StrictMode>,
  );
}

void boot();
