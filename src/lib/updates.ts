/**
 * Telling people a new Tumbli is out, without them opening the Microsoft Store: the Rust
 * side asks the Store (StoreContext) whether a newer package exists; Tumbli then offers a
 * button that opens its Store page, where the update is one click.
 */
import { invoke } from "@tauri-apps/api/core";
import { STORE_PRODUCT_ID } from "../config";

/** Tumbli's page in the Microsoft Store app (Get updates is right there). */
export const STORE_PAGE = STORE_PRODUCT_ID
  ? `ms-windows-store://pdp/?ProductId=${STORE_PRODUCT_ID}`
  : "ms-windows-store://downloadsandupdates";

/**
 * The version waiting in the Store ("" when the Store doesn't say which), or null when
 * Tumbli is up to date, not installed from the Store, or offline.
 */
export async function storeUpdate(): Promise<string | null> {
  try {
    const v = await invoke<string | null>("store_update");
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

const SNOOZE_KEY = "tumbli.updateSnoozedUntil";

/** "Later" on the update bubble: ask again after this long. */
export const UPDATE_SNOOZE_MS = 24 * 3600_000;

export function updateSnoozed(now = Date.now()) {
  return now < (Number(localStorage.getItem(SNOOZE_KEY)) || 0);
}

export function snoozeUpdate(now = Date.now()) {
  localStorage.setItem(SNOOZE_KEY, String(now + UPDATE_SNOOZE_MS));
}
