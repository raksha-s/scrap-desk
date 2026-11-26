// Deterministic, seeded layout engine.
// Takes an art direction + the photo "cards" and returns positioned items on a 900 × 1200 sheet.
// Text blocks are never overlapped; decorations are allowed to tuck under / over corners on purpose.

import { art } from './data.js';
import { mulberry32, hashStr } from './rng.js';

export const SHEET = { w: 900, h: 1200 };
const AREA = { x0: 92, x1: 866, y0: 36, y1: 1164 };
const PI = Math.PI;

const A = (nx, ny) => ({ x: AREA.x0 + (AREA.x1 - AREA.x0) * nx, y: AREA.y0 + (AREA.y1 - AREA.y0) * ny });
const lerp = (a, b, t) => a + (b - a) * t;

function bbox(c) {
  const r = (c.rot * PI) / 180, cs = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r));
  const hw = (c.w * cs + c.h * sn) / 2, hh = (c.w * sn + c.h * cs) / 2;
  return { x0: c.x - hw, x1: c.x + hw, y0: c.y - hh, y1: c.y + hh };
}
const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
function overlap(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

export function cardSize(card, w) {
  const pw = w - 28;
  let ph;
  if (card.kind === 'album') ph = pw;
  else {
    const a = card.w / card.h;
    ph = a >= 1.15 ? pw * 0.75 : a <= 0.87 ? pw * 1.3333 : pw;
  }
  return { w, h: Math.round(ph + 72) };
}

function tornPolygon(rng, amp = 1.6, step = 5) {
  const pts = [];
  for (let x = 0; x <= 100; x += step) pts.push([x, rng() * amp]);
  for (let y = step; y <= 100; y += step) pts.push([100 - rng() * amp, y]);
  for (let x = 100 - step; x >= 0; x -= step) pts.push([x, 100 - rng() * amp]);
  for (let y = 100 - step; y > 0; y -= step) pts.push([rng() * amp, y]);
  return 'polygon(' + pts.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(',') + ')';
}

// measure a handwritten note with the real CSS so the box fits the real text
export function measureNote(text, sig, w, fs, lh) {
  const el = document.createElement('div');
  el.className = 'pnote';
  el.style.cssText = `position:absolute;left:-9999px;top:0;width:${w}px;height:auto;visibility:hidden;--fs:${fs}px;--lh:${lh}px;`;
  el.innerHTML = '';
  el.append(document.createTextNode(text));
  const s = document.createElement('span'); s.className = 'sig'; s.textContent = sig; el.append(s);
  document.body.append(el);
  const h = el.scrollHeight; el.remove();
  return h;
}

function scoreC(c, placed, o) {
  const b = bbox(c);
  const bleed = o.bleed || 0;
  if (b.x0 < AREA.x0 - bleed || b.x1 > AREA.x1 + bleed || b.y0 < AREA.y0 - bleed || b.y1 > AREA.y1 + bleed) return -1e9;
  let s = 0;
  for (const p of placed) {
    if (!p.solid) continue;
    const ov = overlap(b, p.bb);
    if (ov <= 0) continue;
    const frac = ov / Math.min(area(b), area(p.bb));
    s -= frac * (p.text ? 2400 : 800) * (o.soft ? 0.3 : 1);
  }
  if (o.anchor) s -= Math.hypot(c.x - o.anchor.x, c.y - o.anchor.y) * (o.aw ?? 0.3);
  return s;
}

function placeBest(rng, placed, base, o = {}) {
  const N = o.n || 360; let best = null, bs = -1e12;
  for (let i = 0; i < N; i++) {
    let x, y;
    if (o.anchor && i < N * 0.72) {
      const sp = o.spread ?? 170;
      x = o.anchor.x + (rng() + rng() + rng() - 1.5) * sp * 1.3;
      y = o.anchor.y + (rng() + rng() + rng() - 1.5) * sp * 1.3;
    } else { x = lerp(AREA.x0, AREA.x1, rng()); y = lerp(AREA.y0, AREA.y1, rng()); }
    const c = { ...base, x, y };
    const s = scoreC(c, placed, o);
    if (s > bs) { bs = s; best = c; }
  }
  best.score = bs;
  return best;
}

const pickOne = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const sign = (rng) => (rng() < 0.5 ? -1 : 1);

function cornerOf(host, sx, sy) {
  const r = (host.rot * PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
  const lx = sx * host.w / 2, ly = sy * host.h / 2;
  return { x: host.x + lx * cs - ly * sn, y: host.y + lx * sn + ly * cs };
}
export async function layoutPage({ direction, cards, story, variant = 0 }) {
  const rng = mulberry32(hashStr(`${direction.seed}:${variant}`));
  const pal = direction.palette;
  const items = []; const placed = [];
  let idn = 0; const mk = (type, props) => { const it = { id: `i${++idn}`, type, ...props }; items.push(it); return it; };
  const solid = (it, text = false) => { it.bb = bbox(it); placed.push({ bb: it.bb, solid: true, text }); };

  const mode = pickOne(rng, ['diag', 'diagR', 'cols', 'ring']);
  const n = cards.length;

  // ----- title -----
  const title = direction.title;
  const tfs = Math.round(Math.max(52, Math.min(96, 880 / Math.max(6, title.length) * 1.05)));
  const tw = Math.min(700, Math.round(title.length * tfs * 0.5 + 24));
  const tit = mk('title', { text: title, chip: direction.dateChip, tfs, w: tw, h: Math.round(tfs * 0.94 + 62), rot: -1, z: 32 });
  const tAnchor = mode === 'diagR' ? A(0.62, 0.075) : mode === 'ring' ? A(0.42, 0.075) : A(0.36, 0.075);
  Object.assign(tit, placeBest(rng, placed, tit, { anchor: tAnchor, aw: 1.2, spread: 40, n: 200 }));
  solid(tit, true);

  // ----- note -----
  const text = story.trim();
  let nw, fs;
  const L = text.length;
  if (L < 120) { nw = 360; fs = 32; } else if (L < 240) { nw = 400; fs = 30; } else if (L < 400) { nw = 440; fs = 27; } else if (L < 620) { nw = 480; fs = 25; } else { nw = 520; fs = 23; }
  if (n >= 4) { nw = Math.max(nw, 470); fs = Math.min(fs, 25); } else if (n === 3) { fs = Math.min(fs, 28); }
  const lh = Math.round(fs * 1.18);
  const noteKind = pal.noteKind;
  let note = null;
  if (text) {
    const nh = Math.min(640, measureNote(text, `— ${direction.dateShort}`, nw, fs, lh) + 8);
    note = mk('note', { text, sig: `— ${direction.dateShort}`, kind: noteKind, fs, lh, w: nw, h: nh, rot: sign(rng) * (0.6 + rng() * 1.2), z: 14, torn: tornPolygon(rng, 1.2, 4) });
    const nAnchor = n <= 1 ? (mode === 'diagR' ? A(0.7, 0.8) : A(0.3, 0.8)) : mode === 'diag' ? A(0.3, 0.8) : mode === 'diagR' ? A(0.7, 0.8) : mode === 'cols' ? A(0.5, 0.84) : A(0.5, 0.58);
    Object.assign(note, placeBest(rng, placed, note, { anchor: nAnchor, aw: 0.5, spread: 90, n: 300 }));
    solid(note, true);
  }

  // ----- quote -----
  let quote = null;
  if (direction.quote) {
    const q = direction.quote; const qfs = q.length <= 26 ? 52 : q.length <= 46 ? 44 : 36;
    const qw = 360;
    const lines = Math.ceil((q.length * qfs * 0.4) / (qw - 40));
    const base = { text: q, qfs, w: qw, h: Math.round(lines * qfs * 1.08 + 52), rot: sign(rng) * (1 + rng() * 1.6), z: 30 };
    const qAnchor = n <= 1 ? (mode === 'diagR' ? A(0.3, 0.2) : A(0.72, 0.2)) : mode === 'diag' ? A(0.74, 0.17) : mode === 'diagR' ? A(0.26, 0.17) : mode === 'cols' ? A(0.5, 0.18) : A(0.5, 0.2);
    let spot = placeBest(rng, placed, base, { anchor: qAnchor, aw: 0.25, spread: 200, n: 500 });
    if (spot.score < -400) { base.qfs = Math.round(qfs * 0.8); base.h = Math.round(base.h * 0.8); base.w = 320; spot = placeBest(rng, placed, base, { anchor: qAnchor, aw: 0.12, spread: 300, n: 700 }); }
    quote = mk('quote', { ...base, x: spot.x, y: spot.y });
    solid(quote, true);
  }

  // ----- photos -----
  // size the cards to the space that is actually left after the text blocks
  const usedA = placed.reduce((a, p) => a + area(p.bb), 0);
  const free = (AREA.x1 - AREA.x0) * (AREA.y1 - AREA.y0) - usedA;
  const baseW0 = { 0: 0, 1: 500, 2: 410, 3: 350, 4: 310, 5: 284, 6: 262 }[Math.min(n, 6)] || 244;
  let sumA = 0; for (const c of cards) { const w0 = baseW0 * (c.kind === 'album' ? 0.92 : 1); sumA += w0 * cardSize(c, w0).h; }
  const fit = n ? Math.min(1.12, Math.max(0.62, Math.sqrt((free * 0.62) / sumA))) : 1;
  const baseW = baseW0 * fit;
  const order = cards.map((c, i) => ({ c, i })).sort((a, b) => (b.c.w * b.c.h) - (a.c.w * a.c.h));
  const photoItems = [];
  const frames = ['polaroid', 'polaroid', 'polaroid', 'polaroid', 'instax', 'polaroid', 'kraft'];
  for (let k = 0; k < n; k++) {
    const { c, i } = order[k];
    let w = Math.round(baseW * (0.95 + rng() * 0.1) * (c.kind === 'album' ? 0.92 : 1) * (n === 1 && c.w / c.h < 0.9 ? 0.82 : 1));
    const rot = sign(rng) * (2 + rng() * 4.2);
    const t = (i + 0.5) / n;
    let anchor;
    if (n === 1) anchor = A(0.5, 0.5);
    else if (mode === 'diag') anchor = A(lerp(0.27, 0.73, t), lerp(0.2, 0.84, t));
    else if (mode === 'diagR') anchor = A(lerp(0.73, 0.27, t), lerp(0.2, 0.84, t));
    else if (mode === 'cols') anchor = A(i % 2 ? 0.72 : 0.28, lerp(0.22, 0.82, i / Math.max(n - 1, 1)));
    else { const ang = (i / n) * 2 * PI + 0.6; anchor = A(0.5 + 0.28 * Math.cos(ang), 0.55 + 0.26 * Math.sin(ang)); }
    let base, spot;
    for (let tries = 0; tries < 4; tries++) {
      base = { w, h: cardSize(c, w).h, rot };
      spot = placeBest(rng, placed, base, { anchor, aw: 0.34, spread: 150, n: 460 });
      if (spot.score > -160) break; // clean enough; otherwise shrink a little and look again
      w = Math.round(w * 0.88);
    }
    const p = mk('photo', { cardId: c.id, frame: c.kind === 'camera' ? 'polaroid' : pickOne(rng, frames), z: 10 + k * 2, ...base, x: spot.x, y: spot.y, torn: tornPolygon(rng, 1.3, 5) });
    solid(p, false); photoItems.push(p);
  }

  // ----- decorations -----
  const hosts = [...photoItems, ...(note ? [note] : [])];
  const byDiag = [...hosts].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const tapeKind = pal.tape;

  // patterns: torn pieces glued into a corner or along an edge, under everything
  const headings = [tit, quote].filter(Boolean).map(bbox);
  const takenSpots = new Set(); let laid = 0;
  for (const p of direction.stickers.patterns) {
    if (laid >= direction.stickers.patternCount) break;
    const a = art.patterns[p.id]; if (!a) continue;
    const at = a.corner_at || (laid === 0 ? 'r' : 'b');
    const clash = at === 'l' ? ['l', 'tl', 'bl'] : at === 'r' ? ['r', 'tr', 'br'] : at === 'b' ? ['b', 'bl', 'br'] : [at, at[1], at[0] === 'b' ? 'b' : at];
    if (clash.some((s) => takenSpots.has(s))) continue;
    let h = Math.round(lerp(330, 430, rng())); let w = Math.round(h * a.w / a.h);
    if (w > 440) { h = Math.round(h * 440 / w); w = 440; }
    let x, y, rot = 0;
    if (at === 'r') { x = SHEET.w - w * 0.34; y = lerp(300, 800, rng()); rot = sign(rng) * (1 + rng() * 5); }
    else if (at === 'b') { x = lerp(220, 640, rng()); y = SHEET.h - h * 0.28; rot = 90 + sign(rng) * (1 + rng() * 4); }
    else if (at === 'l') { h = Math.round(lerp(460, 600, rng())); w = Math.round(h * a.w / a.h); x = w / 2 - 8; y = lerp(h / 2 + 80, SHEET.h - h / 2 - 40, rng()); }
    else { x = at[1] === 'l' ? w / 2 - 6 : SHEET.w - w / 2 + 6; y = at[0] === 't' ? h / 2 - 6 : SHEET.h - h / 2 + 6; }
    const box = bbox({ x, y, w, h, rot });
    if (a.corner_at && headings.some((t) => overlap(box, t) / area(t) > 0.35)) continue;
    takenSpots.add(at); laid++;
    mk('pattern', { art: p.id, x, y, w, h, rot, z: 1 });
  }

  // loose paper: one piece peeking out from behind a photo, one behind the quote
  const paper = direction.stickers.papers;
  if (photoItems.length) {
    const a = art.papers[paper.under]; const host = pickOne(rng, photoItems);
    if (a) {
      const long = Math.max(host.w, host.h) * lerp(1.0, 1.15, rng()); const k = long / Math.max(a.w, a.h);
      const sx = host.x > SHEET.w / 2 ? -1 : 1;             // lean towards the middle so it stays on the page
      mk('paper', { art: paper.under, x: host.x + sx * host.w * 0.42, y: host.y + sign(rng) * host.h * 0.2, w: Math.round(a.w * k), h: Math.round(a.h * k), rot: sign(rng) * (5 + rng() * 9), z: 6 });
    }
  }
  if (quote) {
    const a = art.papers[paper.quote];
    if (a) {
      // sized to the words (blank paper can stretch) and kept under the photos, so it never hides one
      mk('paper', { art: paper.quote, x: quote.x, y: quote.y, w: Math.round(quote.w * 1.08), h: Math.round(quote.h * 1.28), rot: quote.rot * -0.6, z: 8 });
    }
  }

  // leaves: tucked under photo/note corners, poking out
  for (const l of direction.stickers.leaves) {
    const a = art.leaves[l.id]; if (!a || !hosts.length) continue;
    const host = l.phase === 'early' ? byDiag[0] : l.phase === 'late' ? byDiag[byDiag.length - 1] : pickOne(rng, hosts);
    const sx = l.phase === 'early' ? -1 : l.phase === 'late' ? 1 : sign(rng), sy = l.phase === 'early' ? -1 : l.phase === 'late' ? 1 : sign(rng);
    const h = Math.round(lerp(250, 340, rng())); const w = Math.round(h * a.w / a.h);
    const c = cornerOf(host, sx, sy);
    const dir = Math.atan2(sy, sx);
    const x = Math.min(840, Math.max(110, c.x + Math.cos(dir) * h * 0.2));
    const y = Math.min(1150, Math.max(110, c.y + Math.sin(dir) * h * 0.2));
    const rot = (dir * 180) / PI + 90 + sign(rng) * (10 + rng() * 40) + (rng() < 0.5 ? 0 : 180);
    mk('leaf', { art: l.id, x, y, w, h, rot, z: 2 + (host.z ? 0 : 0) });
  }

  // tape on photos & note
  for (const p of photoItems) {
    if (p.frame === 'film') continue;
    const two = rng() < 0.4;
    const spots = two ? [[-1, -1], [1, -1]] : [[0, -1]];
    for (const [sx] of spots) {
      const r = (p.rot * PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
      const lx = sx * p.w * 0.36, ly = -p.h / 2 + 6;
      const x = p.x + lx * cs - ly * sn, y = p.y + lx * sn + ly * cs;
      mk('tape', { kind: tapeKind, x, y, w: 128, h: 38, rot: p.rot + (two ? sx * -38 : sign(rng) * (4 + rng() * 8)), z: p.z + 1 });
    }
  }
  if (note) {
    const r = (note.rot * PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
    const lx = (rng() - 0.5) * note.w * 0.5, ly = -note.h / 2 + 4;
    mk('tape', { kind: tapeKind, x: note.x + lx * cs - ly * sn, y: note.y + lx * sn + ly * cs, w: 132, h: 38, rot: note.rot + sign(rng) * (3 + rng() * 6), z: note.z + 1 });
  }

  // clip, pin
  const aspect = (id) => { const a = art.stickers[id]; return a ? a.w / a.h : 1; };
  if (direction.stickers.clip) {
    // grips the left edge of the sheet, like the clip in the reference photo
    const id = direction.stickers.clip; const h = 160; const w = Math.round(h * aspect(id));
    mk('sticker', { art: id, x: 52, y: lerp(300, 880, rng()), w, h, rot: 90 + sign(rng) * (3 + rng() * 5), z: 48 });
  }
  if (direction.stickers.pin && photoItems.length) {
    const id = direction.stickers.pin; const h = 112; const w = Math.round(h * aspect(id));
    const host = photoItems[Math.floor(rng() * photoItems.length)];
    const c = cornerOf(host, sign(rng), 1);
    mk('sticker', { art: id, x: c.x - 6, y: c.y - host.h * 0.12, w, h, rot: sign(rng) * (10 + rng() * 25), z: 47 });
  }
  if (direction.stickers.extra && hosts.length > 1) {
    const id = direction.stickers.extra; const h = 140; const w = Math.round(h * aspect(id));
    const host = note || pickOne(rng, hosts); const c = cornerOf(host, -1, -1);
    mk('sticker', { art: id, x: c.x + 10, y: c.y + 2, w, h, rot: sign(rng) * (8 + rng() * 20), z: 45 });
  }

  // stamps: straddle a host corner; pick the corner that keeps the title/note text clear
  const textRects = [tit, note, quote].filter(Boolean).map((t) => { const b = bbox(t); const m = t.type === 'note' ? 38 : 4; return { x0: b.x0 + m, x1: b.x1 - m, y0: b.y0 + m, y1: b.y1 - m }; });
  const used = new Set();
  const cornerItems = [];
  // lay a piece over a photo or note corner, keeping text and earlier pieces clear
  const straddle = (type, s, w, h, z, tilt) => {
    let best = null, bsc = -1e9;
    for (const host of hosts) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const c = cornerOf(host, sx, sy);
      const x = Math.min(AREA.x1 - 20, Math.max(AREA.x0 + 30, c.x - sx * w * 0.12));
      const y = Math.min(AREA.y1 - 20, Math.max(AREA.y0 + 30, c.y - sy * h * 0.12));
      const sb = bbox({ x, y, w, h, rot: 0 }); const sa = area(sb);
      let sc = rng() * 8;
      for (const tr of textRects) sc -= (overlap(sb, tr) / sa) * 600;
      for (const o of cornerItems) sc -= (overlap(sb, bbox(o)) / sa) * 400;
      for (const ph of photoItems) { const pb = bbox(ph); sc -= (overlap(sb, pb) / area(pb)) * 500; }   // small photos shouldn't get buried
      const t = (x / 900 + y / 1200) / 2;
      if (s.phase === 'early') sc -= t * 90; else if (s.phase === 'late') sc -= (1 - t) * 90;
      if (used.has(host.id)) sc -= 35;
      if (sc > bsc) { bsc = sc; best = { x, y, host }; }
    }
    used.add(best.host.id);
    cornerItems.push(mk(type, { art: s.id, x: best.x, y: best.y, w, h, rot: sign(rng) * (8 + rng() * tilt), z }));
  };
  const stampItems = [];
  for (const s of direction.stickers.stamps) {
    const a = art.stamps[s.id]; if (!a || !hosts.length) continue;
    const size = Math.round(lerp(118, 152, rng()));
    straddle('stamp', s, size, Math.round(size * a.h / a.w), 44, 22);
    stampItems.push(cornerItems[cornerItems.length - 1]);
  }
  for (const f of direction.stickers.flowers) {
    const a = art.flowers[f.id]; if (!a || !hosts.length) continue;
    const k = lerp(130, 180, rng()) / Math.max(a.w, a.h);
    straddle('flower', f, Math.round(a.w * k), Math.round(a.h * k), 43, 34);
  }

  // the cat: wherever it covers the least, preferring the lower part of the page
  const catArt = art.cats[direction.stickers.cat];
  if (catArt) {
    const avoid = [...placed, ...cornerItems.map((o) => ({ bb: bbox(o), solid: true, text: false }))];
    const anchor = A(rng() < 0.5 ? 0.14 : 0.86, 0.86);
    let base, spot;
    for (const long of [230, 200, 170, 145]) {
      const k = long / Math.max(catArt.w, catArt.h);
      base = { w: Math.round(catArt.w * k), h: Math.round(catArt.h * k), rot: sign(rng) * (2 + rng() * 7) };
      spot = placeBest(rng, avoid, base, { anchor, aw: 0.12, spread: 200, n: 700, bleed: 18 });
      if (spot.score > -220) break;
    }
    mk('cat', { art: direction.stickers.cat, ...base, x: spot.x, y: spot.y, z: 46 });
    placed.push({ bb: bbox({ ...base, x: spot.x, y: spot.y }), solid: true, text: false });
  }

  // scraps: little paper labels in the person's own words, tucked beside stamps
  const scrapBase = stampItems.length ? stampItems : hosts;
  direction.scraps.slice(0, 3).forEach((word, i) => {
    const ref = scrapBase[i % Math.max(1, scrapBase.length)]; if (!ref) return;
    const t = `✦ ${word}`; const w = Math.round(t.length * 15 + 40), h = 44;
    const base = { w, h, rot: sign(rng) * (3 + rng() * 6) };
    const anchor = { x: ref.x + sign(rng) * 90, y: ref.y + 95 };
    const spot = placeBest(rng, placed, base, { anchor, aw: 0.5, spread: 90, n: 240, soft: true });
    placed.push({ bb: bbox({ ...base, x: spot.x, y: spot.y }), solid: true, text: false }); // later scraps keep clear of this one
    mk('scrap', { text: t, mono: i === 1 && direction.palette.accent !== undefined && rng() < 0.4, ...base, x: spot.x, y: spot.y, z: 50 });
  });

  // assemble order → stagger
  const rank = { pattern: 0, leaf: 1, paper: 1, photo: 2, note: 3, title: 4, quote: 5, tape: 6, flower: 7, stamp: 7, cat: 8, sticker: 8, scrap: 9 };
  items.forEach((it) => { it.d = (rank[it.type] ?? 5) * 85 + (parseInt(it.id.slice(1), 10) % 6) * 18; delete it.bb; });
  return { items, mode };
}

// find a free spot for something the person adds later (album cover, camera shot)
export function findSpot(items, w, h, seed) {
  const rng = mulberry32(seed);
  const keep = items.filter((i) => i.picked || ['photo', 'note', 'title', 'quote'].includes(i.type));   // also clear of stickers added by hand
  const placed = keep.map((i) => ({ bb: bbox(i), solid: true, text: ['note', 'title', 'quote'].includes(i.type) }));
  const base = { w, h, rot: sign(rng) * (2 + rng() * 4) };
  return placeBest(rng, placed, base, { anchor: A(0.5, 0.55), aw: 0.05, n: 900 });
}

export { bbox };
