// Brand images with the Tumbli wordmark (the "i" is a tumbler whose floating cap is the dot).
//   store-assets/brand/tumbli-cover-2400x1260.png   Facebook post / link image (1.91:1)
//   store-assets/brand/tumbli-cover-1920x1080.png   16:9
//
// Usage:  npm run dev   (in another terminal)
//         npm run brand
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { wordmark } from "./ad/wordmark.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "store-assets", "brand");
const WEB = join(root, "store-assets", "ad", ".build", "web"); // served by the dev server
const DEV = "http://localhost:1420";
const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!EDGE) throw new Error("Microsoft Edge not found");
if (!(await fetch(`${DEV}/app-icon.svg`).catch(() => null))?.ok) throw new Error("Start the dev server first: npm run dev");

function cover(w, h) {
  const u = h / 1260; // layout unit: everything is drawn for 1260 px tall, then scaled
  const wm = wordmark({ size: Math.round(230 * u) });
  const drops = [
    [0.1, 0.22, 34, 0.5], [0.17, 0.62, 22, 0.35], [0.86, 0.2, 28, 0.45], [0.92, 0.55, 18, 0.3],
    [0.27, 0.12, 16, 0.25], [0.74, 0.1, 20, 0.3], [0.07, 0.82, 16, 0.25], [0.8, 0.78, 26, 0.35],
  ];
  const sparks = [[0.33, 0.24], [0.66, 0.3], [0.24, 0.48], [0.77, 0.47], [0.4, 0.82], [0.62, 0.86]];
  const chips = ["Gentle reminders", "A goal that fits you", "Cute outfits"];
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/node_modules/@fontsource-variable/fredoka/index.css">
<link rel="stylesheet" href="/node_modules/@fontsource-variable/nunito/index.css">
<style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
  body{position:relative;color:#fff;font-family:"Nunito Variable",sans-serif;
    background:
      radial-gradient(${520 * u}px ${420 * u}px at 50% 36%,rgba(58,163,240,.5),transparent 70%),
      radial-gradient(${900 * u}px ${600 * u}px at 0% 100%,rgba(32,164,127,.28),transparent 70%),
      radial-gradient(${800 * u}px ${560 * u}px at 100% 0%,rgba(76,155,224,.25),transparent 70%),
      linear-gradient(165deg,#133555 0%,#0b2036 52%,#07131f 100%)}
  .waves{position:absolute;left:-5%;bottom:0;width:110%;height:${300 * u}px}
  .drop{position:absolute}
  .spark{position:absolute;width:${22 * u}px;height:${22 * u}px}
  .spark::before,.spark::after{content:"";position:absolute;left:${10 * u}px;top:0;width:${3 * u}px;height:${22 * u}px;border-radius:2px;background:#ffd66b}
  .spark::after{transform:rotate(90deg)}
  .stack{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:${40 * u}px}
  .icon{width:${330 * u}px;height:${330 * u}px;filter:drop-shadow(0 ${30 * u}px ${50 * u}px rgba(0,0,0,.45))}
  .halo{position:absolute;width:${470 * u}px;height:${470 * u}px;border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%);
    border:${3 * u}px solid rgba(127,208,255,.18);box-shadow:0 0 0 ${26 * u}px rgba(127,208,255,.06)}
  .iconwrap{position:relative;display:grid;place-items:center;width:${330 * u}px;height:${330 * u}px}
  .name{margin-top:${26 * u}px;text-shadow:0 ${8 * u}px ${30 * u}px rgba(0,0,0,.35)}
  ${wm.css}
  .tag{margin-top:${10 * u}px;font-weight:700;font-size:${54 * u}px;color:#cfe4f5;letter-spacing:${0.3 * u}px}
  .tag em{font-style:normal;color:#7fd0ff}
  .chips{margin-top:${38 * u}px;display:flex;gap:${18 * u}px}
  .chip{padding:${14 * u}px ${28 * u}px;border-radius:999px;background:rgba(255,255,255,.08);border:${2 * u}px solid rgba(255,255,255,.12);
    font-weight:700;font-size:${30 * u}px;color:#e4f1fb}
</style></head><body>
  <svg class="waves" viewBox="0 0 1200 300" preserveAspectRatio="none">
    <path d="M0 120 C200 70 400 170 600 120 S1000 70 1200 120 V300 H0Z" fill="rgba(58,163,240,.14)"/>
    <path d="M0 190 C220 150 420 240 640 190 S1020 150 1200 190 V300 H0Z" fill="rgba(58,163,240,.2)"/>
  </svg>
  ${drops
    .map(
      ([x, y, s, o]) =>
        `<svg class="drop" style="left:${x * w}px;top:${y * h}px;width:${s * u * 2}px;height:${s * u * 2}px;opacity:${o}" viewBox="0 0 24 24"><path d="M12 2.5C9 6.6 5.5 10.6 5.5 14.6a6.5 6.5 0 0 0 13 0c0-4-3.5-8-6.5-12.1z" fill="#7fd0ff"/></svg>`,
    )
    .join("")}
  ${sparks.map(([x, y]) => `<i class="spark" style="left:${x * w}px;top:${y * h}px"></i>`).join("")}
  <div class="stack">
    <div class="iconwrap"><div class="halo"></div><img class="icon" src="/app-icon.svg" alt=""></div>
    <div class="name">${wm.html}</div>
    <div class="tag">Your <em>water buddy</em> for Windows</div>
    <div class="chips">${chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>
  </div>
</body></html>`;
}

mkdirSync(OUT, { recursive: true });
mkdirSync(WEB, { recursive: true });
const sizes = [
  [2400, 1260],
  [1920, 1080],
];
for (const [w, h] of sizes) writeFileSync(join(WEB, `cover-${w}x${h}.html`), cover(w, h));
await new Promise((r) => setTimeout(r, 800));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
try {
  for (const [w, h] of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(`${DEV}/store-assets/ad/.build/web/cover-${w}x${h}.html`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const file = join(OUT, `tumbli-cover-${w}x${h}.png`);
    await page.screenshot({ path: file });
    await page.close();
    console.log("wrote", file);
  }
} finally {
  await browser.close();
}
