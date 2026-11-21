// Edits the portrait teaser for Tumbli 0.1.4 (1080x1920, 30 fps), only from the real app:
//   - Tumbli's widget and Settings window, recorded frame by frame from the dev server
//     (virtual time, a drawn pointer that moves and clicks like a person)
//   - store-assets/teaser/source/voice over.mp3 (ElevenLabs), cut into its phrases and
//     each one placed on the shot it talks about
//   - original music and sound effects (scripts/ad/synth.mjs), feature titles, an intro
//     and an end card announcing the update date
//
// Usage:  npm run dev                 (in another terminal; serves http://localhost:1420)
//         node scripts/make-teaser.mjs [--skip-clips | --only=s-ach,w-peek]   -> store-assets/teaser/Tumbli-teaser.mp4
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import ffmpeg from "ffmpeg-static";
import { music, sfx } from "./ad/synth.mjs";
import { taskbarHtml } from "./ad/taskbar.mjs";
import { wordmark } from "./ad/wordmark.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEASER = join(root, "store-assets", "teaser");
const SRC = join(TEASER, "source");
const BUILD = join(TEASER, ".build");
const CLIPS = join(BUILD, "clips");
const WEB = join(BUILD, "web"); // served by the dev server, for the browser-made graphics
const WEB_URL = "/store-assets/teaser/.build/web";
const OUT = join(TEASER, "Tumbli-teaser.mp4");
const DEV = "http://localhost:1420";
const FPS = 30;
const W = 1080;
const H = 1920;
const SCREEN = { x: 36, y: 64, w: 1008, h: 1792, r: 30 }; // the laptop screen, as in the first ad
const BPM = 118.5;
const NAME = "Ana";

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!EDGE) throw new Error("Microsoft Edge not found");
if (!(await fetch(`${DEV}/widget.html`).catch(() => null))?.ok) throw new Error("Start the dev server first: npm run dev");
if (!existsSync(join(SRC, "voice over.mp3"))) throw new Error(`Missing ${join(SRC, "voice over.mp3")}`);

// ------------------------------------------------------------------ voice-over
// Phrases of "voice over.mp3" (found at its pauses): [from, to] in the file, `at` = when
// they start in the video. The pauses are tightened a little.
const VO = [
  { from: 0.0, to: 2.29, at: 0.45 }, //  "Introducing... the new Tumbli!"
  { from: 2.74, to: 4.02, at: 3.0 }, //  "So, what's new?"
  { from: 4.58, to: 10.5, at: 4.75 }, // "Auto reminders pace your water breaks on busy days... so you still hit your goal before the day ends."
  { from: 11.04, to: 16.34, at: 11.05 }, // "Medicine reminders, on the days you need them, with a two-week log, so you never lose track."
  { from: 17.03, to: 18.33, at: 16.95 }, // "Need more screen space?"
  { from: 18.7, to: 20.42, at: 18.4 }, // "Tuck Tumbli into the edge."
  { from: 20.66, to: 22.03, at: 20.25 }, // "It stays out of your way..."
  { from: 22.26, to: 24.24, at: 21.75 }, // "and pops out when it's time to drink."
  { from: 25.09, to: 25.99, at: 24.25 }, // "Back from a break?"
  { from: 26.27, to: 28.14, at: 25.3 }, // "Log what you had while you were away."
  { from: 28.71, to: 32.44, at: 27.75 }, // "Plus, a smarter setup that suggests the right amount for you..."
  { from: 32.73, to: 36.08, at: 31.6 }, // "and a cleaner Settings, with more room for what matters."
  { from: 36.65, to: 39.77, at: 35.45 }, // "Get the new Tumbli update on November twenty-third."
  { from: 40.1, to: 41.17, at: 38.75 }, // "Stay hydrated!"
];
const LENGTH = 41.6;

// ------------------------------------------------------------------ clips to record
// Widget clips: the real 350x240 window drawn 3x on an empty desktop.
// Settings clips: the Settings window (440x720) drawn 1.8x in a window frame on the desktop.
const WIN = { w: 350, h: 240, scale: 3 };
const SET = { w: 440, h: 720, scale: 1.6 };
const TASKBAR = 96;
const WIDGET_AT = { x: W - WIN.w * WIN.scale - 6, y: H - TASKBAR - WIN.h * WIN.scale - 150 };
const SET_AT = { x: (W - SET.w * SET.scale) / 2, y: 440 }; // where the page goes; the title bar sits above it
const TUMBLI = { x: 312, y: 150 }; // Tumbli inside the widget window

