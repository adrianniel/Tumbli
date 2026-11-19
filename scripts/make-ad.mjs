// Edits the portrait Tumbli ad (1080x1920, 30 fps) from:
//   store-assets/ad/source/shot 1.mp4, shot 2.mp4, shot 3.mp4   (Google Flow, muted here)
//   store-assets/ad/source/voice over.mp3                        (ElevenLabs)
//   Tumbli's real animations, recorded on a clean desktop       (make-ad-clips.mjs --bg=clean)
// plus original music and sound effects (scripts/ad/synth.mjs), captions and an end card.
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
const VO_DELAY = 0.3; // the voice-over starts a beat after the music

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

// ------------------------------------------------------------------ timeline
// Times are in the video (seconds). The voice-over lines land like this:
//  0.3  "Long day at the computer... and you forgot to drink water again?"
//  4.5  "Meet Tumbli. It lives on the edge of your screen, and reminds you, gently."
//  10.0 "One click when you drink... and Tumbli fills up with you."
//  14.9 "Hit your goal, keep your streak, and unlock cute outfits along the way."
//  19.4 "Tumbli. Free on the Microsoft Store."

const SEGMENTS = [
  { kind: "flow", file: "shot 1.mp4", from: 2.0, dur: 4.25, caption: "c-forgot", captionAt: 2.3, punchOut: true },
  // `zoom`: how close the camera is to Tumbli's corner of the screen
  { kind: "screen", clip: "01-idle", from: 0.5, dur: 1.4, zoom: 1.7, caption: "c-meet", punchIn: true },
  { kind: "screen", clip: "04-reminder", from: 0.0, dur: 4.15, caption: "c-reminds" },
  { kind: "flow", file: "shot 2.mp4", from: 3.5, dur: 1.9 },
  { kind: "screen", clip: "03-drink", from: 0.6, dur: 3.0, zoom: 1.4, caption: "c-click" },
  { kind: "screen", clip: "05-goal", from: 1.0, dur: 2.0, zoom: 1.7, caption: "c-goal" },
  { kind: "screen", clip: "07-outfits", from: 0, dur: 2.2, speed: 3, zoom: 1.7, caption: "c-outfits" },
  { kind: "flow", file: "shot 3.mp4", from: 4.3, dur: 1.4 },
  { kind: "endcard", dur: 3.5 },
];
let t = 0;
for (const s of SEGMENTS) {
  s.start = t;
  t += s.dur;
}
const LENGTH = t;
const at = (i, dt = 0) => SEGMENTS[i].start + dt;

// sound effects: [name, time, gain]
const SFX = [
  ["pop", at(0, 2.3), 0.35],
  ["whoosh", at(1) - 0.22, 0.55],
  ["pop", at(1, 0.1), 0.35],
  ["bloop", at(2, 0.05), 0.5],
  ["pop", at(2, 0.15), 0.3],
  ["whoosh", at(3) - 0.2, 0.45],
  ["whoosh", at(4) - 0.2, 0.45],
  ["pop", at(4, 0.1), 0.3],
  ["click", at(4, 1.3), 0.7],
  ["gulp", at(4, 1.4), 0.5],
  ["pop", at(5, 0.1), 0.3],
  ["click", at(5, 0.9), 0.7],
  ["sparkle", at(5, 1.0), 0.45],
  ["pop", at(6, 0.1), 0.3],
  ...[0.5, 1.0, 1.5, 2.0].map((d) => ["pop", at(6, d), 0.22]),
  ["whoosh", at(7) - 0.2, 0.45],
  ["whoosh", at(8) - 0.2, 0.5],
  ["boing", at(8, 0.15), 0.5],
  ["sparkle", at(8, 1.0), 0.35],
];

// ------------------------------------------------------------------ graphics

const FONTS = `<link rel="stylesheet" href="/node_modules/@fontsource-variable/fredoka/index.css">
<link rel="stylesheet" href="/node_modules/@fontsource-variable/nunito/index.css">`;

