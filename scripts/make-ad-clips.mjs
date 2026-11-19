// Records Tumbli's REAL animations as portrait video clips (1080x1920, 30 fps) for ads.
//
// Each clip loads the real widget page from the dev server (with the browser mocks in
// src/dev/mocks.ts), steps its clock one frame at a time (virtual time, so every frame
// is smooth no matter how slow the machine is), moves a drawn mouse pointer to hover and
// click like a person would, and puts the frames on a background with ffmpeg:
//   *-desk.mp4   Tumbli docked on a dark desktop above the taskbar
//   *-green.mp4  Tumbli on a green screen, to key over other footage
//
// Usage:  npm run dev                (in another terminal; serves http://localhost:1420)
//         npm run ad-clips           -> store-assets/ad/clips/*.mp4
//         npm run ad-clips -- drink  (only the clips whose name contains "drink")
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import ffmpeg from "ffmpeg-static";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "store-assets", "ad", "clips");
const DEV = "http://localhost:1420";
const FPS = 30;
const OUT = { w: 1080, h: 1920 };
const SCALE = 3; // the widget's 350x240 window, drawn 3x
const WIN = { w: 350, h: 240 }; // the real widget window (see src/widget/windowing.ts)
const TASKBAR = 48 * SCALE;
// where the widget window sits in the video: docked right, above the taskbar
const AT = { x: OUT.w - WIN.w * SCALE - 6, y: OUT.h - TASKBAR - WIN.h * SCALE - 150 };

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!EDGE) throw new Error("Microsoft Edge not found");
const res = await fetch(`${DEV}/widget.html`).catch(() => null);
if (!res?.ok) throw new Error(`The dev server isn't running at ${DEV}. Start it with: npm run dev`);

// Tumbli's spot inside the 350x240 window (it hugs the bottom-right corner)
const TUMBLI = { x: 312, y: 150 };

/**
 * The clips. `steps` move the pointer (to x/y in window px, or to an element) and can click.
 * `t` is when a step starts (s), `dur` how long the move takes; `leave` means the pointer
 * has left Tumbli's window by the end of the move.
 */
const CLIPS = [
  { name: "01-idle", query: "demo&tumbler", seconds: 5 },
  {
    name: "02-hover",
    query: "demo&tumbler",
    seconds: 4,
    steps: [
      { t: 0.3, from: { x: 120, y: 60 } },
      { t: 0.5, to: TUMBLI, dur: 0.8 },
      { t: 2.4, to: { x: 268, y: 168 }, dur: 0.6 }, // toward the buttons
    ],
  },
  {
    name: "03-drink",
    query: "demo&tumbler",
    seconds: 5,
    steps: [
      { t: 0.2, from: { x: 120, y: 60 } },
      { t: 0.4, to: TUMBLI, dur: 0.7 },
      { t: 1.4, to: { sel: ".mini.plus" }, dur: 0.5, click: true },
      { t: 3.2, to: { x: 150, y: 40 }, dur: 0.8, leave: true }, // move away, buttons go
    ],
  },
  { name: "04-reminder", query: "demo&tumbler&nudge", seconds: 6 },
  {
    name: "05-goal",
    query: "demo&today=1750", // glass mode: 7 of 8 glasses, the last one reaches the goal
    seconds: 7,
    steps: [
      { t: 0.2, from: { x: 120, y: 60 } },
      { t: 0.4, to: TUMBLI, dur: 0.7 },
      { t: 1.4, to: { sel: ".mini.plus" }, dur: 0.5, click: true },
      { t: 2.6, to: { x: 140, y: 40 }, dur: 0.8, leave: true },
    ],
  },
  {
    name: "06-fact",
    query: "demo&tumbler",
    seconds: 6,
    steps: [
      { t: 0.2, from: { x: 120, y: 60 } },
      { t: 0.4, to: { x: 312, y: 170 }, dur: 0.7, click: true },
      { t: 1.8, to: { x: 120, y: 40 }, dur: 0.8, leave: true },
    ],
  },
  {
    name: "07-outfits",
    seconds: 1.5, // per outfit
    parts: ["partyhat", "bowtie", "sunglasses", "headphones", "crown"].map((o) => `demo&tumbler&outfit=${o}`),
  },
];

// ------------------------------------------------------------------ backgrounds

const desk = `<!doctype html><html><body style="margin:0;width:${OUT.w}px;height:${OUT.h}px;overflow:hidden;position:relative;
  background:radial-gradient(70% 45% at 75% 30%,rgba(76,155,224,.35),transparent 70%),
             radial-gradient(80% 50% at 10% 85%,rgba(32,164,127,.25),transparent 70%),
             linear-gradient(160deg,#123150 0%,#0d2238 50%,#081626 100%);font-family:'Segoe UI',sans-serif">
  <div style="position:absolute;left:60px;top:220px;width:760px;height:620px;border-radius:24px;background:#1f242b;opacity:.92;
    box-shadow:0 40px 90px -30px rgba(0,0,0,.7),0 0 0 2px rgba(255,255,255,.08)">
    <div style="height:84px;border-bottom:2px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:20px;padding:0 36px;color:#dce3ea;font-size:30px">
      <span style="width:34px;height:34px;border-radius:9px;background:#7d4bd6"></span>Notes</div>
    <div style="padding:46px 56px;color:#dce3ea">
      <div style="font-size:52px;font-weight:600;margin-bottom:24px">Product launch: week 3</div>
      ${[90, 100, 70, 85, 60].map((w) => `<div style="height:22px;width:${w}%;border-radius:11px;background:rgba(255,255,255,.1);margin:26px 0"></div>`).join("")}
    </div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:${TASKBAR}px;background:rgba(28,32,38,.95);border-top:2px solid rgba(255,255,255,.08);
    display:flex;align-items:center;justify-content:center;gap:30px">
    ${["#F5A623", "#1B8FD8", "#3A5BD9", "#7D4BD6", "#E5534B"].map((c) => `<span style="width:72px;height:72px;border-radius:18px;background:${c}"></span>`).join("")}
    <img src="${DEV}/app-icon.svg" width="72" height="72">
  </div>
</body></html>`;
const green = `<!doctype html><html><body style="margin:0;width:${OUT.w}px;height:${OUT.h}px;background:#00ff00"></body></html>`;

