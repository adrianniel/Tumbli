// Renders the Microsoft Store screenshots (3840x2160) from the REAL app UI.
//
// Each scene puts the real dev-server pages (settings.html / widget.html with the
// browser mocks from src/dev/mocks.ts) on a Windows-style desktop, so the
// screenshots show the app as it really looks: Tumbli docked at the screen edge
// above the taskbar, its tray icon, and the settings window among other apps.
//
// Usage:  npm run dev            (in another terminal; serves http://localhost:1420)
//         npm run screenshots    -> store-assets/screenshots/*.png
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "store-assets", "screenshots");
const srcDir = join(outDir, "src"); // served by the dev server too (git-ignored)
const DEV = "http://localhost:1420";
// the widget frames load from another origin so their storage is separate from
// the settings window's (a "fresh" setup page would otherwise wipe the demo data)
const WIDGET = "http://[::1]:1420";
const W = 1920; // CSS size of a scene; rendered at 2x
const H = 1080;
mkdirSync(srcDir, { recursive: true });

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!EDGE) throw new Error("Microsoft Edge not found");

const res = await fetch(`${DEV}/settings.html`).catch(() => null);
if (!res?.ok) throw new Error(`The dev server isn't running at ${DEV}. Start it with: npm run dev`);

// ---------------------------------------------------------------- desktop parts

const ICON = "/app-icon.svg";
const TASKBAR_H = 48;
const EDGE_MARGIN = 2; // same gap the app keeps from the screen edge

/** small line glyphs for the taskbar and window chrome */
const glyph = {
  search: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>`,
  wifi: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9a14 14 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>`,
  sound: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/></svg>`,
  battery: `<svg viewBox="0 0 24 24" width="18" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="7" width="17" height="10" rx="2.5"/><rect x="5" y="9.5" width="10" height="5" rx="1" fill="currentColor" stroke="none"/><path d="M21.5 10.5v3" stroke-linecap="round"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>`,
};

/** generic app tiles (no real brands) */
const tile = (bg, inner) =>
  `<span class="tb-app"><span class="tile" style="background:${bg}">${inner}</span></span>`;
const apps = [
  tile("linear-gradient(#FFD45C,#F5A623)", `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#fff" opacity=".95"/></svg>`),
  tile("linear-gradient(#3DD6C4,#1B8FD8)", `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2"><circle cx="12" cy="12" r="7.5"/><path d="M4.5 12h15M12 4.5c3 3.5 3 11.5 0 15M12 4.5c-3 3.5-3 11.5 0 15"/></svg>`),
  tile("linear-gradient(#5B8DEF,#3A5BD9)", `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4.5 7l7.5 6 7.5-6"/></svg>`),
  tile("linear-gradient(#B07CF0,#7D4BD6)", `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M7 8h10M7 12h10M7 16h6"/></svg>`),
  tile("linear-gradient(#FF8A7A,#E5534B)", `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><rect x="4.5" y="5.5" width="15" height="14" rx="2"/><path d="M4.5 10h15M9 3.5v4M15 3.5v4"/></svg>`),
];

function taskbar(dark, deskW) {
  // narrow screens use the left-aligned taskbar so the tray has room
  return `
  <div class="taskbar ${dark ? "dark" : ""} ${deskW < 900 ? "left" : ""}">
    <div class="tb-center">
      <span class="tb-app">${glyph.search}</span>
      ${apps.join("")}
      <span class="tb-app on"><img src="${ICON}" width="24" height="24" alt=""></span>
    </div>
    <div class="tb-tray">
      <span class="tb-ico">${glyph.chevron}</span>
      <img src="${ICON}" width="16" height="16" alt="">
      <span class="tb-ico">${glyph.wifi}${glyph.sound}${glyph.battery}</span>
      <span class="tb-clock"><b>10:24 AM</b><span>11/19/2026</span></span>
    </div>
  </div>`;
}

/** a Windows 11 style window */
function win({ x, y, w, h, title, icon, body, dark = false, z = 1, dim = false }) {
  return `
  <div class="win ${dark ? "dark" : ""} ${dim ? "dim" : ""}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${z}">
    <div class="win-bar">${icon}<span class="win-title">${title}</span>
      <span class="win-ctrls"><i class="min"></i><i class="max"></i><i class="cls"></i></span></div>
    <div class="win-body">${body}</div>
  </div>`;
}

