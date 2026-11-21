import React from "react";
import ReactDOM from "react-dom/client";
import { Settings } from "./Settings";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/nunito";
import "./settings.css";
import { followTheme } from "../lib/theme";

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
  // of every animation (GPU time all day): keep them still unless the window is in use.
  if (!preview) {
    const still = () => document.documentElement.classList.toggle("window-idle", !document.hasFocus());
    window.addEventListener("focus", still);
    window.addEventListener("blur", still);
    still();
  }
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Settings />
    </React.StrictMode>,
  );
}

void boot();
