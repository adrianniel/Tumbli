// Renders the Microsoft Store screenshots (1920x1080) from HTML scenes with headless Edge.
// Usage: npm run screenshots   ->  store-assets/screenshots/*.png
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "store-assets", "screenshots");
const srcDir = join(outDir, "src");
mkdirSync(srcDir, { recursive: true });

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!EDGE) throw new Error("Microsoft Edge not found");

const INK = "#0E3F6E";
const BODY = "M27 41 Q27 30 39 28 L61 28 Q73 30 73 41 L73 90 Q73 97 66 97 L34 97 Q27 97 27 90 Z";
let clipId = 0;

/** Same drawing as src/components/Tumbler.tsx, as a static SVG string. */
function bottle({ fill = 0.4, h = 300, mood = "normal", arms = true, wave = false } = {}) {
  const id = `c${clipId++}`;
  const top = 97 - Math.max(0, Math.min(1, fill)) * 69;
  const eyes =
    mood === "sleeping"
      ? `<path d="M40.5 52 Q43.5 55 46.5 52" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M53.5 52 Q56.5 55 59.5 52" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
      : mood === "happy"
        ? `<path d="M40.5 53 Q43.5 49 46.5 53" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M53.5 53 Q56.5 49 59.5 53" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
        : `<ellipse cx="43.5" cy="52" rx="3" ry="3.6" fill="${INK}"/><ellipse cx="56.5" cy="52" rx="3" ry="3.6" fill="${INK}"/><circle cx="44.6" cy="50.6" r="1" fill="#fff"/><circle cx="57.6" cy="50.6" r="1" fill="#fff"/>`;
  const mouth =
    mood === "calling"
      ? `<ellipse cx="50" cy="61" rx="2.6" ry="3" fill="${INK}"/>`
      : `<path d="M45.5 59.5 Q50 63.5 54.5 59.5" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const armR = wave ? "M72 64 Q82 56 84 46" : "M72 66 Q80 62 82 54";
  return `<svg width="${Math.round(h * 0.7)}" height="${h}" viewBox="15 0 70 100" overflow="visible">
  <defs><clipPath id="${id}"><path d="${BODY}"/></clipPath></defs>
  ${arms ? `<path d="M28 66 Q20 70 19 78" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="${armR}" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>` : ""}
  <path d="${BODY}" fill="#D3E9FB"/>
  <g clip-path="url(#${id})">
    <path d="M0 ${top} Q12.5 ${top - 2.5} 25 ${top} T50 ${top} T75 ${top} T100 ${top} V100 H0 Z" fill="#2E8BE6"/>
    <rect x="0" y="90" width="100" height="10" fill="${INK}"/>
  </g>
  <path d="${BODY}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M33 45 L33 82" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity="0.55"/>
  <rect x="38" y="22" width="24" height="7" rx="1.5" fill="#C9D6E3" stroke="${INK}" stroke-width="2.2"/>
  <path d="M41 12 L41 6.5 Q41 2.5 45 2.5 L55 2.5 Q59 2.5 59 6.5 L59 12" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <rect x="34" y="11" width="32" height="12" rx="3.5" fill="${INK}"/>
  <rect x="37" y="13.5" width="26" height="2.2" rx="1.1" fill="#2E8BE6" opacity="0.8"/>
  ${eyes}${mouth}
  <ellipse cx="37" cy="58.5" rx="3.4" ry="2" fill="#FF8FA6"/><ellipse cx="63" cy="58.5" rx="3.4" ry="2" fill="#FF8FA6"/>
</svg>`;
}

const badge = (t, size = 26) =>
  `<span style="display:inline-block;padding:3px ${size / 2}px;border-radius:999px;background:${INK};color:#fff;font-weight:700;font-size:${size}px">${t}</span>`;
const shadow = (w) =>
  `<div style="width:${w}px;height:${w / 6}px;border-radius:50%;background:rgba(14,63,110,.22);margin-top:-6px"></div>`;

function page(title, sub, scene) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{margin:0;width:1920px;height:1080px;overflow:hidden;font-family:"Segoe UI Variable Display","Segoe UI",sans-serif;background:#E6F2FC;color:#0F2A44}
  .wrap{display:flex;height:100%;align-items:center;padding:0 120px;gap:80px}
  .copy{width:640px;flex:none} h1{font-size:76px;line-height:1.05;margin:0 0 24px;font-weight:700;letter-spacing:-1px} p{font-size:30px;line-height:1.45;margin:0;color:#3E5A76}
  .scene{flex:1;height:820px;border-radius:36px;background:#1B2633;position:relative;overflow:hidden}
  .win{position:absolute;border-radius:18px;background:#243244}
  .line{height:16px;border-radius:8px;background:#33465C;margin:14px 0}
  .bubble{background:#fff;border-radius:28px;padding:26px 30px;box-shadow:0 8px 24px rgba(0,0,0,.25);position:relative}
  .btn{border:none;border-radius:16px;padding:14px 22px;font:600 22px "Segoe UI",sans-serif}
  .row{display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-top:1px solid #E3ECF5;font-size:24px}
  </style></head><body><div class="wrap"><div class="copy"><h1>${title}</h1><p>${sub}</p></div><div class="scene">${scene}</div></div></body></html>`;
}