const smallTile = (bg) => `<span class="win-ico" style="background:${bg}"></span>`;

/** a notes app, full of believable text */
const notesBody = (dark) => `
  <div class="notes ${dark ? "dark" : ""}">
    <div class="notes-tools"><span></span><span></span><span></span><span class="sep"></span><span></span><span></span></div>
    <div class="notes-page">
      <h3>Product launch: week 3</h3>
      <p class="meta">Edited 10 minutes ago</p>
      <p>Finish the landing page copy and send it to the team for a last read before Friday.</p>
      <ul>
        <li class="done">Review the onboarding screens</li>
        <li class="done">Book the photo shoot</li>
        <li>Draft the newsletter</li>
        <li>Check the pricing table on mobile</li>
      </ul>
      <p>Open questions for Thursday: launch time, which features go in the first email, and who answers support on day one.</p>
    </div>
  </div>`;

/** a week calendar with colored events */
const calendarBody = (dark) => {
  const days = ["Mon 16", "Tue 17", "Wed 18", "Thu 19", "Fri 20"];
  const ev = [
    [0, 0, 1, "#DCEBFF", "#2160C4", "Standup"],
    [1, 1, 2, "#FFE6D9", "#C2502A", "Design review"],
    [2, 0, 1, "#DCEBFF", "#2160C4", "Standup"],
    [2, 2, 1.5, "#E2F6EC", "#1C7A55", "Focus time"],
    [3, 0, 1, "#DCEBFF", "#2160C4", "Standup"],
    [3, 1.5, 1, "#F1E6FF", "#6B3FB8", "1:1 with Sam"],
    [3, 3, 1, "#FFF3D1", "#9A6B00", "Lunch"],
    [4, 0.5, 2, "#E2F6EC", "#1C7A55", "Workshop"],
    [0, 2.5, 1, "#FFF3D1", "#9A6B00", "Lunch"],
    [1, 3.2, 1, "#DCEBFF", "#2160C4", "Planning"],
  ];
  return `
  <div class="cal ${dark ? "dark" : ""}">
    <div class="cal-head"><b>November 2026</b><span class="pill">Today</span><span class="pill">Week</span></div>
    <div class="cal-grid">
      <div class="cal-times">${["9 AM", "10 AM", "11 AM", "12 PM", "1 PM"].map((t) => `<span>${t}</span>`).join("")}</div>
      ${days
        .map(
          (d, i) => `<div class="cal-col ${i === 3 ? "today" : ""}"><div class="cal-day">${d}</div>
            ${ev
              .filter((e) => e[0] === i)
              .map(([, top, len, bg, fg, t]) => {
                // dark theme: a deep tint of the event color with light text
                const back = dark ? `color-mix(in srgb, ${fg} 34%, #1F242B)` : bg;
                const text = dark ? `color-mix(in srgb, ${fg} 30%, #FFFFFF)` : fg;
                const line = dark ? `color-mix(in srgb, ${fg} 60%, #FFFFFF)` : fg;
                return `<div class="cal-ev" style="top:${30 + top * 44}px;height:${len * 44 - 4}px;background:${back};color:${text};border-color:${line}">${t}</div>`;
              })
              .join("")}</div>`,
        )
        .join("")}
    </div>
  </div>`;
};

/** the floating widget, docked to the right edge above the taskbar like the real app */
function widget(query, { w, h, deskW, deskH, bottom = 120 }) {
  const x = deskW - w - EDGE_MARGIN;
  const y = deskH - TASKBAR_H - bottom - h;
  return `<iframe class="frame" src="${WIDGET}/widget.html?${query}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:50"></iframe>`;
}

/** the settings window: real page inside Windows chrome */
function settingsWindow(query, { x, y, dark = false, z = 10 }) {
  const h = 720; // the real window size
  return win({
    x,
    y,
    w: 440,
    h: h + 32,
    z,
    dark,
    title: "Tumbli",
    icon: `<img src="${ICON}" width="16" height="16" alt="">`,
    body: `<iframe src="${DEV}/settings.html?${query}" style="width:440px;height:${h}px;display:block"></iframe>`,
  });
}

