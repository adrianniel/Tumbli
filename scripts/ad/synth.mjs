// Original background music and sound effects for the Tumbli ad, made from scratch
// (no samples, nothing licensed), written as 16-bit stereo WAV files.
import { writeFileSync } from "node:fs";

export const SR = 44100;

// ------------------------------------------------------------------ helpers

function wav(file, left, right = left) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const g = 0.89 / peak; // normalize
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * g)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * g)) * 32767), 46 + i * 4);
  }
  writeFileSync(file, buf);
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// deterministic noise, so every build sounds the same
let seed = 12345;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296 - 0.5;
};

/** state-variable filter; returns a function sample -> {low, band, high} */
function svf() {
  let low = 0;
  let band = 0;
  return (x, fc, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
    low += f * band;
    const high = x - low - q * band;
    band += f * high;
    return { low, band, high };
  };
}

/** add a mono signal into a stereo mix at time t (s) with gain and pan (-1..1) */
function mixIn(L, R, sig, t, gain = 1, pan = 0) {
  const start = Math.round(t * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < sig.length && start + i < L.length; i++) {
    if (start + i < 0) continue;
    L[start + i] += sig[i] * gl;
    R[start + i] += sig[i] * gr;
  }
}

// ------------------------------------------------------------------ voices

/** plucked string (Karplus-Strong): warm, ukulele-ish */
function pluck(freq, dur, bright = 0.5) {
  const n = Math.round(dur * SR);
  const p = Math.max(2, Math.round(SR / freq));
  const buf = new Float32Array(p);
  for (let i = 0; i < p; i++) buf[i] = rnd() * 2;
  const out = new Float32Array(n);
  let idx = 0;
  const decay = 0.996;
  for (let i = 0; i < n; i++) {
    const a = buf[idx];
    const b = buf[(idx + 1) % p];
    const y = decay * (bright * a + (1 - bright) * 0.5 * (a + b));
    out[i] = a;
    buf[idx] = y;
    idx = (idx + 1) % p;
  }
  // soften the attack a touch
  for (let i = 0; i < Math.min(60, n); i++) out[i] *= i / 60;
  return out;
}

function sine(freq, dur, { attack = 0.005, release = 0.2, vib = 0 } = {}) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freq * (1 + vib * Math.sin(2 * Math.PI * 5 * t));
    ph += (2 * Math.PI * f) / SR;
    const env = Math.min(1, t / attack) * Math.min(1, (dur - t) / release);
    out[i] = Math.sin(ph) * Math.max(0, env);
  }
  return out;
}

/** round bass: a sine with a little warmth and a plucky decay */
function bass(freq, dur) {
  const s = sine(freq, dur, { attack: 0.004, release: 0.12 });
  for (let i = 0; i < s.length; i++) s[i] = Math.tanh(1.4 * s[i]) * (0.55 + 0.45 * Math.exp((-i / SR) * 6));
  return s;
}

/** soft pad: detuned triangles through a lowpass */
function pad(notes, dur) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const f = svf();
  const phases = notes.flatMap(() => [0, 0]);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    notes.forEach((m, k) => {
      for (let d = 0; d < 2; d++) {
        const fr = mtof(m) * (d ? 1.004 : 0.996);
        phases[k * 2 + d] = (phases[k * 2 + d] + fr / SR) % 1;
        const ph = phases[k * 2 + d];
        s += 1 - 4 * Math.abs(ph - 0.5); // triangle
      }
    });
    const env = Math.min(1, t / 0.35) * Math.min(1, (dur - t) / 0.4);
    out[i] = f(s / (notes.length * 2), 1400).low * env;
  }
  return out;
}

function kick() {
  const dur = 0.35;
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 48 + 90 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    out[i] = Math.tanh(1.6 * Math.sin(ph) * Math.exp(-t * 9));
  }
  return out;
}

