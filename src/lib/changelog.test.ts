import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn(() => Promise.resolve()) }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(() => Promise.reject(new Error("no app"))) }));

import { CHANGELOG, compareVersions, markVersionSeen, pendingReleases } from "./changelog";
import pkg from "../../package.json";

beforeEach(() => localStorage.clear());

describe("changelog", () => {
  it("has an entry for the app's version, first", () => {
    expect(CHANGELOG[0].version).toBe(pkg.version);
  });
  it("compares versions by number", () => {
    expect(compareVersions("0.1.10", "0.1.9")).toBe(1);
    expect(compareVersions("0.1.4", "0.1.4")).toBe(0);
    expect(compareVersions("0.1", "0.1.1")).toBe(-1);
  });
});

describe("pendingReleases", () => {
  it("tells nothing on a fresh install, and remembers the version", () => {
    expect(pendingReleases("0.1.4", false)).toEqual([]);
    expect(pendingReleases("0.1.4", true)).toEqual([]);
  });
  it("shows this version to someone who used Tumbli before versions were kept", () => {
    expect(pendingReleases("0.1.4", true).map((r) => r.version)).toEqual(["0.1.4"]);
  });
  it("shows every release since the last one seen", () => {
    markVersionSeen("0.1.2");
    expect(pendingReleases("0.1.4", true).map((r) => r.version)).toEqual(["0.1.4", "0.1.3"]);
  });
  it("shows nothing once seen", () => {
    markVersionSeen("0.1.4");
    expect(pendingReleases("0.1.4", true)).toEqual([]);
  });
});
