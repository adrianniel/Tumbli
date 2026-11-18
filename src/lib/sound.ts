/** A short water "bloop", synthesized so no audio file is needed. */
export function bloop() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(950, t + 0.16);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // audio unavailable: stay silent
  }
}
