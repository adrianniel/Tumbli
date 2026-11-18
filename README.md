# 💧 SipUp

A floating water reminder for Windows, for people who spend most of the day at their computer.

SipUp lives as a small glass on your screen that fills up as you drink. Every so often it pops out
with a friendly nudge to take a water break, until you hit your daily goal (8 glasses by default).

## Features

- **Floating widget**: always on top, draggable, and it remembers where you put it
- **Reminders** every 15 min to 2 h, only during your active hours
- **One-click logging**: 💧 *I drank!*, ⏰ *Snooze 10 min*, ✕ *Skip*
- **Smart timing**: no nudges while you're away from the keyboard; hides during fullscreen games, videos and presentations
- **Daily goal, streaks, and a 7-day history**
- **Start with Windows**, single instance, light/dark theme
- **No account, no server**: everything stays on your PC

The widget stays on screen until you choose **Quit SipUp** from the system tray icon.

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
npm run tauri dev     # run with hot reload
npm run tauri build   # build installers into src-tauri/target/release/bundle
```