/** a caption: big rounded words, the key one in water blue */
const caption = (html, { width = W, scrim = false } = {}) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html,body{margin:0;background:transparent}
  .c{width:${width}px;height:520px;display:flex;align-items:center;justify-content:center;text-align:center;
     font:600 104px/1.02 "Fredoka Variable",sans-serif;color:#fff;letter-spacing:-1px;
     text-shadow:0 4px 0 rgba(8,22,38,.55),0 10px 40px rgba(0,0,0,.55)}
  em{font-style:normal;color:#7fd0ff}
  ${scrim ? ".c{background:radial-gradient(60% 50% at 50% 50%,rgba(6,18,30,.62),rgba(6,18,30,0) 100%)}" : ""}
</style></head><body><div class="c"><div>${html}</div></div></body></html>`;

const CAPTIONS = {
  "c-forgot": caption("Forgot to drink<br>water <em>again?</em>", { scrim: true }),
  "c-meet": caption("Meet <em>Tumbli</em>", { width: SCREEN.w }),
  "c-reminds": caption("It reminds you,<br><em>gently</em>", { width: SCREEN.w }),
  "c-click": caption("Log a drink<br>in <em>one click</em>", { width: SCREEN.w }),
  "c-goal": caption("Hit your <em>goal</em>", { width: SCREEN.w }),
  "c-outfits": caption("Unlock <em>outfits</em>", { width: SCREEN.w }),
};

/** the laptop bezel, with a see-through screen */
const bezel = `<!doctype html><html><head><style>
  html,body{margin:0;background:transparent;width:${W}px;height:${H}px;overflow:hidden}
  .hole{position:absolute;left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.w}px;height:${SCREEN.h}px;border-radius:${SCREEN.r}px;
        box-shadow:0 0 0 400px #0a0d12, inset 0 0 0 2px rgba(255,255,255,.06), inset 0 0 40px rgba(0,0,0,.35)}
  .glare{position:absolute;left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.w}px;height:${SCREEN.h}px;border-radius:${SCREEN.r}px;
        background:linear-gradient(125deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 32%)}
  .edge{position:absolute;inset:0;border-radius:0;box-shadow:inset 0 0 0 3px #1a1f27}
  .cam{position:absolute;left:${W / 2 - 9}px;top:23px;width:18px;height:18px;border-radius:50%;
       background:radial-gradient(circle at 35% 35%,#3a4656,#11161d 60%);box-shadow:0 0 0 3px #151a21}
  .led{position:absolute;left:${W / 2 + 22}px;top:30px;width:5px;height:5px;border-radius:50%;background:#2fd17a;box-shadow:0 0 6px #2fd17a}
</style></head><body><div class="hole"></div><div class="glare"></div><div class="edge"></div><div class="cam"></div><div class="led"></div></body></html>`;

/** the end card: the laptop screen shows Tumbli's logo and the offer */
const endcard = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html,body{margin:0;width:${SCREEN.w}px;height:${SCREEN.h}px;overflow:hidden}
  body{background:radial-gradient(60% 40% at 50% 38%,rgba(58,163,240,.45),transparent 70%),
       radial-gradient(80% 50% at 20% 100%,rgba(32,164,127,.22),transparent 70%),
       linear-gradient(170deg,#123150 0%,#0b1f33 55%,#07131f 100%);
       font-family:"Fredoka Variable",sans-serif;color:#fff;position:relative}
  .stack{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding-bottom:120px}
  .icon{width:330px;height:330px;filter:drop-shadow(0 30px 50px rgba(0,0,0,.45));opacity:0;transform:scale(.2) rotate(-12deg)}
  .go .icon{animation:pop .9s cubic-bezier(.2,1.6,.4,1) .1s forwards, float 2.6s ease-in-out 1.1s infinite}
  @keyframes pop{to{opacity:1;transform:scale(1) rotate(0)}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
  .name{margin-top:36px;font-weight:700;font-size:168px;letter-spacing:-3px;line-height:1;display:flex}
  .name span{display:inline-block;opacity:0;transform:translateY(60px)}
  .go .name span{animation:rise .55s cubic-bezier(.2,1.4,.4,1) forwards}
  @keyframes rise{to{opacity:1;transform:none}}
  .tag{margin-top:22px;font:600 46px "Nunito Variable",sans-serif;color:#a9c3d8;opacity:0}
  .go .tag{animation:fade .5s ease-out .95s forwards}
  @keyframes fade{to{opacity:1}}
  .pill{margin-top:70px;position:relative;overflow:hidden;padding:30px 54px;border-radius:999px;
        background:linear-gradient(135deg,#3aa3f0,#1e6fd0);font-weight:600;font-size:58px;letter-spacing:-.5px;
        box-shadow:0 20px 50px -14px rgba(30,143,225,.75),inset 0 2px 0 rgba(255,255,255,.25);opacity:0;transform:scale(.6)}
  .pill small{display:block;font:700 30px "Nunito Variable",sans-serif;letter-spacing:5px;text-transform:uppercase;color:#d9efff;margin-bottom:6px;text-align:center}
  .go .pill{animation:pill .6s cubic-bezier(.2,1.5,.4,1) 1.15s forwards}
  @keyframes pill{to{opacity:1;transform:scale(1)}}
  .pill::after{content:"";position:absolute;top:0;bottom:0;width:120px;left:-160px;transform:skewX(-20deg);
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)}
  .go .pill::after{animation:shine 1s ease-in-out 2.1s forwards}
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
    .map(([x, y, d]) => `<i class="spark" style="left:${x}px;top:${y}px;animation-delay:${1 + d}s"></i>`)
    .join("")}
  <div class="stack">
    <img class="icon" src="/app-icon.svg">
    <div class="name">${[..."Tumbli"].map((c, i) => `<span style="animation-delay:${0.45 + i * 0.06}s">${c}</span>`).join("")}</div>
    <div class="tag">Your water buddy for Windows</div>
    <div class="pill"><small>Get it free on the</small>Microsoft Store</div>
  </div>
  <div class="bar">${["#F5A623", "#1B8FD8", "#3A5BD9", "#7D4BD6", "#E5534B"].map((c) => `<span style="background:${c}"></span>`).join("")}<img src="/app-icon.svg" width="62" height="62"></div>
</body></html>`;

// ------------------------------------------------------------------ helpers

const run = (args) => execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "inherit", "inherit"] });
const ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-an"];

/** zoompan expression: a slow push-in, with optional punches at the start/end */
function zoom(seg, frames) {
  const base = `(1+0.035*on/${frames})`;
  if (seg.punchIn) return `if(lt(on,9),1.22-0.22*on/9,${base})`;
  if (seg.punchOut) return `if(gt(on,${frames - 9}),${base}+0.5*pow((on-${frames - 9})/9,2),${base})`;
  return base;
}

// ------------------------------------------------------------------ build

rmSync(join(BUILD, "seg"), { recursive: true, force: true });
for (const d of [BUILD, WEB, join(BUILD, "seg"), join(BUILD, "png"), join(BUILD, "sfx"), join(BUILD, "end")]) mkdirSync(d, { recursive: true });

// 1. sound
music(join(BUILD, "music.wav"), LENGTH);
sfx(join(BUILD, "sfx"));
console.log("music and sound effects ready");

// 2. graphics from the browser
writeFileSync(join(WEB, "bezel.html"), bezel);
writeFileSync(join(WEB, "endcard.html"), endcard);
for (const [k, html] of Object.entries(CAPTIONS)) writeFileSync(join(WEB, `${k}.html`), html);
await new Promise((r) => setTimeout(r, 800)); // let the dev server notice the new files

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--hide-scrollbars"] });
try {
  const shot = async (name, w, h, file) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const cdp = await page.createCDPSession();
    await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    await page.goto(`${DEV}/store-assets/ad/.build/web/${name}.html`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, omitBackground: true });
    await page.close();
  };
  await shot("bezel", W, H, join(BUILD, "png", "bezel.png"));
  for (const k of Object.keys(CAPTIONS)) await shot(k, k === "c-forgot" ? W : SCREEN.w, 520, join(BUILD, "png", `${k}.png`));

  // the end card, frame by frame on a stepped clock so the animation is smooth
  const page = await browser.newPage();
  await page.setViewport({ width: SCREEN.w, height: SCREEN.h, deviceScaleFactor: 1 });
  await page.goto(`${DEV}/store-assets/ad/.build/web/endcard.html`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
  await page.evaluate(() => document.body.classList.add("go"));
  const endFrames = Math.round(SEGMENTS.at(-1).dur * FPS);
  for (let f = 0; f < endFrames; f++) {
    await new Promise((ok) => {
      cdp.once("Emulation.virtualTimeBudgetExpired", ok);
      void cdp.send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: 1000 / FPS });
    });
    await page.screenshot({ path: join(BUILD, "end", `${String(f).padStart(5, "0")}.png`) });
  }
} finally {
  await browser.close();
}
console.log("graphics ready");

