// Mock "art director" for the prototype.
// In the real app a free LLM returns this same object; this rule-based version also stays on as the offline fallback.
// Input: story + dates.  Output: an art-direction object the layout engine consumes.

import { STAMPS, LEAVES, PATTERNS, STICKERS, FLOWERS, CATS, PAPERS, THEMES, NEG, POS } from './catalog.js';
import { mulberry32, hashStr } from './rng.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseDay(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

export function describeDates(start, end) {
  const a = parseDay(start), b = parseDay(end || start);
  const sameDay = a.getTime() === b.getTime();
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const lastDay = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
  const mon = (d) => MONTHS[d.getMonth()];
  const m3 = (d) => mon(d).slice(0, 3);
  if (sameDay) return { title: `${a.getDate()} ${mon(a)}`, chip: `${WD[a.getDay()]} · ${a.getFullYear()}`, short: `${a.getDate()} ${m3(a)} ${a.getFullYear()}`, span: 'day' };
  if (sameMonth) {
    const whole = a.getDate() === 1 && b.getDate() === lastDay;
    return { title: mon(a), chip: whole ? `${a.getDate()} – ${b.getDate()} ${m3(a)} ${a.getFullYear()}` : `${a.getDate()} – ${b.getDate()} ${m3(a)} ${a.getFullYear()}`, short: `${m3(a)} ${a.getFullYear()}`, span: 'month' };
  }
  if (a.getFullYear() === b.getFullYear()) return { title: `${m3(a)} – ${m3(b)}`, chip: `${a.getDate()} ${m3(a)} – ${b.getDate()} ${m3(b)} ${a.getFullYear()}`, short: `${m3(a)} – ${m3(b)} ${a.getFullYear()}`, span: 'multi' };
  return { title: `${a.getFullYear()} – ${b.getFullYear()}`, chip: `${a.getDate()} ${m3(a)} ${a.getFullYear()} – ${b.getDate()} ${m3(b)} ${b.getFullYear()}`, short: `${m3(a)} ${a.getFullYear()} – ${m3(b)} ${b.getFullYear()}`, span: 'multi' };
}

const count = (re, s) => (s.match(new RegExp(re.source, 'gi')) || []).length;
const senti = (s) => count(POS, s) - count(NEG, s);

function readArc(story) {
  const text = story.trim();
  const pivot = /\b(but|however|then|just as|until|eventually|finally|slowly|after that|later)\b/i.exec(text);
  let before, after;
  if (pivot && pivot.index > 12) { before = text.slice(0, pivot.index); after = text.slice(pivot.index); }
  else { const mid = Math.floor(text.length / 2); before = text.slice(0, mid); after = text.slice(mid); }
  const b = senti(before), a = senti(after);
  const neg = count(NEG, text), pos = count(POS, text);
  let arc;
  if (b < 0 && a > 0) arc = 'heavy-warm';
  else if (b > 0 && a < 0) arc = 'warm-heavy';
  else if (neg >= 2 && pos >= 2) arc = 'mixed';
  else arc = (pos - neg) >= 0 ? 'warm' : 'heavy';
  if (!text) arc = 'warm';
  return { arc, neg, pos };
}

const SUMMARY = {
  'heavy-warm': 'a hard stretch that turned golden',
  'warm-heavy': 'a bright start that slowly dimmed',
  'mixed': 'dark days and beautiful days, side by side',
  'warm': 'a warm, glowing stretch',
  'heavy': 'a quiet, heavy stretch',
};
const CHIPS = { 'heavy-warm': ['heavy', 'warm'], 'warm-heavy': ['warm', 'heavy'], mixed: ['mixed'], warm: ['warm'], heavy: ['heavy'] };

const PALETTES = {
  'heavy-warm': { ink: '#2a2118', accent: '#b4772a', tape: 'sage', paperKind: 'grid', noteKind: 'kraft', filter: 'sepia(.10) saturate(.94) contrast(.97)' },
  'warm-heavy': { ink: '#2a2420', accent: '#80553a', tape: 'blue', paperKind: 'lined', noteKind: 'white', filter: 'sepia(.12) saturate(.84) contrast(.97)' },
  'mixed':      { ink: '#2a2118', accent: '#a5622b', tape: 'kraft', paperKind: 'dots', noteKind: 'white', filter: 'sepia(.10) saturate(.9) contrast(.97)' },
  'warm':       { ink: '#2e2013', accent: '#b4772a', tape: 'mustard', paperKind: 'dots', noteKind: 'kraft', filter: 'sepia(.15) saturate(1.06) contrast(.97)' },
  'heavy':      { ink: '#262a30', accent: '#587286', tape: 'slate', paperKind: 'lined', noteKind: 'slate', filter: 'sepia(.06) saturate(.76) contrast(.98) brightness(.98)' },
};

function detectThemes(story) {
  const themes = {}; const found = {};
  for (const [name, re] of Object.entries(THEMES)) {
    const m = story.match(new RegExp(re.source, 'gi'));
    if (m) { themes[name] = Math.min(3, m.length); found[name] = m[0]; }
  }
  return { themes, found };
}

