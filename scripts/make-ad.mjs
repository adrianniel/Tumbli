// Edits the portrait Tumbli ad (1080x1920, 30 fps) from:
//   store-assets/ad/source/shot 1.mp4, shot 2.mp4, shot 3.mp4   (Google Flow, muted here)
//   store-assets/ad/source/voice over.mp3                        (ElevenLabs)
//   Tumbli's real animations, recorded on a clean desktop       (make-ad-clips.mjs --bg=clean)
// plus original music and sound effects (scripts/ad/synth.mjs), captions, animated graphics,
// transitions and an end card.
//
// The voice-over is cut into its phrases (at the pauses) and every phrase is placed on the
// timeline on its own, so each line lands exactly on the shot it talks about.
//
// Usage:  npm run dev            (in another terminal)
//         node scripts/make-ad-clips.mjs --bg=clean --out=store-assets/ad/.build/clips
//         npm run ad              -> store-assets/ad/Tumbli-ad.mp4
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
const AD = join(root, "store-assets", "ad");
const SRC = join(AD, "source");
const BUILD = join(AD, ".build");
const CLIPS = join(BUILD, "clips");
const WEB = join(BUILD, "web"); // served by the dev server, for the browser-made graphics
const OUT = join(AD, "Tumbli-ad.mp4");
const DEV = "http://localhost:1420";
const FPS = 30;
const W = 1080;
const H = 1920;
// the "laptop screen": a bezel around everything that happens on the computer
const SCREEN = { x: 36, y: 64, w: 1008, h: 1792, r: 30 };
const LENGTH = 23.6;
const BPM = 118.5; // two bars = 4.05 s: the drums drop right on the camera punch after "again?"

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!EDGE) throw new Error("Microsoft Edge not found");
if (!(await fetch(`${DEV}/widget.html`).catch(() => null))?.ok) throw new Error(`Start the dev server first: npm run dev`);
for (const f of ["shot 1.mp4", "shot 2.mp4", "shot 3.mp4", "voice over.mp3"])
  if (!existsSync(join(SRC, f))) throw new Error(`Missing ${join(SRC, f)}`);
for (const c of ["01-idle", "03-drink", "04-reminder", "05-goal", "07-outfits"])
  if (!existsSync(join(CLIPS, `${c}-clean.mp4`)))
    throw new Error(`Missing clean clips. Run: node scripts/make-ad-clips.mjs --bg=clean --out=store-assets/ad/.build/clips`);

// ------------------------------------------------------------------ voice-over
// Phrases of "voice over.mp3" (found at its pauses): [from, to] in the file, and when the
// words should start in the video. Each phrase begins ~0.08 s before its first word.
const VO = [
  { from: 0.0, to: 1.9, at: 0.35 }, //  "Long day at the computer..."
  { from: 2.13, to: 3.86, at: 2.37 }, // "and you forgot to drink water again?"
  { from: 4.14, to: 4.88, at: 4.2, gain: 0.7 }, // (a breath)
  { from: 5.32, to: 6.32, at: 5.32 }, // "Meet Tumbli."
  { from: 6.48, to: 9.42, at: 6.4 }, //  "It lives on the edge of your screen, and reminds you,"
  { from: 9.58, to: 10.25, at: 9.4 }, // "gently."
  { from: 10.58, to: 11.97, at: 10.35 }, // "One click when you drink..."
  { from: 12.3, to: 14.18, at: 12.45 }, // "and Tumbli fills up with you."
  { from: 14.53, to: 18.77, at: 14.75 }, // "Hit your goal, keep your streak, and unlock cute outfits along the way."
  { from: 19.04, to: 21.39, at: 19.3 }, // "Tumbli. Free on the Microsoft Store."
];

