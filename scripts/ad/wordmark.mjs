// The Tumbli wordmark: "Tumbl" in Fredoka, and an "i" that is a little tumbler whose
// floating cap is the dot. Used by the ad's end card and the brand images.
//
// wordmark({ size, animate }) returns { css, html }. `size` is the font size in px.
// With `animate`, letters rise in and the cap drops onto the "i" once `.go` is set on <body>.

/** the tumbler "i", drawn on a 52 x 170 grid (1 unit = 1 px at a 168 px font size) */
const tumblerI = (id) => `<svg class="wm-i" viewBox="0 0 52 170" aria-hidden="true">
  <defs><clipPath id="${id}"><path d="M3 92 Q3 80 15 79 L37 79 Q49 80 49 92 L49 160 Q49 170 39 170 L13 170 Q3 170 3 160 Z"/></clipPath></defs>
  <g class="wm-body">
    <rect x="17" y="71" width="18" height="10" rx="2.5" fill="var(--wm-neck)"/>
    <path d="M3 92 Q3 80 15 79 L37 79 Q49 80 49 92 L49 160 Q49 170 39 170 L13 170 Q3 170 3 160 Z" fill="var(--wm-ink)"/>
    <g clip-path="url(#${id})"><path d="M0 124 Q13 117 26 124 T52 124 V170 H0Z" fill="var(--wm-water)"/></g>
    <path d="M11 96 L11 140" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>
  </g>
  <g class="wm-cap">
    <path d="M18 41 L18 33 Q18 27 24 27 L28 27 Q34 27 34 33 L34 41" fill="none" stroke="var(--wm-cap)" stroke-width="5" stroke-linejoin="round"/>
    <rect x="8" y="40" width="36" height="17" rx="5.5" fill="var(--wm-cap)"/>
    <rect x="12" y="44" width="28" height="3.4" rx="1.7" fill="#fff" opacity=".5"/>
  </g>
</svg>`.replace(/\n\s*/g, ""); // no whitespace: it would show as a gap before the "i"

let n = 0;
export function wordmark({ size = 168, ink = "#fff", water = "#3aa3f0", cap = "#4cc2ff", neck = "#c9d6e3", animate = false, delay = 0 } = {}) {
  const k = size / 168;
  const id = `wm-clip-${n++}`;
  const letters = [..."Tumbl"]
    .map((c, i) => `<span class="wm-l" style="animation-delay:${(delay + i * 0.05).toFixed(2)}s">${c}</span>`)
    .join("");
  const css = `
  .wm{--wm-ink:${ink};--wm-water:${water};--wm-cap:${cap};--wm-neck:${neck};
      font:700 ${size}px/1 "Fredoka Variable",sans-serif;letter-spacing:${(-3 * k).toFixed(1)}px;color:var(--wm-ink);white-space:nowrap}
  .wm-l{display:inline-block}
  /* an inline svg sits on the text baseline with its bottom edge */
  .wm-i{display:inline-block;width:${(52 * k).toFixed(1)}px;height:${(170 * k).toFixed(1)}px;margin-left:${(15 * k).toFixed(1)}px;overflow:visible}
  .wm-cap{transform-box:fill-box;transform-origin:50% 100%}
  ${
    animate
      ? `.wm-l,.wm-body{opacity:0;transform:translateY(${(60 * k).toFixed(0)}px)}
  .wm-body{transform-box:fill-box}
  .wm-cap{opacity:0;transform:translateY(-${(220 * k).toFixed(0)}px)}
  .go .wm-l{animation:wm-rise .5s cubic-bezier(.2,1.4,.4,1) forwards}
  .go .wm-body{animation:wm-rise .5s cubic-bezier(.2,1.4,.4,1) ${(delay + 0.25).toFixed(2)}s forwards}
  .go .wm-cap{animation:wm-drop .7s cubic-bezier(.3,1.6,.5,1) ${(delay + 0.55).toFixed(2)}s forwards, wm-bob 2.2s ease-in-out ${(delay + 1.3).toFixed(2)}s infinite}
  @keyframes wm-rise{to{opacity:1;transform:none}}
  @keyframes wm-drop{to{opacity:1;transform:none}}
  @keyframes wm-bob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-${(8 * k).toFixed(0)}px) rotate(-7deg)}}`
      : `.wm-cap{transform:rotate(-8deg)}`
  }`;
  return { css, html: `<span class="wm">${letters}${tumblerI(id)}</span>` };
}
