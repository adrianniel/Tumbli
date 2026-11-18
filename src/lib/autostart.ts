import { invoke } from "@tauri-apps/api/core";
import * as plugin from "@tauri-apps/plugin-autostart";

/**
 * "Start with Windows" works differently for the two ways Tumbli ships:
 * - plain installer (MSI / exe): a Run registry entry via tauri-plugin-autostart
 * - Microsoft Store (MSIX): the package's StartupTask, which Windows controls
 */

type StartupStatus = { packaged: boolean; state: string };

export type AutostartState = {
  enabled: boolean;
  /** turned off in Task Manager / Settings > Apps > Startup; only the user can turn it back on there */
  blockedByUser: boolean;
};

function fromPackaged(state: string): AutostartState {
  return {
    enabled: state === "enabled" || state === "enabled_by_policy",
    blockedByUser: state === "disabled_by_user" || state === "disabled_by_policy",
  };
}

export async function getAutostart(): Promise<AutostartState> {
  const status = await invoke<StartupStatus>("startup_status");
  if (status.packaged) return fromPackaged(status.state);
  return { enabled: await plugin.isEnabled(), blockedByUser: false };
}

export async function setAutostart(on: boolean): Promise<AutostartState> {
  const status = await invoke<StartupStatus>("startup_status");
  if (status.packaged) {
    return fromPackaged(await invoke<string>("startup_set", { enable: on }));
  }
  if (on) await plugin.enable();
  else await plugin.disable();
  return { enabled: await plugin.isEnabled(), blockedByUser: false };
}