function pickFrom(table, n, themes, pref, rng, taken = new Set(), kind = null) {
  const rows = Object.entries(table)
    .filter(([id, e]) => !taken.has(id) && (!kind || e.k === kind))
    .map(([id, e]) => {
      let s = rng() * 0.9;
      for (const t of (e.t || [])) s += (themes[t] || 0) * 1.6;
      if (pref && (e.m === pref)) s += 1.1; else if (pref && e.m === 'n') s += 0.5;
      return { id, m: e.m, s };
    })
    .sort((a, b) => b.s - a.s);
  const out = rows.slice(0, n); out.forEach((r) => taken.add(r.id)); return out;
}

function chooseQuote(story) {
  const sents = story.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const feel = /\b(i (?:will|feel|felt|learned|realised|realized|know|hope|wish|miss|love|am|was)|cherish|grateful|promise|remember)\b/i;
  const clean = (s) => s.replace(/[.!?]+$/, '').trim();
  const words = (s) => s.split(/\s+/).length;
  const good = sents.filter((s) => feel.test(s) && words(s) >= 3 && words(s) <= 12);
  if (good.length) return clean(good[good.length - 1]);
  const pick = sents.find((s) => words(s) >= 3 && words(s) <= 12);
  if (pick) return clean(pick);
  const first = (sents[0] || story).split(/\s+/).slice(0, 9).join(' ');
  return clean(first);
}

export function direct({ story, start, end, cardCount = 0 }) {
  const text = story.trim();
  const seed = hashStr(`${text}|${start}|${end}`);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const { arc, neg, pos } = readArc(text);
  const { themes, found } = detectThemes(text);
  const palette = { ...PALETTES[arc] };
  if (themes.love && !themes.heavy) { palette.accent = '#b04a5a'; palette.tape = 'pink'; }
  if (themes.festival && (arc === 'warm' || arc === 'heavy-warm')) { palette.accent = '#bd7a14'; if (palette.tape !== 'sage') palette.tape = 'mustard'; }
  if (themes.nature && !themes.festival && arc !== 'heavy') palette.tape = 'sage';

  const len = text.length;
  const density = len > 500 || cardCount >= 5 ? 'rich' : len > 200 || cardCount >= 3 ? 'medium' : 'sparse';
  const nStamps = density === 'sparse' ? 1 : 2;
  const nLeaves = density === 'rich' ? 2 : 1;
  const nFlowers = density === 'rich' ? 3 : 2;

  // phase: which part of the page's story a piece belongs to ("early" = quiet/cool, "late" = bright/warm)
  const phases = (n) => {
    if (arc === 'heavy-warm' || arc === 'warm-heavy') return Array.from({ length: n }, (_, i) => (i === 0 ? 'early' : 'late'));
    return Array.from({ length: n }, () => 'any');
  };
  const prefFor = (ph) => (arc === 'heavy' ? 'h' : arc === 'warm' ? 'w' : ph === 'early' ? (arc === 'warm-heavy' ? 'w' : 'h') : ph === 'late' ? (arc === 'warm-heavy' ? 'h' : 'w') : null);

  const taken = new Set();
  const withPhase = (table, n) => phases(n).map((ph) => { const [r] = pickFrom(table, 1, themes, prefFor(ph), rng, taken); return r ? { id: r.id, phase: ph } : null; }).filter(Boolean);

  const stamps = withPhase(STAMPS, nStamps);
  const leaves = withPhase(LEAVES, nLeaves);
  const flowers = withPhase(FLOWERS, nFlowers);
  const prefAll = arc === 'heavy-warm' ? 'w' : prefFor('any');
  // more corner pieces than needed: the layout takes the first ones that don't sit under the title or quote
  const patterns = pickFrom(PATTERNS, 8, themes, prefAll, rng);
  const patternCount = density === 'sparse' ? 1 : 2;
  const cat = pickFrom(CATS, 1, themes, arc === 'heavy' ? 'h' : prefAll || 'w', rng)[0];
  const pickPaper = (list) => list[Math.floor(rng() * list.length)];
  const papers = { under: pickPaper(PAPERS.under), quote: pickPaper(PAPERS.quote) };

  const tk = new Set();
  const clip = pickFrom(STICKERS, 1, {}, arc === 'heavy' ? 'h' : 'w', rng, tk, 'clip')[0];
  const pin = pickFrom(STICKERS, 1, {}, arc === 'heavy' ? 'h' : 'w', rng, tk, 'pin')[0];
  const extra = density === 'rich' ? pickFrom(STICKERS, 1, {}, arc === 'heavy' ? 'h' : 'w', rng, tk, 'paperclip')[0] : null;

  // little paper scraps use the person's own words
  const SCRAP_ORDER = ['festival', 'insect', 'move', 'friends', 'food', 'work', 'home', 'travel', 'pet', 'love', 'nature', 'night'];
  const scraps = [];
  for (const k of SCRAP_ORDER) { if (found[k] && scraps.length < 3) { const w = found[k].toLowerCase(); if (!scraps.includes(w)) scraps.push(w); } }

  const dates = describeDates(start, end);
  return {
    seed,
    mood: { arc, summary: SUMMARY[arc], chips: CHIPS[arc], neg, pos },
    palette,
    title: dates.title,
    dateChip: dates.chip,
    dateShort: dates.short,
    quote: text ? chooseQuote(text) : '',
    scraps,
    stickers: { stamps, leaves, flowers, patterns, patternCount, cat: cat?.id, papers, clip: clip?.id, pin: pin?.id, extra: extra?.id },
    themes: Object.keys(themes),
    density,
  };
}
