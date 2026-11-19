// A Windows-style laptop taskbar (generic app icons, no real brands) for the ad clips and
// the end card. `s` scales it: 1 = the real 48 px taskbar. The clips' screen is narrow, so
// the apps sit on the left (a Windows option) and the tray on the right.
export function taskbarHtml({ s = 2, dev = "http://localhost:1420", weather = false } = {}) {
  const px = (n) => `${Math.round(n * s)}px`;
  const ico = (path, size = 16, extra = "") =>
    `<svg viewBox="0 0 24 24" width="${px(size)}" height="${px(size)}" fill="none" stroke="#e8ecf1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${path}</svg>`;
  const tile = (bg, inner) =>
    `<span style="width:${px(40)};height:${px(40)};border-radius:${px(6)};display:grid;place-items:center">` +
    `<span style="width:${px(24)};height:${px(24)};border-radius:${px(6)};background:${bg};display:grid;place-items:center;box-shadow:inset 0 ${px(-1)} 0 rgba(0,0,0,.15)">${inner}</span></span>`;
  const white = (path) => `<svg viewBox="0 0 24 24" width="${px(15)}" height="${px(15)}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const apps = [
    tile("linear-gradient(#ffd45c,#f5a623)", `<svg viewBox="0 0 24 24" width="${px(15)}" height="${px(15)}"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#fff"/></svg>`),
    tile("linear-gradient(#3dd6c4,#1b8fd8)", white('<circle cx="12" cy="12" r="7.5"/><path d="M4.5 12h15M12 4.5c3 3.5 3 11.5 0 15M12 4.5c-3 3.5-3 11.5 0 15"/>')),
    tile("linear-gradient(#5b8def,#3a5bd9)", white('<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4.5 7l7.5 6 7.5-6"/>')),
    tile("linear-gradient(#ff8a7a,#e5534b)", white('<rect x="4.5" y="5.5" width="15" height="14" rx="2"/><path d="M4.5 10h15M9 3.5v4M15 3.5v4"/>')),
  ];
  const tumbli =
    `<span style="position:relative;width:${px(40)};height:${px(40)};border-radius:${px(6)};background:rgba(255,255,255,.09);display:grid;place-items:center">` +
    `<img src="${dev}/app-icon.svg" width="${Math.round(26 * s)}" height="${Math.round(26 * s)}">` +
    `<span style="position:absolute;bottom:${px(2)};left:50%;width:${px(16)};height:${px(3)};margin-left:${px(-8)};border-radius:${px(2)};background:#4cc2ff"></span></span>`;
  const search =
    `<span style="width:${px(40)};height:${px(40)};display:grid;place-items:center">${ico('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>', 18)}</span>`;
  const weatherBox = weather
    ? `<span style="position:absolute;left:${px(10)};top:0;bottom:0;display:flex;align-items:center;gap:${px(7)};color:#e8ecf1;font-size:${px(12)};line-height:1.25">` +
      `<svg viewBox="0 0 24 24" width="${px(22)}" height="${px(22)}"><circle cx="12" cy="12" r="5" fill="#ffc83d"/><g stroke="#ffc83d" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g></svg>` +
      `<span><b style="font-weight:600">31°C</b><br><span style="color:#aeb8c4">Sunny</span></span></span>`
    : "";
  const tray =
    `<span style="position:absolute;right:${px(10)};top:0;bottom:0;display:flex;align-items:center;gap:${px(11)};color:#e8ecf1;font-size:${px(12)}">` +
    ico('<path d="M6 15l6-6 6 6"/>', 13) +
    `<img src="${dev}/app-icon.svg" width="${Math.round(16 * s)}" height="${Math.round(16 * s)}">` +
    `<span style="display:flex;align-items:center;gap:${px(7)};padding:${px(5)} ${px(6)};border-radius:${px(5)}">` +
    ico('<path d="M3 9a14 14 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="19" r="1" fill="#e8ecf1"/>', 15) +
    ico('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>', 15) +
    `<svg viewBox="0 0 24 24" width="${px(17)}" height="${px(15)}" fill="none" stroke="#e8ecf1" stroke-width="1.8"><rect x="2.5" y="7" width="17" height="10" rx="2.5"/><rect x="5" y="9.5" width="10" height="5" rx="1" fill="#e8ecf1" stroke="none"/><path d="M21.5 10.5v3" stroke-linecap="round"/></svg></span>` +
    `<span style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.3"><span>10:24 AM</span><span>11/19/2026</span></span>` +
    ico('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>', 14) +
    `</span>`;
  return (
    `<div style="position:absolute;left:0;right:0;bottom:0;height:${px(48)};background:rgba(30,33,39,.94);` +
    `border-top:${px(1)} solid rgba(255,255,255,.08);font-family:'Segoe UI Variable Text','Segoe UI',sans-serif;` +
    `display:flex;align-items:center;justify-content:flex-start;padding-left:${px(8)};gap:${px(4)}">` +
    `${weatherBox}${search}${apps.join("")}${tumbli}${tray}</div>`
  );
}