// ------------------------------------------------------------------ the cut
// Each shot starts at `start` (s); the transition `tr` blends it into the next one.
// Screen shots: `zoom` = [[t, z], ...] keyframes for how close the camera is to Tumbli's
// corner of the screen (1 = the whole screen).
const SHOTS = [
  { start: 0, kind: "flow", file: "shot 1.mp4", from: 2.0, punch: { at: 4.05, fx: 0.53, fy: 0.37 }, tr: ["smoothup", 0.35] },
  { start: 4.95, kind: "screen", clip: "01-idle", from: 0.2, zoom: [[0, 1.9], [0.5, 1.75], [1.7, 1.75], [2.5, 1.0]], tr: ["fade", 0.2] },
  { start: 8.25, kind: "screen", clip: "04-reminder", from: 0.0, zoom: [[0, 1.0], [1.9, 1.04]], tr: ["fade", 0.2] },
  { start: 10.15, kind: "screen", clip: "03-drink", from: 1.3, zoom: [[0, 1.15], [1.05, 1.2]], tr: ["slideleft", 0.25] },
  { start: 11.2, kind: "flow", file: "shot 2.mp4", from: 3.85, tr: ["slideright", 0.25] },
  { start: 12.45, kind: "screen", clip: "03-drink", from: 2.25, zoom: [[0, 1.2], [2.15, 1.15]], tr: ["fade", 0.2] },
  { start: 14.6, kind: "screen", clip: "05-goal", from: 1.4, zoom: [[0, 1.3], [1.4, 1.38]], tr: ["smoothleft", 0.25] },
  { start: 16.0, kind: "flow", file: "shot 3.mp4", from: 4.35, tr: ["smoothright", 0.25] },
  { start: 16.95, kind: "screen", clip: "07-outfits", from: 0, speed: 2.75, zoom: [[0, 1.65], [2.3, 1.55]], tr: ["zoomin", 0.35] },
  { start: 19.25, kind: "endcard" },
];
SHOTS.forEach((s, i) => (s.end = SHOTS[i + 1]?.start ?? LENGTH));

// on-screen words: [png name, from, to, where] ("screen" = inside the laptop, "flow" = over a Flow shot)
const CAPTIONS = [
  ["c-forgot", 2.4, 4.02, "flow"],
  ["c-meet", 5.3, 6.55, "screen"],
  ["c-edge", 6.65, 8.2, "screen"],
  ["c-reminds", 8.35, 10.1, "screen"],
  ["c-click", 10.3, 11.15, "screen"],
  ["c-fills", 12.55, 14.55, "screen"],
  ["c-goal", 14.75, 15.95, "screen"],
  ["c-streak", 16.05, 16.92, "flow"],
  ["c-outfits", 17.05, 19.2, "screen"],
];

// sound effects: [name, time, gain]
const SFX = [
  ["pop", 2.42, 0.3],
  ["thud", 4.05, 0.75],
  ["pop", 4.12, 0.4],
  ["whoosh", 4.78, 0.6],
  ["pop", 5.32, 0.3],
  ["pop", 6.67, 0.25],
  ["bloop", 8.3, 0.5],
  ["pop", 10.32, 0.25],
  ["click", 10.75, 0.75],
  ["whoosh", 11.05, 0.45],
  ["gulp", 11.75, 0.5],
  ["whoosh", 12.3, 0.45],
  ["pop", 12.57, 0.3],
  ["click", 15.1, 0.75],
  ["sparkle", 15.2, 0.45],
  ["whoosh", 15.85, 0.4],
  ["whoosh", 16.8, 0.4],
  ...[1, 2, 3, 4].map((k) => ["pop", 16.95 + (k * 1.5) / 2.75, 0.2]), // each new outfit
  ["whoosh", 19.1, 0.55],
  ["boing", 19.38, 0.5],
  ["sparkle", 20.12, 0.35],
];

// ------------------------------------------------------------------ graphics

const FONTS = `<link rel="stylesheet" href="/node_modules/@fontsource-variable/fredoka/index.css">
<link rel="stylesheet" href="/node_modules/@fontsource-variable/nunito/index.css">`;

