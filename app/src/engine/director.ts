// The rule-based "art director": reads a story and decides how its page should feel.
// The AI milestone adds a second Director; this one stays as the offline fallback.
import { CATS, FLOWERS, LEAVES, NEG, PAPERS, PATTERNS, POS, STAMPS, STICKERS, THEMES, type Tags } from './catalog';
import { describeDates } from './dates';
import { hashStr, mulberry32 } from './rng';
import type { Arc, ArtDirection, Director, DirectorInput, Mood, Phase, Phased } from './types';

const count = (re: RegExp, s: string) => (s.match(new RegExp(re.source, 'gi')) || []).length;
const senti = (s: string) => count(POS, s) - count(NEG, s);

function readArc(story: string) {
  const text = story.trim();
  const pivot = /\b(but|however|then|just as|until|eventually|finally|slowly|after that|later)\b/i.exec(text);
  let before, after;
  if (pivot && pivot.index > 12) { before = text.slice(0, pivot.index); after = text.slice(pivot.index); }
  else { const mid = Math.floor(text.length / 2); before = text.slice(0, mid); after = text.slice(mid); }
  const b = senti(before), a = senti(after);
  const neg = count(NEG, text), pos = count(POS, text);
  let arc: Arc;
  if (b < 0 && a > 0) arc = 'heavy-warm';
  else if (b > 0 && a < 0) arc = 'warm-heavy';
  else if (neg >= 2 && pos >= 2) arc = 'mixed';
  else arc = (pos - neg) >= 0 ? 'warm' : 'heavy';
  if (!text) arc = 'warm';
  return { arc, neg, pos };
}

const SUMMARY: Record<Arc, string> = {
  'heavy-warm': 'a hard stretch that turned golden',
  'warm-heavy': 'a bright start that slowly dimmed',
  'mixed': 'dark days and beautiful days, side by side',
  'warm': 'a warm, glowing stretch',
  'heavy': 'a quiet, heavy stretch',
};
const CHIPS: Record<Arc, string[]> = { 'heavy-warm': ['heavy', 'warm'], 'warm-heavy': ['warm', 'heavy'], mixed: ['mixed'], warm: ['warm'], heavy: ['heavy'] };

const PALETTES: Record<Arc, ArtDirection['palette']> = {
  'heavy-warm': { ink: '#2a2118', accent: '#b4772a', tape: 'sage', paperKind: 'grid', noteKind: 'kraft', filter: 'sepia(.10) saturate(.94) contrast(.97)' },
  'warm-heavy': { ink: '#2a2420', accent: '#80553a', tape: 'blue', paperKind: 'lined', noteKind: 'white', filter: 'sepia(.12) saturate(.84) contrast(.97)' },
  'mixed':      { ink: '#2a2118', accent: '#a5622b', tape: 'kraft', paperKind: 'dots', noteKind: 'white', filter: 'sepia(.10) saturate(.9) contrast(.97)' },
  'warm':       { ink: '#2e2013', accent: '#b4772a', tape: 'mustard', paperKind: 'dots', noteKind: 'kraft', filter: 'sepia(.15) saturate(1.06) contrast(.97)' },
  'heavy':      { ink: '#262a30', accent: '#587286', tape: 'slate', paperKind: 'lined', noteKind: 'slate', filter: 'sepia(.06) saturate(.76) contrast(.98) brightness(.98)' },
};

function detectThemes(story: string) {
  const themes: Record<string, number> = {}; const found: Record<string, string> = {};
  for (const [name, re] of Object.entries(THEMES)) {
    const m = story.match(new RegExp(re.source, 'gi'));
    if (m) { themes[name] = Math.min(3, m.length); found[name] = m[0]; }
  }
  return { themes, found };
}

function pickFrom(table: Tags, n: number, themes: Record<string, number>, pref: Mood | null, rng: () => number, taken = new Set<string>(), kind: string | null = null) {
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

function chooseQuote(story: string) {
  const sents = story.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const feel = /\b(i (?:will|feel|felt|learned|realised|realized|know|hope|wish|miss|love|am|was)|cherish|grateful|promise|remember)\b/i;
  const clean = (s: string) => s.replace(/[.!?]+$/, '').trim();
  const words = (s: string) => s.split(/\s+/).length;
  const good = sents.filter((s) => feel.test(s) && words(s) >= 3 && words(s) <= 12);
  if (good.length) return clean(good[good.length - 1]);
  const pick = sents.find((s) => words(s) >= 3 && words(s) <= 12);
  if (pick) return clean(pick);
  const first = (sents[0] || story).split(/\s+/).slice(0, 9).join(' ');
  return clean(first);
}

export function direct({ story, start, end, cardCount = 0 }: DirectorInput): ArtDirection {
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
  const density: ArtDirection['density'] = len > 500 || cardCount >= 5 ? 'rich' : len > 200 || cardCount >= 3 ? 'medium' : 'sparse';
  const nStamps = density === 'sparse' ? 1 : 2;
  const nLeaves = density === 'rich' ? 2 : 1;
  const nFlowers = density === 'rich' ? 3 : 2;

  // phase: which part of the page's story a piece belongs to ("early" = quiet/cool, "late" = bright/warm)
  const phases = (n: number): Phase[] => {
    if (arc === 'heavy-warm' || arc === 'warm-heavy') return Array.from({ length: n }, (_, i) => (i === 0 ? 'early' : 'late'));
    return Array.from({ length: n }, () => 'any');
  };
  const prefFor = (ph: Phase): Mood | null => (arc === 'heavy' ? 'h' : arc === 'warm' ? 'w' : ph === 'early' ? (arc === 'warm-heavy' ? 'w' : 'h') : ph === 'late' ? (arc === 'warm-heavy' ? 'h' : 'w') : null);

  const taken = new Set<string>();
  const withPhase = (table: Tags, n: number): Phased[] => phases(n).flatMap((ph) => { const [r] = pickFrom(table, 1, themes, prefFor(ph), rng, taken); return r ? [{ id: r.id, phase: ph }] : []; });

  const stamps = withPhase(STAMPS, nStamps);
  const leaves = withPhase(LEAVES, nLeaves);
  const flowers = withPhase(FLOWERS, nFlowers);
  const prefAll: Mood | null = arc === 'heavy-warm' ? 'w' : prefFor('any');
  // more corner pieces than needed: the layout takes the first ones that don't sit under the title or quote
  const patterns = pickFrom(PATTERNS, 8, themes, prefAll, rng);
  const patternCount = density === 'sparse' ? 1 : 2;
  const cat = pickFrom(CATS, 1, themes, arc === 'heavy' ? 'h' : prefAll || 'w', rng)[0];
  const pickPaper = (list: string[]) => list[Math.floor(rng() * list.length)];
  const papers = { under: pickPaper(PAPERS.under), quote: pickPaper(PAPERS.quote) };

  const tk = new Set<string>();
  const clip = pickFrom(STICKERS, 1, {}, arc === 'heavy' ? 'h' : 'w', rng, tk, 'clip')[0];
  const pin = pickFrom(STICKERS, 1, {}, arc === 'heavy' ? 'h' : 'w', rng, tk, 'pin')[0];
  const extra = density === 'rich' ? pickFrom(STICKERS, 1, {}, arc === 'heavy' ? 'h' : 'w', rng, tk, 'paperclip')[0] : null;

  // little paper scraps use the person's own words
  const SCRAP_ORDER = ['festival', 'insect', 'move', 'friends', 'food', 'work', 'home', 'travel', 'pet', 'love', 'nature', 'night'];
  const scraps: string[] = [];
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

export const ruleDirector: Director = { direct: async (input) => direct(input) };
