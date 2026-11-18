// Renders the Microsoft Store screenshots (1920x1080) from the REAL app UI.
//
// The scenes embed the dev-server pages (settings.html / widget.html with the
// browser mocks from src/dev/mocks.ts), so the screenshots always match the app.
//
// Usage:  npm run dev            (in another terminal; serves http://localhost:1420)
//         npm run screenshots    -> store-assets/screenshots/*.png
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "store-assets", "screenshots");
const srcDir = join(outDir, "src"); // served by the dev server too (git-ignored)
const DEV = "http://localhost:1420";
mkdirSync(srcDir, { recursive: true });

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!EDGE) throw new Error("Microsoft Edge not found");

const res = await fetch(`${DEV}/settings.html`).catch(() => null);
if (!res?.ok) throw new Error(`The dev server isn't running at ${DEV}. Start it with: npm run dev`);

/** an app window with a Windows-style title bar, showing a real page */
const appWindow = (src, { w = 440, h = 720, scale = 1.22 } = {}) => `
  <div class="win" style="width:${w * scale}px;height:${h * scale + 36}px">
    <div class="titlebar"><span class="appicon"></span>Tumbli<span class="ctrls">–&nbsp;&nbsp;▢&nbsp;&nbsp;✕</span></div>
    <iframe src="${src}" style="width:${w}px;height:${h}px;transform:scale(${scale})"></iframe>
  </div>`;

/** a bare page (the floating widget has no window chrome) */
const frame = (src, { w, h, scale, style = "" }) =>
  `<iframe class="bare" src="${src}" style="width:${w}px;height:${h}px;transform:scale(${scale});${style}"></iframe>`;

function page(kicker, title, sub, scene, { dark = false } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="/node_modules/@fontsource-variable/fredoka/index.css">
  <link rel="stylesheet" href="/node_modules/@fontsource-variable/nunito/index.css">
  <style>
    *{box-sizing:border-box} html,body{margin:0}
    body{width:1920px;height:1080px;overflow:hidden;background:${dark ? "#0a1724" : "#e6f0f6"};color:${dark ? "#e7f2fb" : "#0e2f4a"};font-family:"Nunito Variable",sans-serif}
    .wrap{display:flex;height:100%;align-items:center;padding:0 110px;gap:70px}
    .copy{width:620px;flex:none}
    .kicker{font:600 26px "Fredoka Variable";letter-spacing:3px;text-transform:uppercase;color:#ff7466;margin-bottom:18px}
    h1{font:600 78px/1.04 "Fredoka Variable";margin:0 0 26px;letter-spacing:-1px}
    p{font:500 30px/1.45 "Nunito Variable";margin:0;color:${dark ? "#9fb6ca" : "#4d6680"}}
    .scene{flex:1;height:960px;position:relative;display:flex;align-items:center;justify-content:center}
    .win{border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 40px 80px -30px rgba(10,30,50,.45),0 0 0 1px rgba(14,47,74,.08);flex:none}
    .titlebar{height:36px;display:flex;align-items:center;gap:10px;padding:0 16px;background:#f3f3f3;font:600 15px "Segoe UI",sans-serif;color:#333}
    .appicon{width:16px;height:16px;background:url(/app-icon.svg) center/contain no-repeat}
    .ctrls{margin-left:auto;color:#666;letter-spacing:2px}
    iframe{border:0;transform-origin:0 0;display:block;background:transparent}
    .bare{position:absolute}
    .desktop{position:absolute;inset:40px 0;border-radius:28px;background:#1b2a3a;overflow:hidden}
    .app{position:absolute;border-radius:14px;background:#243649}
    .bar{height:14px;border-radius:7px;background:#33485f;margin:14px 0}
    .label{position:absolute;font:600 22px "Fredoka Variable";color:#0e2f4a;text-align:center;width:200px}
  </style></head><body><div class="wrap"><div class="copy"><div class="kicker">${kicker}</div><h1>${title}</h1><p>${sub}</p></div><div class="scene">${scene}</div></div></body></html>`;
}

const desktopApps = `
  <div class="app" style="left:40px;top:40px;width:640px;height:420px;padding:36px"><div class="bar" style="width:55%"></div><div class="bar"></div><div class="bar" style="width:80%"></div><div class="bar" style="width:66%"></div></div>
  <div class="app" style="left:260px;top:330px;width:560px;height:330px;padding:36px;background:#2a3d52"><div class="bar" style="width:40%"></div><div class="bar" style="width:90%"></div><div class="bar" style="width:70%"></div></div>`;

const outfits = ["partyhat", "bowtie", "sunglasses", "headphones", "crown"];
const outfitNames = ["Party hat", "Bow tie", "Sunglasses", "Headphones", "Crown"];

const scenes = {
  "1-meet-tumbli": page(
    "Meet Tumbli",
    "A tumbler, just like yours",
    "Tumbli lives on your screen, fills up as you drink, and nudges you when it's time for water.",
    appWindow(`${DEV}/settings.html?fresh`),
  ),
  "2-reminder": page(
    "Gentle reminders",
    "Time for a sip? Tumbli will tell you",
    "It hops up with a friendly nudge, stays quiet while you're away, and hides during games and videos.",
    `<div class="desktop">${desktopApps}</div>` +
      frame(`${DEV}/widget.html?demo&tumbler&nudge`, { w: 350, h: 240, scale: 2, style: "left:300px;top:390px" }),
    { dark: true },
  ),
  "3-your-plan": page(
    "Made for you",
    "A daily goal that fits your body",
    "A 30-second check-in looks at your age, activity and weather. Track by the glass or by your own tumbler.",
    appWindow(`${DEV}/settings.html?fresh&tumbler&step=result`),
  ),
  "4-progress": page(
    "Your week",
    "Watch your streak grow",
    "See today at a glance, your week in a chart, and a recap every Monday.",
    appWindow(`${DEV}/settings.html?demo&tumbler`),
  ),
  "5-outfits": page(
    "Achievements",
    "Keep your streak, dress up Tumbli",
    "Party hats, sunglasses, a crown: every milestone unlocks something new for your water buddy.",
    outfits
      .map(
        (o, i) =>
          frame(`${DEV}/widget.html?demo&outfit=${o}`, {
            w: 76,
            h: 140,
            scale: 2.3,
            style: `left:${30 + i * 205}px;top:${i % 2 ? 380 : 300}px`,
          }) + `<div class="label" style="left:${i * 205}px;top:${i % 2 ? 720 : 640}px">${outfitNames[i]}</div>`,
      )
      .join(""),
  ),
};

for (const [name, html] of Object.entries(scenes)) {
  writeFileSync(join(srcDir, `${name}.html`), html);
  const out = join(outDir, `${name}.png`);
  rmSync(out, { force: true });
  const profile = mkdtempSync(join(tmpdir(), "tumbli-shots-")); // fresh storage per scene
  execFileSync(EDGE, [
    "--headless=new",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--hide-scrollbars",
    "--blink-settings=preferredColorScheme=1",
    "--force-device-scale-factor=1",
    "--virtual-time-budget=3500",
    "--window-size=1920,1080",
    `--screenshot=${out}`,
    `${DEV}/store-assets/screenshots/src/${name}.html`,
  ]);
  const t0 = Date.now();
  while (!existsSync(out) && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 200));
  if (!existsSync(out)) throw new Error(`Edge did not write ${out}`);
  console.log("wrote", out);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
  } catch {
    // Edge may still hold it; it's in the temp folder
  }
}
