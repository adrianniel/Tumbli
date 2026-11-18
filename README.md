# 🥤 Tumbli

A floating water reminder for Windows, for people who spend most of the day at their computer.

Tumbli is a little digital tumbler that floats on your screen and fills up as you drink. Every so often it pops out
with a friendly nudge to take a water break, until you hit your daily goal (8 glasses by default).

## Features

- **Floating widget**: always on top, draggable, and it remembers where you put it
- **Reminders** every 15 min to 2 h, only during your active hours
- **One-click logging**: 💧 *I drank!*, ⏰ *Snooze 10 min*, ✕ *Skip*
- **Smart timing**: no nudges while you're away from the keyboard; hides during fullscreen games, videos and presentations
- **Daily goal, streaks, and a 7-day history**
- **Start with Windows**, single instance, light/dark theme
- **No account, no server**: everything stays on your PC

The widget stays on screen until you choose **Quit Tumbli** from the system tray icon.

## Tech

[Tauri 2](https://tauri.app) (Rust) + React + TypeScript + Vite.

| Path | What |
|---|---|
| `src/widget/` | The floating widget window (`index.html`) |
| `src/settings/` | The settings / stats window (`settings.html`) |
| `src/lib/store.ts` | Settings and daily history (localStorage) |
| `src-tauri/src/lib.rs` | Tray menu, idle + fullscreen detection, window behavior |

## Development

Prerequisites: [Node.js](https://nodejs.org), [Rust](https://rustup.rs), and the Visual Studio C++ Build Tools
(see [Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev     # run with hot reload (first reminder pops after 15 s)
npm run tauri build   # build installers into src-tauri/target/release/bundle
npm test              # unit tests (Vitest)
```

## Microsoft Store (MSIX)

The Store build is an MSIX package made from the release exe:

1. In Partner Center open **Tumbli > Product management > Product identity** and copy
   `Package/Identity/Name`, `Package/Identity/Publisher` and `Package/Properties/PublisherDisplayName`
   into `packaging/msix/identity.json`.
2. Build and pack:

   ```bash
   npm run tauri build -- --no-bundle
   powershell -ExecutionPolicy Bypass -File scripts/package-msix.ps1
   ```

3. Upload `dist-msix/Tumbli_<version>_x64.msix` in the submission's **Packages** step.
   The Store signs it. Bump `version` in `src-tauri/tauri.conf.json` for every new submission.

The manifest declares `runFullTrust` (all desktop apps need it) and a `windows.startupTask`
so "Start with Windows" works inside the package; the app switches between that and the
registry-based autostart automatically.