const fakeWindows = `
  <div class="win" style="left:60px;top:60px;width:620px;height:420px;padding:40px">
    <div class="line" style="width:60%"></div><div class="line"></div><div class="line" style="width:85%"></div><div class="line" style="width:70%"></div><div class="line" style="width:90%"></div>
  </div>
  <div class="win" style="left:300px;top:300px;width:520px;height:340px;padding:40px;background:#2A3A4F">
    <div class="line" style="width:40%"></div><div class="line" style="width:95%"></div><div class="line" style="width:75%"></div>
  </div>`;

const scenes = {
  "1-reminder": page(
    "Your floating water buddy",
    "Tumbli lives on your desktop and hops up with a friendly nudge when it's time to drink.",
    `${fakeWindows}
    <div style="position:absolute;right:60px;bottom:60px;display:flex;align-items:flex-end;gap:18px">
      <div class="bubble" style="width:430px;margin-bottom:150px">
        <div style="font-size:30px;font-weight:700">Time to drink!</div>
        <div style="font-size:21px;color:#4A6480;margin:6px 0 18px">3 of 8 glasses today · 🔥 5</div>
        <div style="display:flex;gap:10px"><button class="btn" style="flex:1;background:#2E8BE6;color:#fff">💧 I drank!</button><button class="btn" style="background:#E3F0FC;color:#0F2A44">⏰ 10m</button></div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center">${bottle({ fill: 0.38, h: 300, mood: "calling", wave: true })}${shadow(130)}<div style="margin-top:12px">${badge("3/8")}</div></div>
    </div>`,
  ),
  "2-progress": page(
    "Watch it fill up",
    "Every glass you log fills Tumbli a little more. Hit your daily goal and keep your streak going.",
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-evenly">
      ${[
        [0, "0/8", "normal"],
        [0.5, "4/8", "normal"],
        [1, "8/8", "happy"],
      ]
        .map(
          ([f, t, m]) =>
            `<div style="display:flex;flex-direction:column;align-items:center">${bottle({ fill: f, h: 340, mood: m })}${shadow(140)}<div style="margin-top:16px">${badge(t, 30)}</div></div>`,
        )
        .join("")}
    </div>`,
  ),
  "3-out-of-the-way": page(
    "Stays out of your way",
    "Reminders only during your hours. Quiet when you're away, hidden during fullscreen games and videos, and you can pause anytime.",
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:90px">
      <div style="display:flex;flex-direction:column;align-items:center;position:relative">
        <div style="position:absolute;top:-10px;right:-40px;font:800 56px 'Segoe UI';color:#7FB8E8">z<span style="font-size:38px">z</span></div>
        ${bottle({ fill: 0.6, h: 380, mood: "sleeping" })}${shadow(160)}<div style="margin-top:16px">${badge("Paused", 28)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:22px">
        ${["Active hours only", "Quiet while you're away", "Hides in fullscreen", "Pause 1 hour or until tomorrow"]
          .map(
            (t) =>
              `<div style="background:#243244;color:#E6F2FF;border-radius:20px;padding:22px 30px;font-size:28px;font-weight:600;width:470px">✓ ${t}</div>`,
          )
          .join("")}
      </div>
    </div>`,
  ),
  "4-setup": page(
    "Set up in seconds",
    "Pick your daily goal, glass size and how often to be reminded. No account, no ads, nothing leaves your PC.",
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
      <div style="width:620px;background:#fff;border-radius:32px;padding:44px 48px;text-align:center;box-shadow:0 12px 32px rgba(0,0,0,.3)">
        <div style="display:flex;justify-content:center">${bottle({ fill: 0.35, h: 170, wave: true })}</div>
        <div style="font-size:42px;font-weight:700;margin:12px 0 6px">Hi, I'm Tumbli!</div>
        <div style="font-size:22px;color:#4A6480;margin-bottom:18px">I'll remind you to drink water while you work.</div>
        <div style="text-align:left">
          <div class="row"><span>Daily goal</span><b>8 glasses</b></div>
          <div class="row"><span>Glass size</span><b>250 ml</b></div>
          <div class="row"><span>Remind me every</span><b>45 minutes</b></div>
          <div class="row"><span>Start with Windows</span><b style="color:#2E8BE6">On</b></div>
        </div>
        <button class="btn" style="width:100%;margin-top:22px;background:#2E8BE6;color:#fff;font-size:26px;padding:18px">Let's go 💧</button>
      </div>
    </div>`,
  ),
};

// a throwaway profile, so a running Edge window doesn't swallow the headless request
const profile = mkdtempSync(join(tmpdir(), "tumbli-shots-"));

for (const [name, html] of Object.entries(scenes)) {
  const src = join(srcDir, `${name}.html`);
  writeFileSync(src, html);
  const out = join(outDir, `${name}.png`);
  execFileSync(EDGE, [
    "--headless=new",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1920,1080",
    `--screenshot=${out}`,
    pathToFileURL(src).href,
  ]);
  if (!existsSync(out)) throw new Error(`Edge did not write ${out}`);
  console.log("wrote", out);
}
try {
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
} catch {
  // Edge can hold the profile a moment longer; it's in the temp folder anyway
}