function noiseHit(dur, fc, decay, mode = "band", q = 0.9) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const f = svf();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const r = f(rnd() * 2, fc, q);
    out[i] = r[mode] * Math.exp(-t * decay);
  }
  return out;
}

const clap = () => {
  const a = noiseHit(0.22, 1600, 22, "band", 0.6);
  // three quick bursts like hands
  const out = new Float32Array(a.length);
  for (const off of [0, 0.011, 0.022]) {
    const s = Math.round(off * SR);
    for (let i = 0; i + s < out.length; i++) out[i + s] += a[i] * 0.6;
  }
  return out;
};
const hat = () => noiseHit(0.06, 8000, 70, "high", 0.5);

// ------------------------------------------------------------------ music

/**
 * About 25 s of cozy, upbeat music (112 BPM unless told otherwise): C - Am - F - G.
 * Bars 1-2 are soft (the tired shot); drums come in at bar 3,
 * and it ends on a ringing C chord for the end card, fading out at `length`.
 */
export function music(file, length, bpm = 112) {
  const beat = 60 / bpm;
  const bar = beat * 4;
  const n = Math.round(length * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const chords = [
    [60, 64, 67, 72], // C
    [57, 60, 64, 69], // Am
    [53, 57, 60, 65], // F
    [55, 59, 62, 67], // G
  ];
  const bars = Math.ceil(length / bar);
  const lastFull = bars - 2; // the final bar rings out on C
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const ending = b >= lastFull;
    const ch = ending ? chords[0] : chords[b % 4];
    // pad
    mixIn(L, R, pad(ch.map((m) => m - 12), ending ? length - t0 : bar + 0.05), t0, ending ? 0.3 : 0.2);
    if (ending) {
      // final strum + bell
      ch.forEach((m, k) => mixIn(L, R, pluck(mtof(m + 12), 2.8, 0.45), t0 + k * 0.03, 0.5, -0.2 + k * 0.13));
      mixIn(L, R, sine(mtof(84), 2.5, { release: 2.2 }), t0, 0.18, 0.3);
      mixIn(L, R, sine(mtof(36), 2.4, { release: 1.8 }), t0, 0.55);
      mixIn(L, R, kick(), t0, 0.9);
      break;
    }
    // ukulele-ish arpeggio in 8ths, a little swing
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    pattern.forEach((k, i) => {
      const swing = i % 2 ? beat * 0.06 : 0;
      mixIn(L, R, pluck(mtof(ch[k] + 12), 0.7, 0.5), t0 + (i * beat) / 2 + swing, b < 2 ? 0.55 : 0.62, i % 2 ? 0.35 : -0.25);
    });
    // bass
    const root = ch[0] - 24;
    if (b >= 1) {
      mixIn(L, R, bass(mtof(root), beat * 1.6), t0, 0.3);
      mixIn(L, R, bass(mtof(root), beat * 0.9), t0 + beat * 2, 0.27);
      mixIn(L, R, bass(mtof(root + 7), beat * 0.45), t0 + beat * 3.5, 0.22);
    }
    // drums from bar 3
    if (b >= 2) {
      for (let q = 0; q < 4; q++) {
        if (q === 0 || q === 2) mixIn(L, R, kick(), t0 + q * beat, 0.95);
        if (q === 1 || q === 3) mixIn(L, R, clap(), t0 + q * beat, 0.32, 0.05);
      }
      if (b % 2 === 1) mixIn(L, R, kick(), t0 + beat * 2.5, 0.6);
      for (let e = 0; e < 8; e++) mixIn(L, R, hat(), t0 + (e * beat) / 2 + (e % 2 ? beat * 0.06 : 0), e % 2 ? 0.12 : 0.07, 0.4);
    }
  }
  // fade out the last 0.8 s
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const g = Math.min(1, (length - t) / 0.8, t / 0.15);
    L[i] *= g;
    R[i] *= g;
  }
  wav(file, L, R);
}

// ------------------------------------------------------------------ effects

