import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/nunito";
import "./widget.css";
import { followTheme } from "../lib/theme";

async function boot() {
  // `npm run dev` + a normal browser: mock the Tauri backend (see src/dev/mocks.ts)
  if (import.meta.env.DEV) {
    const { inBrowser, setupBrowserMocks } = await import("../dev/mocks");
    if (inBrowser()) setupBrowserMocks("widget");
  }
  followTheme({ colorScheme: false }); // keep the transparent window transparent
  // loaded after the mocks: the widget talks to its window as soon as it loads
  const { Widget } = await import("./Widget");
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Widget />
    </React.StrictMode>,
  );
}

void boot();
