// Tiny WebAudio blips. No assets; degrades silently if audio is unavailable.

let ctx = null;
let enabled = true;
let muted = false;

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

function ac() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    enabled = false;
  }
  return ctx;
}

// Browsers require a user gesture before audio; call this on first click/key.
export function resumeAudio() {
  const c = ac();
  if (c && c.state === "suspended") c.resume();
}

function blip(freq, dur, type = "square", gain = 0.06) {
  if (!enabled || muted) return;
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  const now = c.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.start(now);
  o.stop(now + dur);
}

export const Sfx = {
  hitLight: () => blip(420, 0.07, "square"),
  hitHeavy: () => blip(180, 0.14, "sawtooth", 0.08),
  block: () => blip(700, 0.05, "triangle", 0.05),
  special: () => { blip(300, 0.18, "sawtooth", 0.09); blip(600, 0.2, "square", 0.05); },
  jump: () => blip(520, 0.08, "sine", 0.04),
  select: () => blip(660, 0.06, "square", 0.05),
  ko: () => { blip(140, 0.4, "sawtooth", 0.1); },
};