const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const hhmm = (minFromNow) => {
  const d = new Date(Date.now() + minFromNow * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const MEDS = [
  { id: "vd", name: "Vitamin D", times: ["08:00"], note: "after breakfast", on: true, since: day(-20) },
  { id: "mf", name: "Metformin", times: ["08:00", "20:00"], note: "", on: true, since: day(-20), days: [1, 2, 3, 4, 5] },
];
/** two weeks of mostly-taken doses for the log calendar */
function medLog() {
  const log = {};
  for (let n = 1; n <= 15; n++) {
    const d = new Date(Date.now() - n * 86_400_000);
    const k = day(-n);
    log[k] = { "vd@08:00": n % 6 === 0 ? "missed" : "taken" };
    if (d.getDay() >= 1 && d.getDay() <= 5) {
      log[k]["mf@08:00"] = n % 5 === 0 ? "skipped" : "taken";
      log[k]["mf@20:00"] = n % 4 === 0 ? "missed" : "taken";
    }
  }
  return log;
}
const set = (k, v) => ({ k, v: typeof v === "string" ? v : JSON.stringify(v) });
const CALM = [set("tumbli.recheck", "done"), set("tumbli.seenVersion", "0.1.4"), set("tumbli.medLogClosed", day(-1))];

const CLIP_LIST = [
  // widget
  { name: "w-update", kind: "widget", query: "demo&ad&whatsnew", seconds: 2.6 },
  { name: "w-nudge", kind: "widget", query: "demo&ad&nudge", seconds: 3.6 },
  {
    name: "w-med",
    kind: "widget",
    query: "demo&ad&med=Vitamin%20D",
    seconds: 2.9,
    steps: [
      { t: 0.1, from: { x: 120, y: 30 } },
      { t: 0.5, to: { sel: ".med-card .btn.primary" }, dur: 0.6, click: true },
      { t: 1.5, to: { x: 140, y: 30 }, dur: 0.6, leave: true },
    ],
  },
  {
    name: "w-peek",
    kind: "widget",
    flush: true, // the window's right side on the screen edge, so the clipped half is "past the edge"
    query: "demo&ad",
    seconds: 7.4,
    steps: [
      { t: 0.1, from: { x: 150, y: 40 } },
      // grab Tumbli (no hover buttons while "dragging")
      { t: 0.15, run: (p) => p.evaluate(() => (document.querySelector(".widget").style.pointerEvents = "none")) },
      { t: 0.2, to: { x: 312, y: 140 }, dur: 0.8 },
      {
        t: 1.15,
        run: (p) =>
          p.evaluate(() => {
            const w = document.querySelector(".widget");
            w.style.transition = "transform .6s cubic-bezier(.3,1,.4,1)";
            w.style.transform = "translateX(40px)";
            const t = document.querySelector(".buddy .tumbler");
            t.style.transition = "transform .5s cubic-bezier(.3,1.4,.5,1) .35s";
            t.style.transform = "rotate(-9deg)";
          }),
      },
      { t: 1.15, to: { x: 352, y: 142 }, dur: 0.6 },
      { t: 2.0, to: { x: 160, y: 60 }, dur: 0.7, leave: true },
      // a reminder: out it pops
      {
        t: 4.9,
        run: (p) =>
          p.evaluate(() => {
            const w = document.querySelector(".widget");
            w.style.transition = "transform .3s cubic-bezier(.2,1.4,.4,1)";
            w.style.transform = "none";
            document.querySelector(".buddy .tumbler").style.transform = "none";
            window.tumbliDev?.nudge();
          }),
      },
    ],
  },
  {
    name: "w-away",
    kind: "widget",
    query: "demo&ad&away=118",
    seed: [...CALM, set("tumbli.meds", [{ id: "vd", name: "Vitamin D", times: [hhmm(-70)], note: "", on: true, since: day(-20) }])],
    seconds: 3.6,
    steps: [
      { t: 0.1, from: { x: 60, y: 30 } },
      { t: 0.3, to: { sel: "[aria-label='Water while away'] button:nth-child(3)" }, dur: 0.5, click: true },
      { t: 1.0, to: { sel: "[aria-label^='Vitamin D'] button" }, dur: 0.45, click: true }, // Taken
      { t: 1.6, to: { sel: ".welcome-card .btn.primary" }, dur: 0.45, click: true },
      { t: 2.4, to: { x: 140, y: 30 }, dur: 0.6, leave: true },
    ],
  },
  // settings
  {
    name: "s-auto",
    kind: "settings",
    query: "demo&ad",
    seed: [...CALM, set("tumbli.meds", MEDS), set("tumbli.nextReminderAt", String(Date.now() + 13 * 60_000))],
    prep: async (p) => {
      await scrollToSel(p, ".row.stack:has(.chips)", 150);
    },
    seconds: 3.4,
    steps: [
      { t: 0.1, from: { x: 330, y: 560 } },
      { t: 0.3, to: { sel: ".chips button:first-child" }, dur: 0.7, click: true },
      { t: 1.7, to: { x: 300, y: 420 }, dur: 0.9 },
    ],
  },
  {
    name: "s-medform",
    kind: "settings",
    query: "demo&ad",
    seed: [...CALM, set("tumbli.meds", MEDS), set("tumbli.medLog", medLog())],
    prep: async (p) => {
      await clickText(p, "Add another");
      await p.type("section.meds input[placeholder='e.g. Vitamin D']", "Iron");
      await clickText(p, "Every day");
      for (const d of ["Monday", "Wednesday", "Friday"]) await p.click(`button[aria-label='${d}']`);
      await scrollToSel(p, ".med-form", 120);
    },
    seconds: 3.3,
    steps: [
      { t: 0.1, from: { x: 330, y: 650 } },
      { t: 0.2, to: { sel: ".med-time .picker-btn" }, dur: 0.55, click: true },
      { t: 1.0, dur: 0.75, scroll: { sel: ".wheel:nth-of-type(1)", to: 34 * 8 } }, // 9 o'clock
      { t: 1.15, dur: 0.85, scroll: { sel: ".wheel:nth-of-type(2)", to: 34 * 30 } }, // :30
      { t: 2.3, to: { sel: ".tp-done" }, dur: 0.45, click: true },
    ],
  },
  {
    name: "s-logs",
    kind: "settings",
    query: "demo&ad",
    seed: [...CALM, set("tumbli.meds", MEDS), set("tumbli.medLog", medLog())],
    prep: async (p) => {
      await scrollToSel(p, "section.meds", 60);
      await clickText(p, "View logs");
      await new Promise((r) => setTimeout(r, 400));
    },
    seconds: 2.6,
    steps: [
      { t: 0.1, from: { x: 380, y: 680 } },
      { t: 0.3, to: { sel: ".cal button:nth-of-type(6)" }, dur: 0.6, click: true },
      { t: 1.4, to: { sel: ".cal button:nth-of-type(10)" }, dur: 0.5, click: true },
    ],
  },
  {
    name: "s-plan",
    kind: "settings",
    query: "fresh&tumbler&step=result",
    seconds: 3.9,
    steps: [
      { t: 0.1, from: { x: 330, y: 680 } },
      { t: 0.4, to: { sel: ".plan-hero .plan-total b" }, dur: 0.8 },
      { t: 1.9, to: { sel: ".plan-settings .seg-switch button:first-child" }, dur: 0.6, click: true },
    ],
  },
  {
    name: "s-ach",
    kind: "settings",
    query: "demo",
    seed: [...CALM, set("tumbli.achievementsOpen", "1"), set("tumbli.meds", MEDS)],
    prep: async (p) => {
      await scrollToSel(p, "section.ach-card", 8); // the whole open list fits in the window
    },
    seconds: 3.6,
    steps: [
      { t: 0.1, from: { x: 330, y: 300 } },
      { t: 0.6, to: { sel: ".ach-toggle" }, dur: 0.7, click: true }, // fold it: everything below moves up
      { t: 2.0, to: { x: 300, y: 250 }, dur: 0.8 },
    ],
  },
];

async function scrollToSel(page, sel, offset) {
  await page.evaluate(
    (sel, offset) => {
      const el = document.querySelector(sel);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset);
    },
    sel,
    offset,
  );
}
async function clickText(page, text) {
  const [b] = await page.$$(`xpath/.//button[contains(normalize-space(), '${text}')]`);
  if (!b) throw new Error(`no button "${text}"`);
  await b.evaluate((x) => x.scrollIntoView({ block: "center" }));
  await b.click();
  await new Promise((r) => setTimeout(r, 200));
}

// ------------------------------------------------------------------ the cut
// zoom: [[t, z], ...] for widget shots, toward Tumbli's corner (1 = the whole screen);
// settings shots get a slow push-in on their own.
const SHOTS = [
  { start: 0, kind: "intro", tr: ["fade", 0.3] },
  { start: 2.75, kind: "clip", clip: "w-update", zoom: [[0, 1.03], [1.7, 1.1]], tr: ["slideleft", 0.3] },
  { start: 4.5, kind: "clip", clip: "s-auto", focus: [0.5, 0.4], zoom: [[0, 1.12], [1.2, 1.5], [3.6, 1.55]], tr: ["fade", 0.25] },
  { start: 7.85, kind: "clip", clip: "w-nudge", zoom: [[0, 1.03], [3, 1.12]], tr: ["slideleft", 0.3] },
  { start: 10.85, kind: "clip", clip: "s-medform", focus: [0.47, 0.47], zoom: [[0, 1.3], [1.0, 1.55], [2.7, 1.6]], tr: ["fade", 0.25] },
  { start: 13.25, kind: "clip", clip: "w-med", from: 0.2, zoom: [[0, 1.04], [2.2, 1.1]], tr: ["fade", 0.25] },
  { start: 14.95, kind: "clip", clip: "s-logs", from: 0.2, focus: [0.5, 0.5], zoom: [[0, 1.2], [2.1, 1.4]], tr: ["smoothup", 0.3] },
  { start: 16.75, kind: "clip", clip: "w-peek", zoom: [[0, 1.15], [0.9, 1.2], [1.9, 1.75], [4.6, 1.85], [5.1, 1.06], [7.6, 1.1]], tr: ["slideleft", 0.3] },
  { start: 24.1, kind: "clip", clip: "w-away", zoom: [[0, 1.04], [3.2, 1.1]], tr: ["fade", 0.25] },
  { start: 27.55, kind: "clip", clip: "s-plan", focus: [0.5, 0.47], zoom: [[0, 1.15], [1.6, 1.45], [4.1, 1.4]], tr: ["fade", 0.25] },
  { start: 31.4, kind: "clip", clip: "s-ach", focus: [0.5, 0.48], zoom: [[0, 1.15], [1.2, 1.2], [2.4, 1.32], [4.2, 1.35]], tr: ["fadeblack", 0.4] },
  { start: 35.2, kind: "endcard" },
];
SHOTS.forEach((s, i) => (s.end = SHOTS[i + 1]?.start ?? LENGTH));

// titles: [png, from, to]
const TITLES = [
  ["t-whatsnew", 3.0, 4.45],
  ["t-auto", 4.75, 10.75],
  ["t-meds", 11.05, 16.6],
  ["t-peek", 16.95, 24.0],
  ["t-back", 24.25, 27.45],
  ["t-setup", 27.75, 31.3],
  ["t-clean", 31.6, 35.1],
];

// sound effects: [name, time, gain]
const SFX = [
  ["sparkle", 0.5, 0.35],
  ["boing", 0.95, 0.45],
  ["pop", 1.75, 0.35],
  ["whoosh", 2.62, 0.5],
  ["bloop", 2.95, 0.45],
  ["pop", 3.05, 0.3],
  ["whoosh", 4.35, 0.55],
  ["pop", 4.8, 0.35],
  ["click", 5.5, 0.7],
  ["whoosh", 7.7, 0.45],
  ["bloop", 8.15, 0.5],
  ["whoosh", 10.7, 0.55],
  ["pop", 11.1, 0.35],
  ["click", 11.6, 0.7],
  ["click", 13.0, 0.6],
  ["bloop", 13.35, 0.45],
  ["click", 14.1, 0.7],
  ["sparkle", 14.25, 0.3],
  ["whoosh", 14.8, 0.45],
  ["click", 15.5, 0.6],
  ["whoosh", 16.6, 0.55],
  ["pop", 17.0, 0.35],
  ["whoosh", 17.95, 0.5], // tucked into the edge
  ["thud", 18.45, 0.35],
  ["boing", 21.7, 0.5], // pops out
  ["bloop", 21.85, 0.45],
  ["whoosh", 23.95, 0.55],
  ["pop", 24.3, 0.35],
  ["click", 24.95, 0.6],
  ["click", 25.65, 0.6],
  ["click", 26.25, 0.7],
  ["gulp", 26.4, 0.5],
  ["whoosh", 27.4, 0.5],
  ["pop", 27.8, 0.35],
  ["click", 30.05, 0.6],
  ["sparkle", 30.15, 0.3],
  ["whoosh", 31.25, 0.5],
  ["pop", 31.65, 0.35],
  ["click", 33.35, 0.6],
  ["whoosh", 35.05, 0.6],
  ["boing", 35.4, 0.5],
  ["sparkle", 36.4, 0.4],
  ["pop", 37.1, 0.35],
  ["sparkle", 38.8, 0.35],
];

// ------------------------------------------------------------------ graphics

const FONTS = `<link rel="stylesheet" href="/node_modules/@fontsource-variable/fredoka/index.css">
<link rel="stylesheet" href="/node_modules/@fontsource-variable/nunito/index.css">`;

/** a feature title: a numbered tag, big rounded words, the reason under them */
const title = (num, html, sub) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html,body{margin:0;background:transparent}
  .t{width:${SCREEN.w}px;height:300px;background:linear-gradient(rgba(7,19,31,.92),rgba(7,19,31,.75) 62%,rgba(7,19,31,0));display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
     font-family:"Fredoka Variable",sans-serif;color:#fff}
  .num{font:800 30px "Nunito Variable",sans-serif;letter-spacing:6px;color:#0b1f33;background:#7fd0ff;border-radius:999px;padding:8px 22px 8px 28px;
       box-shadow:0 8px 24px rgba(58,163,240,.45)}
  h1{margin:14px 0 0;font-weight:600;font-size:92px;line-height:1.02;letter-spacing:-1px;
     text-shadow:0 4px 0 rgba(8,22,38,.55),0 10px 40px rgba(0,0,0,.55)}
  em{font-style:normal;color:#7fd0ff}
  .sub{margin-top:10px;font:700 40px "Nunito Variable",sans-serif;color:#d9efff;text-shadow:0 3px 18px rgba(0,0,0,.6)}
</style></head><body><div class="t">${num ? `<div class="num">${num}</div>` : ""}<h1>${html}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div></body></html>`;

const TITLE_HTML = {
  "t-whatsnew": title("", "So, what's <em>new?</em>", ""),
  "t-auto": title("01", "<em>Auto</em> reminders", "Never fall behind on busy days"),
  "t-meds": title("02", "<em>Medicine</em> reminders", "On your days · a 2-week log"),
  "t-peek": title("03", "<em>Peek</em> mode", "More room on your screen"),
  "t-back": title("04", "Welcome <em>back</em>", "Catch up in one tap"),
  "t-setup": title("05", "A <em>smarter</em> setup", "The right amount, for you"),
  "t-clean": title("06", "A <em>cleaner</em> Settings", "More room for what matters"),
};

/** the laptop bezel, with a see-through screen (as in the first ad) */
const bezel = `<!doctype html><html><head><style>
  html,body{margin:0;background:transparent;width:${W}px;height:${H}px;overflow:hidden}
  .hole{position:absolute;left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.w}px;height:${SCREEN.h}px;border-radius:${SCREEN.r}px;
        box-shadow:0 0 0 400px #0a0d12, inset 0 0 0 2px rgba(255,255,255,.06), inset 0 0 40px rgba(0,0,0,.35)}
  .glare{position:absolute;left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.w}px;height:${SCREEN.h}px;border-radius:${SCREEN.r}px;
        background:linear-gradient(125deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 32%)}
  .edge{position:absolute;inset:0;box-shadow:inset 0 0 0 3px #1a1f27}
  .cam{position:absolute;left:${W / 2 - 9}px;top:23px;width:18px;height:18px;border-radius:50%;
       background:radial-gradient(circle at 35% 35%,#3a4656,#11161d 60%);box-shadow:0 0 0 3px #151a21}
  .led{position:absolute;left:${W / 2 + 22}px;top:30px;width:5px;height:5px;border-radius:50%;background:#2fd17a;box-shadow:0 0 6px #2fd17a}
</style></head><body><div class="hole"></div><div class="glare"></div><div class="edge"></div><div class="cam"></div><div class="led"></div></body></html>`;

const SKY = `radial-gradient(60% 40% at 50% 38%,rgba(58,163,240,.45),transparent 70%),
  radial-gradient(80% 50% at 20% 100%,rgba(32,164,127,.22),transparent 70%),
  linear-gradient(170deg,#123150 0%,#0b1f33 55%,#07131f 100%)`;
const sparks = (list, base) =>
  list.map(([x, y, d]) => `<i class="spark" style="left:${x}px;top:${y}px;animation-delay:${base + d}s"></i>`).join("");
const SPARK_CSS = `.spark{position:absolute;width:16px;height:16px;opacity:0}
  .spark::before,.spark::after{content:"";position:absolute;left:7px;top:0;width:2px;height:16px;border-radius:2px;background:#ffd66b}
  .spark::after{transform:rotate(90deg)}
  .go .spark{animation:twinkle 1.4s ease-in-out infinite}
  @keyframes twinkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1.2) rotate(45deg)}}
  .waves{position:absolute;left:-10%;right:-10%;bottom:-20px;height:260px;fill:rgba(58,163,240,.18)}
  .go .waves{animation:sway 4s ease-in-out infinite}
  @keyframes sway{50%{transform:translateX(40px)}}`;
const WAVES = `<svg class="waves" viewBox="0 0 1200 260" preserveAspectRatio="none"><path d="M0 90 C200 40 400 140 600 90 S1000 40 1200 90 V260 H0Z"/><path d="M0 150 C220 110 420 200 640 150 S1020 110 1200 150 V260 H0Z" opacity=".7"/></svg>`;

const INTRO_WM = wordmark({ size: 170, animate: true, delay: 0.5 });
/** the intro: "Introducing" and the logo burst in, then a NEW · v0.1.4 tag */
const intro = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html,body{margin:0;width:${SCREEN.w}px;height:${SCREEN.h}px;overflow:hidden}
  body{background:${SKY};font-family:"Fredoka Variable",sans-serif;color:#fff;position:relative}
  ${SPARK_CSS}
  .stack{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:140px}
  .kick{font:800 40px "Nunito Variable",sans-serif;letter-spacing:10px;text-transform:uppercase;color:#a9d8ff;opacity:0;transform:translateY(30px)}
  .go .kick{animation:up .5s cubic-bezier(.2,1.4,.4,1) .05s forwards}
  @keyframes up{to{opacity:1;transform:none}}
  .ring{position:absolute;left:50%;top:41%;width:20px;height:20px;margin:-10px;border-radius:50%;border:6px solid rgba(127,208,255,.7);opacity:0}
  .go .ring{animation:ring 1s ease-out .35s forwards}
  @keyframes ring{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(40)}}
  .icon{margin-top:40px;width:360px;height:360px;filter:drop-shadow(0 30px 50px rgba(0,0,0,.45));opacity:0;transform:scale(.2) rotate(-14deg)}
  .go .icon{animation:pop .8s cubic-bezier(.2,1.6,.4,1) .3s forwards, float 2.6s ease-in-out 1.2s infinite}
  @keyframes pop{to{opacity:1;transform:scale(1) rotate(0)}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
  .name{margin-top:26px;position:relative}
  ${INTRO_WM.css}
  .new{position:absolute;right:-70px;top:-26px;font:800 34px "Nunito Variable",sans-serif;letter-spacing:3px;color:#0b1f33;background:#ffd66b;
       border-radius:16px;padding:8px 16px;transform:rotate(12deg) scale(0);box-shadow:0 10px 26px rgba(255,214,107,.45)}
  .go .new{animation:badge .45s cubic-bezier(.2,1.8,.4,1) 1.25s forwards}
  @keyframes badge{to{transform:rotate(12deg) scale(1)}}
  .ver{margin-top:30px;font:700 40px "Nunito Variable",sans-serif;color:#a9c3d8;opacity:0}
  .go .ver{animation:fade .5s ease-out 1.45s forwards}
  @keyframes fade{to{opacity:1}}
  .ver b{color:#fff;background:rgba(127,208,255,.18);border:2px solid rgba(127,208,255,.5);border-radius:999px;padding:4px 18px;margin-left:8px}
</style></head><body>
  ${WAVES}
  <div class="ring"></div>
  ${sparks([[150, 420, 0], [840, 470, 0.3], [210, 1000, 0.6], [800, 980, 0.15], [500, 280, 0.9]], 0.6)}
  <div class="stack">
    <div class="kick">Introducing</div>
    <img class="icon" src="/app-icon.svg">
    <div class="name">${INTRO_WM.html}<span class="new">NEW</span></div>
    <div class="ver">the new Tumbli <b>v0.1.4</b></div>
  </div>
</body></html>`;

const END_WM = wordmark({ size: 150, animate: true, delay: 0.25 });
/** the end card: get the new Tumbli update on November 23 */
const endcard = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html,body{margin:0;width:${SCREEN.w}px;height:${SCREEN.h}px;overflow:hidden}
  body{background:${SKY};font-family:"Fredoka Variable",sans-serif;color:#fff;position:relative}
  ${SPARK_CSS}
  .stack{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:150px}
  .icon{width:300px;height:300px;filter:drop-shadow(0 30px 50px rgba(0,0,0,.45));opacity:0;transform:scale(.2) rotate(-12deg)}
  .go .icon{animation:pop .8s cubic-bezier(.2,1.6,.4,1) .1s forwards, float 2.6s ease-in-out 1s infinite}
  @keyframes pop{to{opacity:1;transform:scale(1) rotate(0)}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
  .name{margin-top:26px}
  ${END_WM.css}
  .get{margin-top:40px;font-weight:600;font-size:66px;letter-spacing:-.5px;text-align:center;line-height:1.1;opacity:0;transform:translateY(30px)}
  .get em{font-style:normal;color:#7fd0ff}
  .go .get{animation:up .5s cubic-bezier(.2,1.4,.4,1) .6s forwards}
  @keyframes up{to{opacity:1;transform:none}}
  .date{margin-top:44px;position:relative;overflow:hidden;display:flex;align-items:center;gap:30px;padding:26px 46px 26px 30px;border-radius:40px;
        background:linear-gradient(135deg,#3aa3f0,#1e6fd0);box-shadow:0 20px 50px -14px rgba(30,143,225,.75),inset 0 2px 0 rgba(255,255,255,.25);
        opacity:0;transform:scale(.6)}
  .go .date{animation:pill .55s cubic-bezier(.2,1.5,.4,1) 1.15s forwards}
  @keyframes pill{to{opacity:1;transform:scale(1)}}
  .cal{width:132px;border-radius:22px;overflow:hidden;background:#fff;color:#0e2f4a;text-align:center;box-shadow:0 10px 24px rgba(0,0,0,.25)}
  .cal small{display:block;background:#ff6a5a;color:#fff;font:800 26px/46px "Nunito Variable",sans-serif;letter-spacing:4px}
  .cal b{display:block;font-size:76px;line-height:96px}
  .when small{display:block;font:800 28px "Nunito Variable",sans-serif;letter-spacing:5px;text-transform:uppercase;color:#d9efff}
  .when span{display:block;font-size:64px;font-weight:600;line-height:1.1}
  .date::after{content:"";position:absolute;top:0;bottom:0;width:120px;left:-160px;transform:skewX(-20deg);
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)}
  .go .date::after{animation:shine 1s ease-in-out 2.1s forwards}
  @keyframes shine{to{left:120%}}
  .store{margin-top:34px;font:700 40px "Nunito Variable",sans-serif;color:#a9c3d8;opacity:0}
  .go .store{animation:fade .5s ease-out 1.7s forwards}
  @keyframes fade{to{opacity:1}}
  .hyd{margin-top:22px;font-weight:600;font-size:54px;color:#7fd0ff;opacity:0;transform:scale(.7)}
  .go .hyd{animation:pill .5s cubic-bezier(.2,1.6,.4,1) 3.55s forwards}
</style></head><body>
  ${WAVES}
  ${sparks([[150, 380, 0], [840, 440, 0.4], [210, 1050, 0.8], [800, 1020, 0.2], [520, 250, 1.1]], 0.8)}
  <div class="stack">
    <img class="icon" src="/app-icon.svg">
    <div class="name">${END_WM.html}</div>
    <div class="get">Get the new <em>Tumbli</em> update</div>
    <div class="date"><div class="cal"><small>NOV</small><b>23</b></div><div class="when"><small>Arriving</small><span>Monday, Nov 23</span></div></div>
    <div class="store">on the Microsoft Store</div>
    <div class="hyd">Stay hydrated! 💧</div>
  </div>
  ${taskbarHtml({ s: 2, dev: "" })}
</body></html>`;

// ------------------------------------------------------------------ desktop backgrounds

const desktop = (inner = "") => `<!doctype html><html><head><meta charset="utf-8">${FONTS}</head><body style="margin:0;width:${W}px;height:${H}px;overflow:hidden;position:relative;
  background:radial-gradient(70% 45% at 75% 30%,rgba(76,155,224,.35),transparent 70%),
             radial-gradient(80% 50% at 10% 85%,rgba(32,164,127,.25),transparent 70%),
             linear-gradient(160deg,#123150 0%,#0d2238 50%,#081626 100%);font-family:'Segoe UI',sans-serif">${inner}${taskbarHtml({ s: 2, dev: DEV })}</body></html>`;
// the Settings window's frame: a shadow, a dark title bar with "Tumbli", the page goes under it
const winFrame = `<div style="position:absolute;left:${SET_AT.x - 2}px;top:${SET_AT.y - 62}px;width:${SET.w * SET.scale + 4}px;height:${SET.h * SET.scale + 64}px;
  border-radius:18px;background:#0b1622;box-shadow:0 50px 100px -30px rgba(0,0,0,.75),0 0 0 2px rgba(255,255,255,.08)">
  <div style="height:60px;display:flex;align-items:center;gap:16px;padding:0 22px;color:#dce3ea;font:600 26px 'Segoe UI',sans-serif">
    <img src="/app-icon.svg" style="width:30px;height:30px">Tumbli
    <span style="margin-left:auto;display:flex;gap:34px;color:#9fb0c0;font-size:24px">&#8211;&nbsp;&nbsp;&#9744;&nbsp;&nbsp;&#10005;</span></div></div>`;

// ------------------------------------------------------------------ recording

const POINTER = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.4 L10.1 13 L16 13 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

async function recordClip(browser, clip, framesDir) {
  const ctx = await browser.createBrowserContext(); // fresh storage per clip
  const page = await ctx.newPage();
  const widget = clip.kind === "widget";
  const vp = widget ? WIN : SET;
  await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: vp.scale });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  const cdp = await page.createCDPSession();
  if (widget) await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  if (clip.seed)
    await page.evaluateOnNewDocument((seed) => {
      for (const { k, v } of seed) localStorage.setItem(k, v);
    }, clip.seed);
  await page.goto(`${DEV}/${widget ? "widget" : "settings"}.html?name=${NAME}&theme=dark&${clip.query}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1500)); // let the entrance settle
  if (clip.prep) await clip.prep(page);
  await new Promise((r) => setTimeout(r, 300));

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
    new Promise((done) => {
      cdp.once("Emulation.virtualTimeBudgetExpired", done);
      void cdp.send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: 1000 / FPS });
    });

  let cur = null;
  const pending = (clip.steps ?? []).map((s) => ({ ...s }));
  const frames = Math.round(clip.seconds * FPS);
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
      if (s.run) {
        await s.run(page);
        s.done = true;
        continue;
      }
      if (s.scrollToEl) {
        // glide the page so an element's top sits `offset` px below the top
        if (s.startTop === undefined) {
          const r = await page.evaluate((sel) => ({ y: window.scrollY, top: document.querySelector(sel).getBoundingClientRect().top }), s.scrollToEl);
          s.startTop = r.y;
          s.endTop = r.y + r.top - (s.offset ?? 0);
        }
        const p = Math.min(1, (now - s.t) / s.dur);
        await page.evaluate((y) => window.scrollTo(0, y), s.startTop + (s.endTop - s.startTop) * ease(p));
        if (p >= 1) s.done = true;
        continue;
      }
      if (s.scroll) {
        if (s.startTop === undefined) {
          const r = await page.evaluate((sel) => {
            const el = sel ? document.querySelector(sel) : null;
            return { top: el && el.scrollHeight > el.clientHeight + 2 ? el.scrollTop : window.scrollY, own: !!el && el.scrollHeight > el.clientHeight + 2, rectTop: el ? el.getBoundingClientRect().top : 0 };
          }, s.scroll.sel ?? null);
          s.startTop = r.top;
          s.own = r.own;
          const to = s.scroll.to;
          s.endTop = typeof to === "number" ? to : r.top + Number(to.slice(1)); // a position, or "+260"
        }
        const p = Math.min(1, (now - s.t) / s.dur);
        const y = s.startTop + (s.endTop - s.startTop) * ease(p);
        await page.evaluate(
          (sel, own, y) => {
            if (own) document.querySelector(sel).scrollTop = y;
            else window.scrollTo(0, y);
          },
          s.scroll.sel ?? null,
          s.own,
          y,
        );
        if (p >= 1) s.done = true;
        continue;
      }
      if (!s.start) {
        s.start = cur ?? { x: 120, y: 60 };
        if (s.to.sel) {
          s.end = await page.$eval(s.to.sel, (el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          });
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
        if (s.leave)
          await page.evaluate(() =>
            document.querySelector(".widget")?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: null })),
          );
        s.done = true;
      }
    }
    await advance();
    await page.screenshot({ path: join(framesDir, `${String(f).padStart(5, "0")}.png`), omitBackground: widget });
  }
  await ctx.close();
}

async function stillPng(browser, url, w, h, file, transparent = true) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const cdp = await page.createCDPSession();
  if (transparent) await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  await page.screenshot({ path: file, omitBackground: transparent });
  await page.close();
}

/** Render an animated page frame by frame (every CSS animation paused and set to the frame's time). */
async function renderFrames(browser, name, w, h, seconds, dir) {
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(`${DEV}${WEB_URL}/${name}.html`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.body.classList.add("go"));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const frames = Math.round(seconds * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((ms) => {
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = ms;
      }
    }, (f * 1000) / FPS);
    await page.screenshot({ path: join(dir, `${String(f).padStart(5, "0")}.png`) });
  }
  await page.close();
}

// ------------------------------------------------------------------ helpers

const run = (args) => execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "inherit", "inherit"] });
const ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-an"];
const f3 = (n) => n.toFixed(3);

/** zoompan expression from [[t, z], ...] keyframes (seconds in the shot), eased in between */
function keysExpr(keys) {
  let expr = f3(keys.at(-1)[1]);
  for (let k = keys.length - 2; k >= 0; k--) {
    const [t0, z0] = keys[k];
    const [t1, z1] = keys[k + 1];
    const p = `((on/${FPS}-${f3(t0)})/${f3(Math.max(0.001, t1 - t0))})`;
    const eased = `(${f3(z0)}+(${f3(z1 - z0)})*(3*pow(${p},2)-2*pow(${p},3)))`;
    expr = `if(lt(on/${FPS},${f3(t1)}),${eased},${expr})`;
  }
  return `if(lt(on/${FPS},${f3(keys[0][0])}),${f3(keys[0][1])},${expr})`;
}

// ------------------------------------------------------------------ build

const skipClips = process.argv.includes("--skip-clips");
// --only=s-ach,w-peek: record just these clips again (the others are reused)
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
rmSync(join(BUILD, "seg"), { recursive: true, force: true });
for (const d of ["", "web", "seg", "png", "sfx", "intro", "end", "clips", "frames"].map((x) => join(BUILD, x))) mkdirSync(d, { recursive: true });

// 1. sound
music(join(BUILD, "music.wav"), LENGTH, BPM);
sfx(join(BUILD, "sfx"));
console.log("music and sound effects ready");

// 2. graphics + clips from the browser
writeFileSync(join(WEB, "bezel.html"), bezel);
writeFileSync(join(WEB, "intro.html"), intro);
writeFileSync(join(WEB, "endcard.html"), endcard);
writeFileSync(join(WEB, "desk-widget.html"), desktop());
writeFileSync(join(WEB, "desk-settings.html"), desktop(winFrame));
for (const [k, html] of Object.entries(TITLE_HTML)) writeFileSync(join(WEB, `${k}.html`), html);
await new Promise((r) => setTimeout(r, 800)); // let the dev server notice the new files

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--hide-scrollbars"], protocolTimeout: 60_000 });
try {
  await stillPng(browser, `${DEV}${WEB_URL}/bezel.html`, W, H, join(BUILD, "png", "bezel.png"));
  await stillPng(browser, `${DEV}${WEB_URL}/desk-widget.html`, W, H, join(BUILD, "png", "desk-widget.png"), false);
  await stillPng(browser, `${DEV}${WEB_URL}/desk-settings.html`, W, H, join(BUILD, "png", "desk-settings.png"), false);
  for (const k of Object.keys(TITLE_HTML)) await stillPng(browser, `${DEV}${WEB_URL}/${k}.html`, SCREEN.w, 300, join(BUILD, "png", `${k}.png`));
  await renderFrames(browser, "intro", SCREEN.w, SCREEN.h, SHOTS[1].start + 0.4, join(BUILD, "intro"));
  await renderFrames(browser, "endcard", SCREEN.w, SCREEN.h, LENGTH - SHOTS.at(-1).start, join(BUILD, "end"));
  console.log("graphics ready");

  if (!skipClips) {
    for (const clip of CLIP_LIST) {
      if (only && !only.includes(clip.name)) continue;
      const dir = join(BUILD, "frames", clip.name);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      await recordClip(browser, clip, dir);
      const widget = clip.kind === "widget";
      const at = widget ? { ...WIDGET_AT, x: WIDGET_AT.x + (clip.flush ? 6 : 0) } : SET_AT;
      const bg = join(BUILD, "png", widget ? "desk-widget.png" : "desk-settings.png");
      run([
        "-loop", "1", "-framerate", String(FPS), "-i", bg,
        "-framerate", String(FPS), "-i", join(dir, "%05d.png"),
        "-filter_complex", `[0][1]overlay=${at.x}:${at.y}:shortest=1,format=yuv420p`,
        "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-r", String(FPS), join(CLIPS, `${clip.name}.mp4`),
      ]);
      console.log("clip", clip.name);
    }
  }
} finally {
  await browser.close();
}

// 3. one video per shot (each runs on past its end by the length of its transition)
const parts = SHOTS.map((shot, i) => {
  const len = shot.end - shot.start + (shot.tr?.[1] ?? 0);
  const frames = Math.round(len * FPS);
  const out = join(BUILD, "seg", `${String(i).padStart(2, "0")}.mp4`);
  const inputs = [];
  let screen;
  if (shot.kind === "intro" || shot.kind === "endcard") {
    inputs.push("-framerate", String(FPS), "-i", join(BUILD, shot.kind === "intro" ? "intro" : "end", "%05d.png"));
    screen = `[0:v]fps=${FPS},scale=${SCREEN.w}:${SCREEN.h},tpad=stop_mode=clone:stop_duration=2`;
  } else {
    const from = shot.from ?? 0;
    inputs.push("-ss", String(from), "-i", join(CLIPS, `${shot.clip}.mp4`));
    const zoom = shot.zoom ?? [[0, 1.0], [len, 1.05]];
    const zmax = Math.max(...zoom.map((k) => k[1]));
    const sw = Math.round((SCREEN.w * zmax) / 2) * 2;
    const shh = Math.round((SCREEN.h * zmax) / 2) * 2;
    // widget shots zoom toward Tumbli's corner; settings shots push in on the window's middle
    const fx = shot.focus?.[0] ?? 0.5;
    const fy = shot.focus?.[1] ?? 0.55;
    const xy = shot.focus
      ? `x='max(0,min(iw-iw/zoom,iw*${fx}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,ih*${fy}-ih/zoom/2))'`
      : shot.zoom
        ? `x='iw-iw/zoom':y='ih-ih/zoom'`
        : `x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*0.55'`;
    screen =
      `[0:v]fps=${FPS},tpad=stop_mode=clone:stop_duration=3,scale=${sw}:${shh},setsar=1,` +
      `zoompan=z='${keysExpr(zoom)}':${xy}:d=1:s=${SCREEN.w}x${SCREEN.h}:fps=${FPS}`;
  }
  inputs.push("-i", join(BUILD, "png", "bezel.png"));
  const chain = `${screen},pad=${W}:${H}:${SCREEN.x}:${SCREEN.y}:color=0x0a0d12[s];[s][1:v]overlay=0:0`;
  run([...inputs, "-filter_complex", `${chain},trim=end_frame=${frames},setpts=PTS-STARTPTS,format=yuv420p`, ...ENC, out]);
  console.log(`shot ${i + 1}/${SHOTS.length}`);
  return out;
});

// 4. join the shots with transitions, then lay the titles on top (they slide up and pop in)
const vIn = parts.flatMap((p) => ["-i", p]);
let g = "";
let prev = "[0:v]";
SHOTS.slice(0, -1).forEach((shot, i) => {
  const [type, d] = shot.tr;
  g += `${prev}[${i + 1}:v]xfade=transition=${type}:duration=${d}:offset=${f3(SHOTS[i + 1].start)}[x${i}];`;
  prev = `[x${i}]`;
});
const tIn = [];
TITLES.forEach(([k, from, to], i) => {
  const idx = parts.length + i;
  tIn.push("-loop", "1", "-t", String(LENGTH), "-i", join(BUILD, "png", `${k}.png`));
  g +=
    `[${idx}:v]format=rgba,fade=t=in:st=${from}:d=0.2:alpha=1,fade=t=out:st=${f3(to - 0.18)}:d=0.18:alpha=1[t${i}];` +
    `${prev}[t${i}]overlay=x=${SCREEN.x}:y='${SCREEN.y + 40}+60*pow(max(0,1-(t-${from})/0.35),2)':enable='between(t,${from},${to})'[k${i}];`;
  prev = `[k${i}]`;
});
g += `${prev}trim=duration=${LENGTH},format=yuv420p[vout]`;
const video = join(BUILD, "video.mp4");
run([...vIn, ...tIn, "-filter_complex", g, "-map", "[vout]", ...ENC, video]);
console.log("video ready");

// 5. sound: each phrase on its cue, the music ducked under the voice, effects on cue
const ms = (s) => Math.max(0, Math.round(s * 1000));
const aIn = ["-i", join(BUILD, "music.wav")];
VO.forEach(() => aIn.push("-i", join(SRC, "voice over.mp3")));
SFX.forEach(([name]) => aIn.push("-i", join(BUILD, "sfx", `${name}.wav`)));
let a = "";
VO.forEach((v, i) => {
  a +=
    `[${i + 1}:a]atrim=${v.from}:${v.to},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,` +
    `afade=t=in:d=0.02,afade=t=out:st=${f3(v.to - v.from - 0.04)}:d=0.04,adelay=${ms(v.at)}|${ms(v.at)}[v${i}];`;
});
a += `${VO.map((_, i) => `[v${i}]`).join("")}amix=inputs=${VO.length}:normalize=0,highpass=f=80,volume=1.1,apad=whole_dur=${LENGTH},asplit=2[vo][key];`;
a += `[0:a]volume=0.5[m];[m][key]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=400[mus];`;
SFX.forEach(([, time, gain], k) => {
  const idx = VO.length + 1 + k;
  a += `[${idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${gain},adelay=${ms(time)}|${ms(time)}[s${k}];`;
});
a +=
  `[vo][mus]${SFX.map((_, k) => `[s${k}]`).join("")}amix=inputs=${SFX.length + 2}:normalize=0:duration=first,` +
  `volume=1.0,alimiter=limit=0.75:level=0,atrim=0:${LENGTH}[aout]`;
const audio = join(BUILD, "mix.wav");
run([...aIn, "-filter_complex", a, "-map", "[aout]", audio]);

// 6. together
run(["-i", video, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT]);
console.log("wrote", OUT, `(${LENGTH.toFixed(1)} s)`);