/** a caption: big rounded words, the key ones in water blue */
const caption = (html, { width = SCREEN.w, scrim = false } = {}) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html,body{margin:0;background:transparent}
  .c{width:${width}px;height:520px;display:flex;align-items:center;justify-content:center;text-align:center;
     font:600 100px/1.04 "Fredoka Variable",sans-serif;color:#fff;letter-spacing:-1px;
     text-shadow:0 4px 0 rgba(8,22,38,.55),0 10px 40px rgba(0,0,0,.55)}
  em{font-style:normal;color:#7fd0ff}
  ${scrim ? ".c{background:radial-gradient(60% 50% at 50% 50%,rgba(6,18,30,.62),rgba(6,18,30,0) 100%)}" : ""}
</style></head><body><div class="c"><div>${html}</div></div></body></html>`;

const CAPTION_HTML = {
  "c-forgot": caption("Forgot to drink<br>water <em>again?</em>", { width: W, scrim: true }),
  "c-meet": caption("Meet <em>Tumbli</em>"),
  "c-edge": caption("Lives on the <em>edge</em><br>of your screen"),
  "c-reminds": caption("It reminds you,<br><em>gently</em>"),
  "c-click": caption("<em>One click</em>"),
  "c-fills": caption("Tumbli <em>fills up</em><br>with you"),
  "c-goal": caption("Hit your <em>goal</em>"),
  "c-streak": caption("Keep your <em>streak</em>", { width: W, scrim: true }),
  "c-outfits": caption("Unlock cute<br><em>outfits</em>"),
};

/** the laptop bezel, with a see-through screen */
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

/** after "again?": an empty water tracker pops up and shakes */
const thirstCard = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html,body{margin:0;width:${W}px;height:${H}px;background:transparent;overflow:hidden}
  .card{position:absolute;left:190px;top:1210px;width:700px;padding:38px 44px 42px;border-radius:44px;background:rgba(255,255,255,.96);
        box-shadow:0 40px 80px -24px rgba(0,0,0,.55);font-family:"Fredoka Variable",sans-serif;color:#0e2f4a;
        opacity:0;transform:scale(.3) rotate(-8deg)}
  .go .card{animation:pop .45s cubic-bezier(.2,1.7,.4,1) .05s forwards, shake .5s ease-in-out .55s 1}
  @keyframes pop{to{opacity:1;transform:scale(1) rotate(-3deg)}}
  @keyframes shake{0%,100%{transform:rotate(-3deg)}20%{transform:rotate(-6deg) translateX(-10px)}40%{transform:rotate(0) translateX(10px)}60%{transform:rotate(-5deg) translateX(-6px)}80%{transform:rotate(-2deg) translateX(4px)}}
  .row{display:flex;align-items:center;gap:26px}
  .drop{width:96px;height:96px;flex:none}
  .k{font:700 34px "Nunito Variable",sans-serif;letter-spacing:4px;text-transform:uppercase;color:#5d7488}
  .v{font-weight:700;font-size:118px;line-height:1;color:#ff5a4a}
  .v small{font-size:54px;color:#ff5a4a}
  .bar{margin-top:26px;height:30px;border-radius:15px;background:#ffe3df;position:relative;overflow:hidden}
  .bar::after{content:"";position:absolute;left:0;top:0;bottom:0;width:3%;border-radius:15px;background:#ff5a4a}
  .badge{position:absolute;right:-26px;top:-30px;width:92px;height:92px;border-radius:50%;background:#ff5a4a;color:#fff;
         font:700 64px/92px "Fredoka Variable",sans-serif;text-align:center;box-shadow:0 10px 24px rgba(255,90,74,.5)}
</style></head><body>
  <div class="card"><div class="badge">!</div>
    <div class="row">
      <svg class="drop" viewBox="0 0 24 24"><path d="M12 2.5C9 6.6 5.5 10.6 5.5 14.6a6.5 6.5 0 0 0 13 0c0-4-3.5-8-6.5-12.1z" fill="#ffe3df" stroke="#ff5a4a" stroke-width="1.8" stroke-linejoin="round"/></svg>
      <div><div class="k">Water today</div><div class="v">0 <small>ml</small></div></div>
    </div>
    <div class="bar"></div>
  </div>
</body></html>`;

const END_WM = wordmark({ size: 168, animate: true, delay: 0.2 });

/** the end card: the laptop screen shows Tumbli's logo and the offer, timed to the voice */
const endcard = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html,body{margin:0;width:${SCREEN.w}px;height:${SCREEN.h}px;overflow:hidden}
  body{background:radial-gradient(60% 40% at 50% 38%,rgba(58,163,240,.45),transparent 70%),
       radial-gradient(80% 50% at 20% 100%,rgba(32,164,127,.22),transparent 70%),
       linear-gradient(170deg,#123150 0%,#0b1f33 55%,#07131f 100%);
       font-family:"Fredoka Variable",sans-serif;color:#fff;position:relative}
  .stack{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:120px}
  .icon{width:330px;height:330px;filter:drop-shadow(0 30px 50px rgba(0,0,0,.45));opacity:0;transform:scale(.2) rotate(-12deg)}
  .go .icon{animation:pop .8s cubic-bezier(.2,1.6,.4,1) .1s forwards, float 2.6s ease-in-out 1s infinite}
  @keyframes pop{to{opacity:1;transform:scale(1) rotate(0)}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
  .name{margin-top:30px}
  ${END_WM.css}
  .tag{margin-top:22px;font:600 46px "Nunito Variable",sans-serif;color:#a9c3d8;opacity:0}
  .go .tag{animation:fade .5s ease-out .55s forwards}
  @keyframes fade{to{opacity:1}}
  .pill{margin-top:70px;position:relative;overflow:hidden;padding:30px 54px;border-radius:999px;
        background:linear-gradient(135deg,#3aa3f0,#1e6fd0);font-weight:600;font-size:58px;letter-spacing:-.5px;
        box-shadow:0 20px 50px -14px rgba(30,143,225,.75),inset 0 2px 0 rgba(255,255,255,.25);opacity:0;transform:scale(.6)}
  .pill small{display:block;font:700 30px "Nunito Variable",sans-serif;letter-spacing:5px;text-transform:uppercase;color:#d9efff;margin-bottom:6px;text-align:center}
  .go .pill{animation:pill .55s cubic-bezier(.2,1.5,.4,1) .85s forwards}
  @keyframes pill{to{opacity:1;transform:scale(1)}}
  .pill::after{content:"";position:absolute;top:0;bottom:0;width:120px;left:-160px;transform:skewX(-20deg);
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)}
  .go .pill::after{animation:shine 1s ease-in-out 1.7s forwards}
  @keyframes shine{to{left:120%}}
  .spark{position:absolute;width:16px;height:16px;opacity:0}
  .spark::before,.spark::after{content:"";position:absolute;left:7px;top:0;width:2px;height:16px;border-radius:2px;background:#ffd66b}
  .spark::after{transform:rotate(90deg)}
  .go .spark{animation:twinkle 1.4s ease-in-out infinite}
  @keyframes twinkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1.2) rotate(45deg)}}
  .waves{position:absolute;left:-10%;right:-10%;bottom:-20px;height:260px;fill:rgba(58,163,240,.18)}
  .go .waves{animation:sway 4s ease-in-out infinite}
  @keyframes sway{50%{transform:translateX(40px)}}
  .bar{position:absolute;left:0;right:0;bottom:0;height:120px;background:rgba(18,22,28,.92);border-top:2px solid rgba(255,255,255,.07);
       display:flex;align-items:center;justify-content:center;gap:28px}
  .bar span{width:62px;height:62px;border-radius:16px}
</style></head><body>
  <svg class="waves" viewBox="0 0 1200 260" preserveAspectRatio="none"><path d="M0 90 C200 40 400 140 600 90 S1000 40 1200 90 V260 H0Z"/><path d="M0 150 C220 110 420 200 640 150 S1020 110 1200 150 V260 H0Z" opacity=".7"/></svg>
  ${[[180, 470, 0], [820, 520, 0.4], [250, 980, 0.8], [780, 1010, 0.2], [520, 330, 1.1]]
    .map(([x, y, d]) => `<i class="spark" style="left:${x}px;top:${y}px;animation-delay:${0.8 + d}s"></i>`)
    .join("")}
  <div class="stack">
    <img class="icon" src="/app-icon.svg">
    <div class="name">${END_WM.html}</div>
    <div class="tag">Your water buddy for Windows</div>
    <div class="pill"><small>Get it free on the</small>Microsoft Store</div>
  </div>
  ${taskbarHtml({ s: 2, dev: "" })}
</body></html>`;

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

/**
 * Render an animated page frame by frame: every CSS animation is paused and set to the
 * frame's time, so the result is smooth however slow the machine is.
 */
async function renderFrames(browser, name, w, h, seconds, dir, transparent) {
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const cdp = await page.createCDPSession();
  if (transparent) await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await page.goto(`${DEV}/store-assets/ad/.build/web/${name}.html`, { waitUntil: "load" });
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
    await page.screenshot({ path: join(dir, `${String(f).padStart(5, "0")}.png`), omitBackground: transparent });
  }
  await page.close();
}

// ------------------------------------------------------------------ build

rmSync(join(BUILD, "seg"), { recursive: true, force: true });
for (const d of ["", "web", "seg", "png", "sfx", "end", "card", "vo"].map((x) => join(BUILD, x))) mkdirSync(d, { recursive: true });

// 1. sound
music(join(BUILD, "music.wav"), LENGTH, BPM);
sfx(join(BUILD, "sfx"));
console.log("music and sound effects ready");

// 2. graphics from the browser
writeFileSync(join(WEB, "bezel.html"), bezel);
writeFileSync(join(WEB, "endcard.html"), endcard);
writeFileSync(join(WEB, "card.html"), thirstCard);
for (const [k, html] of Object.entries(CAPTION_HTML)) writeFileSync(join(WEB, `${k}.html`), html);
await new Promise((r) => setTimeout(r, 800)); // let the dev server notice the new files

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--hide-scrollbars"] });
try {
  const still = async (name, w, h, file) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const cdp = await page.createCDPSession();
    await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    await page.goto(`${DEV}/store-assets/ad/.build/web/${name}.html`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, omitBackground: true });
    await page.close();
  };
  await still("bezel", W, H, join(BUILD, "png", "bezel.png"));
  for (const [k, , , where] of CAPTIONS) await still(k, where === "flow" ? W : SCREEN.w, 520, join(BUILD, "png", `${k}.png`));
  await renderFrames(browser, "card", W, H, SHOTS[0].end - SHOTS[0].punch.at + 0.4, join(BUILD, "card"), true);
  await renderFrames(browser, "endcard", SCREEN.w, SCREEN.h, LENGTH - SHOTS.at(-1).start, join(BUILD, "end"), false);
} finally {
  await browser.close();
}
console.log("graphics ready");

// 3. one video per shot (each runs on past its end by the length of its transition)
const parts = SHOTS.map((shot, i) => {
  const len = shot.end - shot.start + (shot.tr?.[1] ?? 0);
  const frames = Math.round(len * FPS);
  const out = join(BUILD, "seg", `${String(i).padStart(2, "0")}.mp4`);
  const inputs = [];
  let chain;
  if (shot.kind === "flow") {
    // Flow shots fill the frame; their own audio is never used
    inputs.push("-ss", String(shot.from), "-t", String(len + 0.2), "-i", join(SRC, shot.file));
    chain = `[0:v]fps=${FPS},scale=${W * 1.5}:${H * 1.5},setsar=1,`;
    if (shot.punch) {
      // after "again?": the camera punches in on her face with a little shake
      const tp = f3(shot.punch.at - shot.start);
      const z = `if(lt(on/${FPS},${tp}),1+0.04*on/${FPS}/${tp},${keysExpr([[shot.punch.at - shot.start, 1.04], [shot.punch.at - shot.start + 0.22, 1.5], [len, 1.58]])})`;
      const shake = (axis, k) => `${k}*sin(on*${axis})*exp(-max(0,on/${FPS}-${tp})*5)*gte(on/${FPS},${tp})`;
      const x = `max(0,min(iw-iw/zoom,iw*${shot.punch.fx}-iw/zoom/2+${shake(2.3, 14)}))`;
      const y = `max(0,min(ih-ih/zoom,ih*${shot.punch.fy}-ih/zoom/2+${shake(1.7, 10)}))`;
      chain += `zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${W}x${H}:fps=${FPS}`;
      // the empty water tracker
      inputs.push("-framerate", String(FPS), "-i", join(BUILD, "card", "%05d.png"));
      chain += `[v];[1:v]format=rgba,setpts=PTS+${tp}/TB[card];[v][card]overlay=0:0:eof_action=pass`;
    } else {
      chain += `zoompan=z='1+0.05*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}`;
    }
  } else {
    let screen;
    if (shot.kind === "endcard") {
      inputs.push("-framerate", String(FPS), "-i", join(BUILD, "end", "%05d.png"));
      screen = `[0:v]fps=${FPS},scale=${SCREEN.w}:${SCREEN.h}`;
    } else {
      // closer to Tumbli: zoom on the bottom-right of the screen, where it's docked
      const speed = shot.speed ?? 1;
      inputs.push("-ss", String(shot.from), "-t", String(len * speed + 0.2), "-i", join(CLIPS, `${shot.clip}-clean.mp4`));
      const zmax = Math.max(...shot.zoom.map((k) => k[1]));
      const sw = Math.round((SCREEN.w * zmax) / 2) * 2;
      const shh = Math.round((SCREEN.h * zmax) / 2) * 2;
      screen =
        `[0:v]${speed !== 1 ? `setpts=PTS/${speed},` : ""}fps=${FPS},scale=${sw}:${shh},setsar=1,` +
        `zoompan=z='${keysExpr(shot.zoom)}':x='iw-iw/zoom':y='ih-ih/zoom':d=1:s=${SCREEN.w}x${SCREEN.h}:fps=${FPS}`;
    }
    inputs.push("-i", join(BUILD, "png", "bezel.png"));
    chain = `${screen},pad=${W}:${H}:${SCREEN.x}:${SCREEN.y}:color=0x0a0d12[s];[s][1:v]overlay=0:0`;
  }
  run([...inputs, "-filter_complex", `${chain},trim=end_frame=${frames},setpts=PTS-STARTPTS,format=yuv420p`, ...ENC, out]);
  console.log(`shot ${i + 1}/${SHOTS.length}`);
  return out;
});

