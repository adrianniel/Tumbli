import React from "react";
import ReactDOM from "react-dom/client";
import { Settings } from "./Settings";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/nunito";
import "./settings.css";
import { followTheme } from "../lib/theme";

async function boot() {
  // `npm run dev` + a normal browser: mock the Tauri backend (see src/dev/mocks.ts)
  if (import.meta.env.DEV) {
    const { inBrowser, setupBrowserMocks } = await import("../dev/mocks");
    if (inBrowser()) setupBrowserMocks("settings");
  }
  followTheme();
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Settings />
    </React.StrictMode>,
  );
}

void boot();