export function sfx(dir) {
  const out = (name, sig) => wav(`${dir}/${name}.wav`, sig);
  const len = (s) => new Float32Array(Math.round(s * SR));

  // whoosh: noise through a sweeping band-pass
  {
    const dur = 0.5;
    const s = len(dur);
    const f = svf();
    for (let i = 0; i < s.length; i++) {
      const t = i / dur / SR;
      const fc = 300 + 5200 * Math.sin(Math.PI * t) ** 2;
      s[i] = f(rnd() * 2, fc, 0.5).band * Math.sin(Math.PI * t) ** 1.5;
    }
    out("whoosh", s);
  }
  // pop: a quick rising blip (captions)
  {
    const dur = 0.12;
    const s = len(dur);
    let ph = 0;
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      ph += (2 * Math.PI * (520 + 900 * (t / dur))) / SR;
      s[i] = Math.sin(ph) * Math.exp(-t * 30) * Math.min(1, t / 0.003);
    }
    out("pop", s);
  }
  // click: a mouse click
  {
    const s = len(0.05);
    const n = noiseHit(0.05, 4000, 220, "band", 0.4);
    for (let i = 0; i < s.length; i++) s[i] = n[i] + 0.5 * Math.sin((2 * Math.PI * 2600 * i) / SR) * Math.exp((-i / SR) * 260);
    out("click", s);
  }
  // bloop: Tumbli's friendly reminder chime (two soft notes)
  {
    const s = len(0.7);
    const a = sine(mtof(79), 0.5, { release: 0.45 });
    const b = sine(mtof(84), 0.5, { release: 0.45 });
    for (let i = 0; i < a.length; i++) s[i] += a[i] * Math.exp((-i / SR) * 7);
    const off = Math.round(0.13 * SR);
    for (let i = 0; i < b.length && i + off < s.length; i++) s[i + off] += b[i] * Math.exp((-i / SR) * 6);
    out("bloop", s);
  }
  // gulp: three little bubbles
  {
    const s = len(0.45);
    [0, 0.12, 0.25].forEach((t0, k) => {
      const dur = 0.09;
      let ph = 0;
      const off = Math.round(t0 * SR);
      for (let i = 0; i < dur * SR; i++) {
        const t = i / SR;
        ph += (2 * Math.PI * (260 + k * 60 + 1100 * (t / dur) ** 2)) / SR;
        s[off + i] += Math.sin(ph) * Math.sin((Math.PI * t) / dur);
      }
    });
    out("gulp", s);
  }
  // sparkle: a bright arpeggio for the goal
  {
    const s = len(1.2);
    [84, 88, 91, 96, 100].forEach((m, k) => {
      const b = sine(mtof(m), 0.7, { release: 0.65 });
      const off = Math.round(k * 0.06 * SR);
      for (let i = 0; i < b.length && i + off < s.length; i++) s[i + off] += b[i] * Math.exp((-i / SR) * 5) * 0.6;
    });
    out("sparkle", s);
  }
  // thud: a soft camera-punch impact
  {
    const dur = 0.6;
    const s = len(dur);
    let ph = 0;
    const f = svf();
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      ph += (2 * Math.PI * (38 + 80 * Math.exp(-t * 18))) / SR;
      s[i] = Math.tanh(2 * Math.sin(ph) * Math.exp(-t * 6)) + 0.35 * f(rnd() * 2, 900, 0.8).low * Math.exp(-t * 14);
    }
    out("thud", s);
  }
  // boing: the logo popping in on the end card
  {
    const dur = 0.4;
    const s = len(dur);
    let ph = 0;
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      const f = 300 + 260 * Math.sin(t * 38) * Math.exp(-t * 8) + 200 * (t / dur);
      ph += (2 * Math.PI * f) / SR;
      s[i] = Math.sin(ph) * Math.exp(-t * 7) * Math.min(1, t / 0.004);
    }
    out("boing", s);
  }
}