// 4. join the shots with transitions, then lay the captions on top
const vIn = parts.flatMap((p) => ["-i", p]);
let g = "";
let prev = "[0:v]";
SHOTS.slice(0, -1).forEach((shot, i) => {
  const [type, d] = shot.tr;
  const label = `[x${i}]`;
  g += `${prev}[${i + 1}:v]xfade=transition=${type}:duration=${d}:offset=${f3(SHOTS[i + 1].start)}${label};`;
  prev = label;
});
const capIn = [];
CAPTIONS.forEach(([k, from, to, where], i) => {
  const idx = parts.length + i;
  capIn.push("-loop", "1", "-t", String(LENGTH), "-i", join(BUILD, "png", `${k}.png`));
  const x = where === "flow" ? 0 : SCREEN.x;
  const y = where === "flow" ? 190 : SCREEN.y + 130;
  g +=
    `[${idx}:v]format=rgba,fade=t=in:st=${from}:d=0.22:alpha=1,fade=t=out:st=${f3(to - 0.15)}:d=0.15:alpha=1[c${i}];` +
    `${prev}[c${i}]overlay=x=${x}:y='${y}+46*max(0,1-(t-${from})/0.3)':enable='between(t,${from},${to})'[k${i}];`;
  prev = `[k${i}]`;
});
g += `${prev}trim=duration=${LENGTH},format=yuv420p[vout]`;
const video = join(BUILD, "video.mp4");
run([...vIn, ...capIn, "-filter_complex", g, "-map", "[vout]", ...ENC, video]);
console.log("video ready");

