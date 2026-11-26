// Sound effects, synthesised with Web Audio so there are no audio files to ship or license.
//   tap, release               - a deep keyboard "thock" on the way down, a lighter click on the way up
//   flick, open, close, page   - paper, for folder and page movement

export type SoundName = 'tap' | 'release' | 'flick' | 'open' | 'close' | 'page';
type Noise = { white: AudioBuffer; crinkle: AudioBuffer };

let ctx: AudioContext | null = null, out: GainNode;
const buffers = new WeakMap<BaseAudioContext, Noise>();
const lastPlayed: Partial<Record<SoundName, number>> = {};

// browsers only allow audio after a click or key press, so the context is created on the first one
function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AC) return;
    ctx = new AC(); out = ctx.createGain(); out.gain.value = 0.7; out.connect(ctx.destination);
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}

// white noise for taps, and "crinkle": noise broken into tiny uneven grains, which is what makes it read as paper
function noise(c: BaseAudioContext): Noise {
  let b = buffers.get(c); if (b) return b;
  const n = c.sampleRate, white = c.createBuffer(1, n, n), crinkle = c.createBuffer(1, n, n);
  const w = white.getChannelData(0), k = crinkle.getChannelData(0);
  let level = 0.5, left = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    w[i] = Math.random() * 2 - 1;
    if (left-- <= 0) { left = Math.floor(n * (0.002 + Math.random() * 0.009)); level = 0.12 + Math.random() ** 2 * 0.88; }
    prev = prev * 0.35 + w[i] * 0.65; k[i] = prev * level;
  }
  b = { white, crinkle }; buffers.set(c, b); return b;
}

const jitter = (v: number, amt = 0.08) => v * (1 + (Math.random() * 2 - 1) * amt);

// one filtered slice of noise with a rise-and-fall envelope; the filter can sweep from f0 to f1
interface Burst { buf: AudioBuffer; at: number; dur: number; type: BiquadFilterType; f0: number; f1?: number; q?: number; gain: number; attack?: number }
function burst(c: BaseAudioContext, dest: AudioNode, { buf, at, dur, type, f0, f1 = f0, q = 0.8, gain, attack = 0.002 }: Burst) {
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, at); f.frequency.exponentialRampToValueAtTime(f1, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(at, Math.random() * Math.max(0, buf.duration - dur - 0.05), dur + 0.02);
}

// a short falling sine: the hollow body of a tap, or a folder landing
function thud(c: BaseAudioContext, dest: AudioNode, { at, f0, f1, dur, gain }: { at: number; f0: number; f1: number; dur: number; gain: number }) {
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.02);
}

// A key press is modelled as a sharp contact click plus a few resonances that die away at different speeds:
// the low ones give the weight, the high ones the crispness. [frequency Hz, level, decay seconds]
type Strike = 'down' | 'up';
const KEY: Record<Strike, { click: number; knock: number; level: number; modes: [number, number, number][] }> = {
  down: { click: 0.5, knock: 0.5, level: 0.95, modes: [[150, 0.9, 0.026], [265, 0.45, 0.019], [540, 0.3, 0.011], [1250, 0.24, 0.006], [3100, 0.17, 0.0025], [5400, 0.08, 0.0013]] },
  up: { click: 0.32, knock: 0.18, level: 0.42, modes: [[310, 0.35, 0.011], [760, 0.28, 0.007], [2100, 0.26, 0.003], [4600, 0.14, 0.0014]] },
};
const keyTakes = new WeakMap<BaseAudioContext, Record<Strike, AudioBuffer[]>>();

// a handful of slightly different takes, so repeated presses don't sound like one sample on loop
function keyBuffers(c: BaseAudioContext): Record<Strike, AudioBuffer[]> {
  let takes = keyTakes.get(c); if (takes) return takes;
  const sr = c.sampleRate, n = Math.round(sr * 0.14);
  takes = { down: [], up: [] };
  for (const [name, k] of Object.entries(KEY) as [Strike, (typeof KEY)[Strike]][]) {
    takes[name] = Array.from({ length: 5 }, () => {
      const buf = c.createBuffer(1, n, sr), d = buf.getChannelData(0);
      const modes = k.modes.map(([f, a, tau]) => ({ f: jitter(f, 0.05), a: jitter(a, 0.12), tau, ph: 0 }));
      let low = 0, prev = 0, peak = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        low += (w - low) * 0.14;
        let v = (w - prev) * 0.5 * k.click * Math.exp(-t / 0.0011) + low * 1.8 * k.knock * Math.exp(-t / 0.007);
        prev = w;
        for (const m of modes) {
          m.ph += (2 * Math.PI * m.f * (1 + 0.45 * Math.exp(-t / 0.004))) / sr;     // quick pitch drop = impact
          v += Math.sin(m.ph) * m.a * Math.exp(-t / m.tau);
        }
        d[i] = Math.tanh(v * 1.25) * Math.min(1, t / 0.0004) * Math.min(1, (n - i) / (sr * 0.01));
        peak = Math.max(peak, Math.abs(d[i]));
      }
      for (let i = 0; i < n; i++) d[i] *= k.level / peak;
      return buf;
    });
  }
  keyTakes.set(c, takes); return takes;
}

