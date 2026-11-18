import { beforeEach, describe, expect, it } from "vitest";
import { applyTheme } from "./theme";
import { defaultSettings, loadSettings } from "./store";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("is dark by default, also for people who saved settings before it existed", () => {
    expect(defaultSettings.theme).toBe("dark");
    localStorage.setItem("tumbli.settings", JSON.stringify({ goalMl: 2500 }));
    expect(loadSettings().theme).toBe("dark");
  });

  it("keeps a light choice", () => {
    localStorage.setItem("tumbli.settings", JSON.stringify({ theme: "light" }));
    expect(loadSettings().theme).toBe("light");
  });

  it("marks the page so the CSS can switch", () => {
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