// ---------------------------------------------------------------------- record

const POINTER = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.4 L10.1 13 L16 13 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

async function recordPart(browser, query, seconds, steps, framesDir, startIndex) {
  const ctx = await browser.createBrowserContext(); // fresh storage per part
  const page = await ctx.newPage();
  await page.setViewport({ width: WIN.w, height: WIN.h, deviceScaleFactor: SCALE });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await page.goto(`${DEV}/widget.html?ad&${query}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1500)); // let the entrance settle

  // a pointer people can see (headless screenshots have none)
  await page.evaluate((svg) => {
    const p = document.createElement("div");
    p.id = "ad-pointer";
    p.innerHTML = svg; // our own constant SVG above, no outside input
    Object.assign(p.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", opacity: "0", transition: "opacity .2s" });
    document.body.appendChild(p);
    addEventListener("mousemove", (e) => {
      p.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`;
      p.style.opacity = "1";
    }, true);
  }, POINTER);

  await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
  const advance = () =>
    new Promise((resolveStep) => {
      cdp.once("Emulation.virtualTimeBudgetExpired", resolveStep);
      void cdp.send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: 1000 / FPS });
    });

  let cur = null;
  const pending = (steps ?? []).map((s) => ({ ...s }));
  const frames = Math.round(seconds * FPS);
  for (let f = 0; f < frames; f++) {
    const now = f / FPS;
    for (const s of pending) {
      if (s.done || now < s.t) continue;
      if (s.from) {
        cur = s.from;
        await page.mouse.move(cur.x, cur.y);
        s.done = true;
        continue;
      }
      if (!s.start) {
        s.start = cur ?? { x: 120, y: 60 };
        if (s.to.sel) {
          const box = await page.$eval(s.to.sel, (el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          });
          s.end = box;
        } else s.end = s.to;
      }
      const p = Math.min(1, (now - s.t) / s.dur);
      const k = ease(p);
      cur = { x: s.start.x + (s.end.x - s.start.x) * k, y: s.start.y + (s.end.y - s.start.y) * k };
      await page.mouse.move(cur.x, cur.y);
      if (p >= 1) {
        if (s.click) {
          await page.mouse.down();
          await page.mouse.up();
        }
        if (s.leave) {
          // In the real app the pointer leaves Tumbli's window region here; in the
          // browser the whole 350x240 page is "the window", so say so ourselves.
          await page.evaluate(() =>
            document.querySelector(".widget")?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: null })),
          );
        }
        s.done = true;
      }
    }
    await advance();
    await page.screenshot({
      path: join(framesDir, `${String(startIndex + f).padStart(5, "0")}.png`),
      omitBackground: true,
    });
  }
  await ctx.close();
  return frames;
}

async function backgroundPng(browser, html, file) {
  const page = await browser.newPage();
  await page.setViewport({ width: OUT.w, height: OUT.h, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: file });
  await page.close();
}

const only = process.argv[2];
mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "tumbli-ad-"));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--hide-scrollbars"] });
try {
  const bgDesk = join(work, "desk.png");
  const bgGreen = join(work, "green.png");
  await backgroundPng(browser, desk, bgDesk);
  await backgroundPng(browser, green, bgGreen);
  writeFileSync(join(outDir, ".gitkeep"), "");

  for (const clip of CLIPS) {
    if (only && !clip.name.includes(only)) continue;
    const framesDir = join(work, clip.name);
    mkdirSync(framesDir, { recursive: true });
    let n = 0;
    for (const q of clip.parts ?? [clip.query]) n += await recordPart(browser, q, clip.seconds, clip.steps, framesDir, n);

    for (const [kind, bg] of [["desk", bgDesk], ["green", bgGreen]]) {
      const out = join(outDir, `${clip.name}-${kind}.mp4`);
      execFileSync(ffmpeg, [
        "-y", "-loglevel", "error",
        "-loop", "1", "-framerate", String(FPS), "-i", bg,
        "-framerate", String(FPS), "-i", join(framesDir, "%05d.png"),
        "-filter_complex", `[0][1]overlay=${AT.x}:${AT.y}:shortest=1,format=yuv420p`,
        "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-r", String(FPS), "-movflags", "+faststart",
        out,
      ]);
      console.log("wrote", out);
    }
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true, maxRetries: 3 });
}