// 5. sound: each voice-over phrase on its cue, music ducked under the voice, effects on cue
const ms = (s) => Math.max(0, Math.round(s * 1000));
const aIn = ["-i", join(BUILD, "music.wav")];
VO.forEach(() => aIn.push("-i", join(SRC, "voice over.mp3")));
SFX.forEach(([name]) => aIn.push("-i", join(BUILD, "sfx", `${name}.wav`)));
let a = "";
VO.forEach((v, i) => {
  a +=
    `[${i + 1}:a]atrim=${v.from}:${v.to},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,` +
    `afade=t=in:d=0.02,afade=t=out:st=${f3(v.to - v.from - 0.04)}:d=0.04,volume=${v.gain ?? 1},adelay=${ms(v.at)}|${ms(v.at)}[v${i}];`;
});
a += `${VO.map((_, i) => `[v${i}]`).join("")}amix=inputs=${VO.length}:normalize=0,highpass=f=80,volume=1.15,apad=whole_dur=${LENGTH},asplit=2[vo][key];`;
a += `[0:a]volume=0.55[m];[m][key]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=400[mus];`;
SFX.forEach(([, time, gain], k) => {
  const idx = VO.length + 1 + k;
  a += `[${idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${gain},adelay=${ms(time)}|${ms(time)}[s${k}];`;
});
a +=
  `[vo][mus]${SFX.map((_, k) => `[s${k}]`).join("")}amix=inputs=${SFX.length + 2}:normalize=0:duration=first,` +
  // no make-up gain, and headroom for the AAC encoder
  `volume=1.0,alimiter=limit=0.75:level=0,atrim=0:${LENGTH}[aout]`;
const audio = join(BUILD, "mix.wav");
run([...aIn, "-filter_complex", a, "-map", "[aout]", audio]);

// 6. together
run(["-i", video, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT]);
console.log("wrote", OUT, `(${LENGTH.toFixed(1)} s)`);