// 3. one video per segment
const parts = [];
SEGMENTS.forEach((seg, i) => {
  const frames = Math.round(seg.dur * FPS);
  const out = join(BUILD, "seg", `${String(i).padStart(2, "0")}.mp4`);
  const inputs = [];
  let chain;
  if (seg.kind === "flow") {
    // Flow shots fill the frame; their own audio is never used
    inputs.push("-ss", String(seg.from), "-t", String(seg.dur), "-i", join(SRC, seg.file));
    chain = `[0:v]fps=${FPS},scale=${W * 1.5}:${H * 1.5},setsar=1,`;
  } else {
    const src =
      seg.kind === "endcard"
        ? ["-framerate", String(FPS), "-i", join(BUILD, "end", "%05d.png")]
        : ["-ss", String(seg.from), "-t", String(seg.dur * (seg.speed ?? 1)), "-i", join(CLIPS, `${seg.clip}-clean.mp4`)];
    inputs.push(...src, "-i", join(BUILD, "png", "bezel.png"));
    const speed = seg.speed ? `setpts=PTS/${seg.speed},` : "";
    // closer to Tumbli: keep the bottom-right part of the screen, where it's docked
    const z = seg.zoom ?? 1;
    const cw = Math.round(W / z / 2) * 2;
    const chh = Math.round(H / z / 2) * 2;
    const crop = z > 1 ? `crop=${cw}:${chh}:${W - cw}:${H - chh},` : "";
    // inside the laptop screen
    chain =
      `[0:v]${speed}${crop}fps=${FPS},scale=${SCREEN.w}:${SCREEN.h},pad=${W}:${H}:${SCREEN.x}:${SCREEN.y}:color=0x0a0d12[s];` +
      `[s][1:v]overlay=0:0,scale=${W * 1.5}:${H * 1.5},setsar=1,`;
  }
  chain += `zoompan=z='${zoom(seg, frames)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}`;
  if (seg.caption) {
    const ci = seg.kind === "flow" ? 1 : 2;
    inputs.push("-loop", "1", "-t", String(seg.dur), "-i", join(BUILD, "png", `${seg.caption}.png`));
    const t0 = seg.captionAt ?? 0.1;
    const x = seg.caption === "c-forgot" ? 0 : SCREEN.x;
    const y = seg.caption === "c-forgot" ? 200 : SCREEN.y + 150;
    chain +=
      `[v];[${ci}:v]format=rgba,fade=t=in:st=${t0}:d=0.25:alpha=1[c];` +
      `[v][c]overlay=x=${x}:y='${y}+46*max(0,1-(t-${t0})/0.3)':enable='gte(t,${t0})':shortest=1`;
  }
  run([...inputs, "-filter_complex", `${chain},trim=end_frame=${frames},format=yuv420p`, ...ENC, out]);
  parts.push(out);
  console.log(`segment ${i + 1}/${SEGMENTS.length}`);
});

