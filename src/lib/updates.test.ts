import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

import { snoozeUpdate, STORE_PAGE, storeUpdate, UPDATE_SNOOZE_MS, updateSnoozed } from "./updates";

beforeEach(() => {
  localStorage.clear();
  invoke.mockReset();
});

describe("store updates", () => {
  it("opens Tumbli's own Store page", () => {
    expect(STORE_PAGE).toBe("ms-windows-store://pdp/?ProductId=9N6798TPR3KX");
  });
  it("passes on the version the Store has", async () => {
    invoke.mockResolvedValue("0.1.6");
    expect(await storeUpdate()).toBe("0.1.6");
    expect(invoke).toHaveBeenCalledWith("store_update");
  });
  it("is quiet when up to date or when asking fails", async () => {
    invoke.mockResolvedValue(null);
    expect(await storeUpdate()).toBeNull();
    invoke.mockRejectedValue(new Error("offline"));
    expect(await storeUpdate()).toBeNull();
  });
  it("waits a day after Later", () => {
    const now = 1_000_000;
    expect(updateSnoozed(now)).toBe(false);
    snoozeUpdate(now);
    expect(updateSnoozed(now + 3600_000)).toBe(true);
    expect(updateSnoozed(now + UPDATE_SNOOZE_MS)).toBe(false);
  });
});