function key(c: BaseAudioContext, dest: AudioNode, at: number, name: Strike) {
  const takes = keyBuffers(c)[name];
  const src = c.createBufferSource(); src.buffer = takes[Math.floor(Math.random() * takes.length)];
  src.playbackRate.value = jitter(1, 0.025);
  src.connect(dest); src.start(at);
}

type Sound = (c: BaseAudioContext, d: AudioNode, t: number, n: Noise) => void;
const SOUNDS: Record<SoundName, Sound> = {
  tap(c, d, t) { key(c, d, t, 'down'); },
  release(c, d, t) { key(c, d, t, 'up'); },
  flick(c, d, t, { crinkle }) {
    burst(c, d, { buf: crinkle, at: t, dur: jitter(0.13), type: 'bandpass', f0: jitter(1700), f1: jitter(4200), q: 0.7, gain: 0.5, attack: 0.025 });
  },
  open(c, d, t, { crinkle }) {
    burst(c, d, { buf: crinkle, at: t, dur: 0.46, type: 'bandpass', f0: 850, f1: jitter(4300), q: 0.6, gain: 0.62, attack: 0.15 });
    burst(c, d, { buf: crinkle, at: t + 0.2, dur: 0.2, type: 'highpass', f0: 3200, gain: 0.16, attack: 0.04 });
  },
  close(c, d, t, { crinkle }) {
    burst(c, d, { buf: crinkle, at: t, dur: 0.34, type: 'bandpass', f0: jitter(3600), f1: 750, q: 0.6, gain: 0.55, attack: 0.07 });
    burst(c, d, { buf: crinkle, at: t + 0.25, dur: 0.09, type: 'lowpass', f0: 700, gain: 0.4 });
    thud(c, d, { at: t + 0.25, f0: 130, f1: 70, dur: 0.11, gain: 0.2 });
  },
  page(c, d, t, { crinkle }) {
    burst(c, d, { buf: crinkle, at: t, dur: 0.2, type: 'bandpass', f0: 2400, f1: jitter(5200), q: 0.8, gain: 0.45, attack: 0.07 });
    burst(c, d, { buf: crinkle, at: t + 0.15, dur: 0.17, type: 'bandpass', f0: 4200, f1: 1500, q: 0.8, gain: 0.38, attack: 0.02 });
  },
};

// schedule a sound on any audio context (an OfflineAudioContext renders it silently, which is handy for checking levels)
export function render(c: BaseAudioContext, dest: AudioNode, name: SoundName, at = c.currentTime) { SOUNDS[name](c, dest, at, noise(c)); }

export function play(name: SoundName, delay = 0) {
  if (!ctx) return;                                   // nothing has been clicked or typed yet
  const now = performance.now();
  const gap = name === 'tap' || name === 'release' ? 25 : 70;   // fast scrolling shouldn't stack into a buzz
  if (now - (lastPlayed[name] || 0) < gap) return;
  lastPlayed[name] = now;
  render(ctx, out, name, ctx.currentTime + delay);
}

// folder rows and page cards are paper, not keys: they make the paper sound of what they open
const KEYS = 'button:not(.folder-row, .page-card), label.cam-file';

export function wireButtonSounds(root: Document = document): () => void {
  const keyFor = (e: Event) => { const el = (e.target as Element).closest?.<HTMLButtonElement>(KEYS); return el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' ? el : null; };
  let held = false;
  const listeners: [string, (e: Event) => void][] = [
    ['pointerdown', (e) => { unlock(); if ((e as PointerEvent).button === 0 && keyFor(e)) { held = true; play('tap'); } }],
    ['pointerup', () => { if (held) { held = false; play('release'); } }],
    ['pointercancel', () => { held = false; }],
    ['keydown', unlock],
    // Enter / Space on a button
    ['click', (e) => { if (e.isTrusted && (e as MouseEvent).detail === 0 && keyFor(e)) { unlock(); play('tap'); play('release', 0.09); } }],
  ];
  listeners.forEach(([type, fn]) => root.addEventListener(type, fn, true));
  return () => listeners.forEach(([type, fn]) => root.removeEventListener(type, fn, true));
}