const list = join(BUILD, "segments.txt");
writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
const video = join(BUILD, "video.mp4");
run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", video]);

// 4. sound mix: voice-over on top, music ducked under it, effects on cue
const aIn = ["-i", join(BUILD, "music.wav"), "-i", join(SRC, "voice over.mp3")];
SFX.forEach(([name]) => aIn.push("-i", join(BUILD, "sfx", `${name}.wav`)));
const ms = (s) => Math.max(0, Math.round(s * 1000));
let graph =
  `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,highpass=f=80,adelay=${ms(VO_DELAY)}|${ms(VO_DELAY)},` +
  `apad=whole_dur=${LENGTH},volume=1.15,asplit=2[vo][key];` +
  `[0:a]volume=0.55[m];[m][key]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=400[mus];`;
SFX.forEach(([, time, gain], k) => {
  graph += `[${k + 2}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${gain},adelay=${ms(time)}|${ms(time)}[s${k}];`;
});
graph +=
  `[vo][mus]${SFX.map((_, k) => `[s${k}]`).join("")}amix=inputs=${SFX.length + 2}:normalize=0:duration=first,` +
  `alimiter=limit=0.9,atrim=0:${LENGTH}[out]`;
const audio = join(BUILD, "mix.wav");
run([...aIn, "-filter_complex", graph, "-map", "[out]", audio]);

// 5. together
run(["-i", video, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT]);
console.log("wrote", OUT, `(${LENGTH.toFixed(1)} s)`);