// --------------------------------------------------------------------- the page

/** the screen shows the desktop at `scale`, cropped by the frame */
const SCREEN = { x: 790, y: 92, w: W - 790, h: H - 92 };

function page({ kicker, title, sub, bullets = [], extra = "", dark = false, scale, desktop, callouts = [] }) {
  const deskW = Math.round(SCREEN.w / scale);
  const deskH = Math.round(SCREEN.h / scale);
  const ctx = { deskW, deskH };
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="/node_modules/@fontsource-variable/fredoka/index.css">
  <link rel="stylesheet" href="/node_modules/@fontsource-variable/nunito/index.css">
  <style>${CSS}</style></head>
  <body class="${dark ? "dark" : ""}">
    <div class="deco d1"></div><div class="deco d2"></div>
    <svg class="waves" viewBox="0 0 1920 240" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 120 C240 60 480 180 720 120 S1200 60 1440 120 S1800 170 1920 130 V240 H0Z" opacity=".55"/>
      <path d="M0 170 C260 120 520 220 780 170 S1260 120 1500 170 S1800 210 1920 180 V240 H0Z"/>
    </svg>
    <div class="brand"><img src="${ICON}" width="46" height="46" alt=""><span>Tumbli</span></div>
    <div class="copy">
      <div class="kicker">${kicker}</div>
      <h1>${title}</h1>
      <p class="sub">${sub}</p>
      ${bullets.length ? `<ul class="bullets">${bullets.map((b) => `<li><span class="check"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>${b}</li>`).join("")}</ul>` : ""}
      ${extra}
    </div>
    <div class="screen" style="left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.w}px;height:${SCREEN.h}px">
      <div class="desktop ${dark ? "dark" : ""}" style="width:${deskW}px;height:${deskH}px;transform:scale(${scale})">
        <div class="wall"></div>
        ${desktop(ctx)}
        ${taskbar(dark, deskW)}
      </div>
    </div>
    ${callouts.map((c) => `<div class="callout" style="left:${c.x}px;top:${c.y}px"><span class="dot"></span>${c.text}</div>`).join("")}
  </body></html>`;
}

const CSS = `
*{box-sizing:border-box} html,body{margin:0}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;font-family:"Nunito Variable",sans-serif;
  background:radial-gradient(1200px 700px at 0% 0%,#FFFFFF 0%,rgba(255,255,255,0) 60%),linear-gradient(160deg,#EEF6FC 0%,#D6EAF8 100%);color:#0E2F4A}
body.dark{background:radial-gradient(1100px 700px at 0% 0%,#17324D 0%,rgba(23,50,77,0) 60%),linear-gradient(160deg,#0C1A28 0%,#0A1420 100%);color:#E7F2FB}
.deco{position:absolute;border-radius:50%;filter:blur(2px)}
.d1{width:520px;height:520px;left:-180px;bottom:-260px;background:radial-gradient(circle,#BFE0F8 0%,rgba(191,224,248,0) 70%)}
.d2{width:300px;height:300px;left:520px;top:-150px;background:radial-gradient(circle,#FFE1DC 0%,rgba(255,225,220,0) 70%)}
.dark .d1{background:radial-gradient(circle,#173B5E 0%,rgba(23,59,94,0) 70%)}
.dark .d2{background:radial-gradient(circle,#3A2330 0%,rgba(58,35,48,0) 70%)}
.waves{position:absolute;left:0;bottom:0;width:100%;height:240px;fill:#C7E2F6}
.dark .waves{fill:#10263C}
.brand{position:absolute;left:110px;top:70px;display:flex;align-items:center;gap:14px;font:600 34px "Fredoka Variable";letter-spacing:-.3px}
.brand img{filter:drop-shadow(0 6px 10px rgba(14,47,74,.18))}
.copy{position:absolute;left:110px;top:0;bottom:0;width:620px;display:flex;flex-direction:column;justify-content:center}
.kicker{font:600 24px "Fredoka Variable";letter-spacing:3px;text-transform:uppercase;color:#FF7466;margin-bottom:16px}
h1{font:600 74px/1.04 "Fredoka Variable";margin:0 0 24px;letter-spacing:-1.2px}
.sub{font:500 28px/1.45 "Nunito Variable";margin:0;color:#4D6680}
.dark .sub{color:#9FB6CA}
.bullets{list-style:none;margin:34px 0 0;padding:0;display:flex;flex-direction:column;gap:16px}
.bullets li{display:flex;align-items:center;gap:14px;font:700 24px "Nunito Variable"}
.check{width:30px;height:30px;border-radius:50%;background:#20A47F;display:grid;place-items:center;flex:none;box-shadow:0 4px 10px -3px rgba(32,164,127,.6)}
.screen{position:absolute;overflow:hidden;border-radius:30px 0 0 0;
  box-shadow:0 50px 100px -30px rgba(10,30,50,.55),0 0 0 10px rgba(255,255,255,.55),0 0 0 11px rgba(14,47,74,.08)}
.dark .screen{box-shadow:0 50px 100px -30px rgba(0,0,0,.7),0 0 0 10px rgba(255,255,255,.06),0 0 0 11px rgba(255,255,255,.08)}
.desktop{position:relative;transform-origin:0 0;overflow:hidden;font-family:"Segoe UI Variable Text","Segoe UI",sans-serif}
.wall{position:absolute;inset:0;
  background:
    radial-gradient(60% 55% at 78% 30%,rgba(255,255,255,.55) 0%,rgba(255,255,255,0) 70%),
    radial-gradient(70% 60% at 15% 85%,rgba(46,139,230,.55) 0%,rgba(46,139,230,0) 70%),
    radial-gradient(50% 50% at 95% 95%,rgba(32,164,127,.35) 0%,rgba(32,164,127,0) 70%),
    linear-gradient(150deg,#9FD3F7 0%,#6DB5EC 45%,#4C9BE0 100%)}
.desktop.dark .wall{background:
    radial-gradient(60% 55% at 78% 30%,rgba(76,155,224,.35) 0%,rgba(76,155,224,0) 70%),
    radial-gradient(70% 60% at 15% 85%,rgba(32,164,127,.25) 0%,rgba(32,164,127,0) 70%),
    linear-gradient(150deg,#123150 0%,#0D2238 50%,#081626 100%)}
.wall::after{content:"";position:absolute;inset:0;opacity:.5;
  background:radial-gradient(120% 80% at 50% 120%,rgba(255,255,255,.35) 0 30%,rgba(255,255,255,0) 31%),radial-gradient(140% 90% at 40% 130%,rgba(255,255,255,.25) 0 32%,rgba(255,255,255,0) 33%)}
.desktop.dark .wall::after{opacity:.12}
.frame{position:absolute;border:0;background:transparent}
/* taskbar */
.taskbar{position:absolute;left:0;right:0;bottom:0;height:${TASKBAR_H}px;display:flex;align-items:center;justify-content:center;z-index:100;
  background:rgba(238,243,248,.86);backdrop-filter:blur(24px);border-top:1px solid rgba(255,255,255,.7);color:#1B2633}
.taskbar.dark{background:rgba(28,32,38,.88);border-top-color:rgba(255,255,255,.08);color:#E6EAF0}
.tb-center{display:flex;align-items:center;gap:6px}
.taskbar.left{justify-content:flex-start;padding-left:10px}
.tb-search{display:flex;align-items:center;gap:8px;height:32px;padding:0 14px 0 10px;border-radius:16px;margin-right:6px;font-size:13px;
  background:rgba(255,255,255,.75);border:1px solid rgba(14,47,74,.08);color:#5B6B7B}
.dark .tb-search{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.08);color:#AEB8C4}
.tb-app{width:40px;height:40px;border-radius:6px;display:grid;place-items:center;position:relative}
.tb-app.on{background:rgba(255,255,255,.65)}
.dark .tb-app.on{background:rgba(255,255,255,.09)}
.tb-app.on::after{content:"";position:absolute;bottom:2px;left:50%;width:16px;height:3px;margin-left:-8px;border-radius:2px;background:#0067C0}
.dark .tb-app.on::after{background:#4CC2FF}
.tile{width:24px;height:24px;border-radius:6px;display:grid;place-items:center;box-shadow:inset 0 -1px 0 rgba(0,0,0,.12)}
.tb-tray{position:absolute;right:10px;top:0;bottom:0;display:flex;align-items:center;gap:12px;font-size:12px}
.tb-ico{display:flex;align-items:center;gap:8px}
.tb-clock{display:flex;flex-direction:column;align-items:flex-end;line-height:1.3}
.tb-clock b{font-weight:400}
/* windows */
.win{position:absolute;border-radius:9px;overflow:hidden;background:#FFFFFF;
  box-shadow:0 22px 50px -12px rgba(8,30,55,.45),0 0 0 1px rgba(14,47,74,.12)}
.win.dark{background:#1F242B;box-shadow:0 22px 50px -12px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.1)}
.win.dim{filter:saturate(.9)}
.win-bar{height:32px;display:flex;align-items:center;gap:9px;padding-left:12px;background:#F3F5F8;font-size:12px;color:#1B2633}
.win.dark .win-bar{background:#262C34;color:#E6EAF0}
.win-ico{width:14px;height:14px;border-radius:4px}
.win-title{flex:1}
.win-ctrls{display:flex;height:100%}
.win-ctrls i{width:46px;height:100%;position:relative}
.win-ctrls i::before,.win-ctrls i::after{content:"";position:absolute;left:50%;top:50%;background:currentColor;opacity:.85}
.win-ctrls .min::before{width:10px;height:1px;margin-left:-5px}
.win-ctrls .max::before{width:9px;height:9px;margin:-5px 0 0 -5px;background:none;border:1px solid currentColor;border-radius:2px}
.win-ctrls .cls::before,.win-ctrls .cls::after{width:13px;height:1px;margin-left:-6.5px;transform:rotate(45deg)}
.win-ctrls .cls::after{transform:rotate(-45deg)}
.win-body{height:calc(100% - 32px);overflow:hidden}
.win-body iframe{border:0}
/* notes app */
.notes{height:100%;background:#FFFFFF;color:#1F2B37}
.notes.dark{background:#1F242B;color:#DCE3EA}
.notes-tools{display:flex;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid rgba(14,47,74,.08)}
.notes.dark .notes-tools{border-color:rgba(255,255,255,.08)}
.notes-tools span{width:22px;height:18px;border-radius:4px;background:rgba(14,47,74,.08)}
.notes.dark .notes-tools span{background:rgba(255,255,255,.08)}
.notes-tools .sep{width:1px;height:18px}
.notes-page{padding:20px 30px;font-size:14px;line-height:1.6}
.notes-page h3{margin:0;font-size:22px;font-weight:600}
.notes-page .meta{margin:2px 0 12px;font-size:12px;opacity:.55}
.notes-page p{margin:0 0 12px}
.notes-page ul{margin:0 0 12px;padding:0;list-style:none}
.notes-page li{padding-left:28px;position:relative;margin:4px 0}
.notes-page li::before{content:"";position:absolute;left:2px;top:4px;width:15px;height:15px;border-radius:4px;border:1.5px solid #8798A8}
.notes-page li.done{opacity:.55;text-decoration:line-through}
.notes-page li.done::before{background:#5B8DEF;border-color:#5B8DEF}
/* calendar */
.cal{height:100%;background:#FFFFFF;color:#1F2B37;display:flex;flex-direction:column}
.cal.dark{background:#1F242B;color:#DCE3EA}
.cal-head{display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:16px}
.cal-head b{flex:1;font-weight:600}
.pill{font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid rgba(14,47,74,.14)}
.cal.dark .pill{border-color:rgba(255,255,255,.14)}
.cal-grid{flex:1;display:flex;border-top:1px solid rgba(14,47,74,.08)}
.cal.dark .cal-grid{border-color:rgba(255,255,255,.08)}
.cal-times{width:54px;padding-top:30px;font-size:11px;opacity:.55;text-align:right;padding-right:8px}
.cal-times span{display:block;height:44px}
.cal-col{flex:1;position:relative;border-left:1px solid rgba(14,47,74,.08);
  background:repeating-linear-gradient(to bottom,transparent 0 29px,rgba(14,47,74,.07) 29px 30px,transparent 30px 73px,rgba(14,47,74,.07) 73px 74px)}
.cal.dark .cal-col{border-color:rgba(255,255,255,.07)}
.cal-col.today .cal-day{color:#0067C0;font-weight:700}
.cal.dark .cal-col.today .cal-day{color:#4CC2FF}
.cal.dark .cal-col{background:repeating-linear-gradient(to bottom,transparent 0 29px,rgba(255,255,255,.06) 29px 30px,transparent 30px 73px,rgba(255,255,255,.06) 73px 74px)}
.cal-day{height:30px;line-height:30px;text-align:center;font-size:12px}
.cal-ev{position:absolute;left:4px;right:4px;border-radius:5px;border-left:3px solid;padding:3px 6px;font-size:11px;font-weight:600;overflow:hidden}
/* callouts */
.callout{position:absolute;z-index:200;display:flex;align-items:center;gap:12px;padding:14px 22px 14px 18px;border-radius:999px;background:#FFFFFF;
  font:600 22px "Fredoka Variable";color:#0E2F4A;box-shadow:0 18px 40px -14px rgba(10,30,50,.45),0 0 0 1px rgba(14,47,74,.06)}
.dark .callout{background:#16283A;color:#E7F2FB;box-shadow:0 18px 40px -14px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.08)}
.callout .dot{width:12px;height:12px;border-radius:50%;background:#1E8FE1;box-shadow:0 0 0 5px rgba(30,143,225,.18)}
/* outfit strip */
.outfits{display:flex;gap:14px;margin-top:38px}
.outfit{width:104px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 0 12px;border-radius:18px;background:rgba(255,255,255,.75);
  box-shadow:0 10px 24px -14px rgba(10,30,50,.35)}
.outfit iframe{border:0;width:76px;height:140px;transform:scale(.78);transform-origin:50% 0;margin-bottom:-31px;background:transparent}
.outfit span{font:600 16px "Fredoka Variable"}
.dark .outfit{background:rgba(255,255,255,.06);box-shadow:0 0 0 1px rgba(255,255,255,.08)}
`;

// ------------------------------------------------------------------- the scenes

const sizes = { idle: { w: 76, h: 140 }, hover: { w: 140, h: 140 }, talk: { w: 350, h: 240 } };

const OUTFITS = [
  ["partyhat", "Party hat"],
  ["bowtie", "Bow tie"],
  ["sunglasses", "Shades"],
  ["headphones", "Headphones"],
  ["crown", "Crown"],
];

const scenes = {
  "1-meet-tumbli": {
    kicker: "Meet Tumbli",
    title: "A water buddy for your desktop",
    sub: "Tumbli floats at the edge of your screen and fills up as you drink. One click logs a glass.",
    bullets: ["Always on top, never in the way", "Docks to any edge of the screen", "Free: no account, no ads"],
    dark: true,
    scale: 1.6,
    desktop: ({ deskW, deskH }) =>
      win({ x: 24, y: 26, w: 470, h: 330, title: "Notes", icon: smallTile("#7D4BD6"), body: notesBody(true), dark: true }) +
      widget("demo&tumbler&hover", { ...sizes.hover, deskW, deskH, bottom: 70 }),
    callouts: [
      { x: 1360, y: 728, text: "Hover for quick actions" },
      { x: 1505, y: 905, text: "Fills up as you drink" },
    ],
  },
  "2-reminder": {
    kicker: "Gentle reminders",
    title: "Time for a sip? Tumbli will tell you",
    sub: "A friendly nudge at just the right time. Log a drink, snooze or skip in one click.",
    bullets: ["Only during your active hours", "Quiet while you're away from the PC", "Hides during games, videos and slides"],
    dark: true,
    scale: 1.6,
    desktop: ({ deskW, deskH }) =>
      win({ x: 20, y: 20, w: 560, h: 380, title: "Calendar", icon: smallTile("#E5534B"), body: calendarBody(true), dark: true }) +
      widget("demo&tumbler&nudge", { ...sizes.talk, deskW, deskH, bottom: 40 }),
  },
  "3-your-plan": {
    kicker: "Made for you",
    title: "A daily goal that fits your body",
    sub: "A 30-second check-in looks at your age, weight, activity and weather.",
    bullets: ["Track by the glass or by your own tumbler", "Reminders spread over your day", "Change it anytime"],
    dark: true,
    scale: 1.12,
    desktop: ({ deskW, deskH }) =>
      win({ x: 24, y: 40, w: 640, h: 440, title: "Notes", icon: smallTile("#7D4BD6"), body: notesBody(true), dark: true, dim: true }) +
      settingsWindow("fresh&tumbler&step=result", { x: 330, y: deskH - TASKBAR_H - 752 - 14, dark: true }) +
      widget("demo&tumbler", { ...sizes.idle, deskW, deskH, bottom: 60 }),
  },
  "4-progress": {
    kicker: "Your week",
    title: "Watch your streak grow",
    sub: "See today at a glance and your whole week in one chart.",
    bullets: ["Daily streaks and goals", "A 7-day history chart", "A recap every Monday"],
    dark: true,
    scale: 1.12,
    desktop: ({ deskW, deskH }) =>
      win({ x: 24, y: 60, w: 640, h: 420, title: "Calendar", icon: smallTile("#E5534B"), body: calendarBody(true), dark: true, dim: true }) +
      settingsWindow("demo&tumbler", { x: 330, y: deskH - TASKBAR_H - 752 - 14, dark: true }) +
      widget("demo&tumbler", { ...sizes.idle, deskW, deskH, bottom: 60 }),
  },
  "5-outfits": {
    kicker: "Achievements",
    title: "Keep your streak, dress up Tumbli",
    sub: "Every milestone unlocks something new for your water buddy.",
    extra: `<div class="outfits">${OUTFITS.map(
      ([o, name]) => `<div class="outfit"><iframe src="${WIDGET}/widget.html?demo&outfit=${o}"></iframe><span>${name}</span></div>`,
    ).join("")}</div>`,
    dark: true,
    scale: 1.6,
    desktop: ({ deskW, deskH }) =>
      win({ x: 20, y: 20, w: 520, h: 360, title: "Notes", icon: smallTile("#7D4BD6"), body: notesBody(true), dark: true }) +
      widget("demo&tumbler&award=3", { ...sizes.talk, deskW, deskH, bottom: 40 }),
  },
  "6-light-mode": {
    kicker: "Light or dark",
    title: "Easy on the eyes, day and night",
    sub: "Tumbli is dark by default. Prefer it bright? One switch in Settings.",
    bullets: ["Dark or light, your choice", "A recap of your week every Monday", "Pause from the tray icon anytime"],
    scale: 1.12,
    desktop: ({ deskW, deskH }) =>
      win({ x: 24, y: 40, w: 600, h: 420, title: "Notes", icon: smallTile("#7D4BD6"), body: notesBody(false), dim: true }) +
      settingsWindow("demo&tumbler&theme=light", { x: 150, y: deskH - TASKBAR_H - 752 - 14 }) +
      widget("demo&tumbler&recap&theme=light", { ...sizes.talk, deskW, deskH, bottom: 50 }),
  },
};

// stale files from older layouts
for (const f of readdirSync(outDir)) if (f.endsWith(".png") && !(f.replace(/\.png$/, "") in scenes)) rmSync(join(outDir, f));

for (const [name, scene] of Object.entries(scenes)) {
  writeFileSync(join(srcDir, `${name}.html`), page(scene));
  const out = join(outDir, `${name}.png`);
  rmSync(out, { force: true });
  const profile = mkdtempSync(join(tmpdir(), "tumbli-shots-")); // fresh storage per scene
  execFileSync(EDGE, [
    "--headless=new",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--hide-scrollbars",
    `--blink-settings=preferredColorScheme=${scene.dark ? 0 : 1}`,
    "--force-device-scale-factor=2",
    "--virtual-time-budget=7000",
    `--window-size=${W},${H}`,
    `--screenshot=${out}`,
    `${DEV}/store-assets/screenshots/src/${name}.html`,
  ]);
  const t0 = Date.now();
  while (!existsSync(out) && Date.now() - t0 < 10000) await new Promise((r) => setTimeout(r, 200));
  if (!existsSync(out)) throw new Error(`Edge did not write ${out}`);
  console.log("wrote", out);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
  } catch {
    // Edge may still hold it; it's in the temp folder
  }
}
