// Renders a page (items on a 900×1200 sheet) to DOM, and wires up light hand-editing.

import { art } from './data.js';

const TABLE = { stamp: 'stamps', leaf: 'leaves', pattern: 'patterns', sticker: 'stickers', flower: 'flowers', cat: 'cats', paper: 'papers' };
export const FRAMES = [['polaroid', 'Polaroid'], ['instax', 'Instax'], ['film', 'Film strip'], ['kraft', 'Kraft mat'], ['round', 'Rounded'], ['torn', 'Torn edge']];

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function cardCaption(card, page) {
  if (card.caption != null) return card.caption;
  if (card.kind === 'album') return `${card.album.title}`.slice(0, 26);
  return page.direction.dateShort;
}

function buildItem(it, page) {
  const wrap = el('div', `it ${it.type}`);
  wrap.dataset.id = it.id;
  applyBox(wrap, it);
  wrap.style.setProperty('--d', it.d || 0);

  switch (it.type) {
    case 'photo': {
      const card = page.cards.find((c) => c.id === it.cardId);
      if (!card) return null;
      wrap.classList.add('photo', `fr-${it.frame}`);
      if (it.frame === 'torn') { wrap.style.setProperty('--torn', it.torn); wrap.classList.add('has-clip'); }
      if (card.kind === 'album') { wrap.classList.add('album'); wrap.append(el('div', 'rec')); wrap.style.setProperty('--lab', ['#c9573c', '#2f6f8a', '#c79a2b', '#7a4a8a', '#3d7a52'][(card.id.length + (card.album?.title || '').length) % 5]); }
      if (card.fresh) wrap.classList.add('developing');
      const ph = el('div', 'ph'); const img = new Image(); img.src = card.src; img.alt = card.kind === 'album' ? `${card.album.title} — ${card.album.artist}` : 'Photo'; img.draggable = false; ph.append(img);
      const cap = el('div', 'cap'); cap.dataset.ph = 'add a note'; cap.textContent = cardCaption(card, page);
      wrap.append(ph, cap);
      break;
    }
    case 'note': {
      wrap.classList.add('has-clip');
      const n = el('div', `pnote ${it.kind}`);
      n.style.setProperty('--fs', `${it.fs}px`); n.style.setProperty('--lh', `${it.lh}px`); n.style.setProperty('--torn', it.torn);
      n.append(document.createTextNode(it.text));
      n.append(el('span', 'sig', it.sig));
      wrap.append(n);
      break;
    }
    case 'title': {
      wrap.style.setProperty('--tfs', `${it.tfs}px`);
      wrap.append(el('h2', null, ''), el('span', 'chip', ''));
      wrap.querySelector('h2').textContent = it.text; wrap.querySelector('.chip').textContent = it.chip;
      break;
    }
    case 'quote': {
      wrap.style.setProperty('--qfs', `${it.qfs}px`);
      const q = el('q'); q.textContent = it.text; wrap.append(q);
      wrap.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 340 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 12 C 50 3, 98 17, 150 9 S 262 5, 337 11"/></svg>');
      break;
    }
    case 'stamp': case 'leaf': case 'pattern': case 'sticker': case 'flower': case 'cat': case 'paper': {
      const a = art[TABLE[it.type]][it.art]; if (!a) return null;
      const img = new Image(); img.src = a.file; img.className = 'art'; img.alt = ''; img.draggable = false; wrap.append(img);
      break;
    }
    case 'tape': wrap.append(el('div', `tstrip t-${it.kind}`)); break;
    case 'scrap': { wrap.classList.add('scrap'); if (it.mono) wrap.classList.add('mono'); wrap.style.setProperty('--sfs', '28px'); wrap.textContent = it.text; break; }
    default: return null;
  }
  return wrap;
}

function applyBox(node, it) {
  node.style.left = `${it.x - it.w / 2}px`; node.style.top = `${it.y - it.h / 2}px`;
  node.style.width = `${it.w}px`; node.style.height = `${it.h}px`;
  node.style.transform = `rotate(${it.rot}deg)`; node.style.setProperty('--z', it.z);
}

export function buildSheet(page, { enter = false } = {}) {
  const d = page.direction; const p = d.palette;
  const sheet = el('div', `sheet paper-${p.paperKind}`);
  sheet.style.setProperty('--ink', p.ink); sheet.style.setProperty('--accent', p.accent); sheet.style.setProperty('--photo-filter', p.filter);
  sheet.append(el('div', 'holes'));
  for (const it of page.items) { const n = buildItem(it, page); if (n) sheet.append(n); }
  if (enter) sheet.classList.add('enter');
  return sheet;
}

/* ---------- editing ---------- */
export function attachEditor(sheet, page, { bubble, frames, actions, onChange, onRemove }) {
  sheet.classList.add('editing');
  let sel = null; let hoverTimer = null; let hoverId = null;

  frames.innerHTML = FRAMES.map(([id, label]) => `<button type="button" class="fr" data-fr="${id}" aria-label="${label} frame" title="${label}"><i></i></button>`).join('');

  const item = (id) => page.items.find((i) => i.id === id);
  const node = (id) => sheet.querySelector(`.it[data-id="${id}"]`);
  const scale = () => sheet.getBoundingClientRect().width / 900;

  function place(id, showActions) {
    const it = item(id), n = node(id); if (!it || !n) return hide();
    const photo = it.type === 'photo';
    frames.hidden = !photo; actions.hidden = !showActions;
    frames.querySelectorAll('.fr').forEach((b) => b.classList.toggle('on', photo && b.dataset.fr === it.frame));
    bubble.hidden = false;
    const r = n.getBoundingClientRect();
    const below = r.top < 130;
    bubble.style.left = `${Math.min(innerWidth - 100, Math.max(100, r.left + r.width / 2))}px`;
    bubble.style.top = `${below ? r.bottom + 10 : r.top - 8}px`;
    bubble.style.transform = below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
  }
  function hide() { bubble.hidden = true; }
  function select(id) {
    if (sel) node(sel)?.classList.remove('is-sel');
    sel = id; if (id) { node(id)?.classList.add('is-sel'); place(id, true); } else hide();
  }

  // drag
  let drag = null;
  sheet.addEventListener('pointerdown', (e) => {
    const n = e.target.closest('.it');
    if (!n || e.target.closest('.cap')) { if (!e.target.closest('.cap')) select(null); return; }
    const it = item(n.dataset.id); if (!it) return;
    select(it.id);
    drag = { it, n, x0: e.clientX, y0: e.clientY, ix: it.x, iy: it.y, moved: false };
    n.setPointerCapture(e.pointerId); n.classList.add('dragging');
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const s = scale(); const dx = (e.clientX - drag.x0) / s, dy = (e.clientY - drag.y0) / s;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return; drag.moved = true;
    drag.it.x = drag.ix + dx; drag.it.y = drag.iy + dy; applyBox(drag.n, drag.it); place(drag.it.id, true);
  });
  const end = () => { if (drag) { drag.n.classList.remove('dragging'); if (drag.moved) onChange?.(); drag = null; } };
  sheet.addEventListener('pointerup', end); sheet.addEventListener('pointercancel', end);

  // hover → frame options (photos)
  sheet.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch' || drag) return;
    const n = e.target.closest('.it.photo'); if (!n) return;
    clearTimeout(hoverTimer); hoverId = n.dataset.id; if (!sel) place(hoverId, false);
  });
  sheet.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const n = e.target.closest('.it.photo'); if (!n) return;
    hoverTimer = setTimeout(() => { if (!sel) hide(); }, 260);
  });
  bubble.addEventListener('pointerenter', () => clearTimeout(hoverTimer));
  bubble.addEventListener('pointerleave', () => { hoverTimer = setTimeout(() => { if (!sel) hide(); }, 260); });

  // frame picker + actions
  frames.addEventListener('click', (e) => {
    const b = e.target.closest('.fr'); if (!b) return;
    const id = sel || hoverId; const it = item(id); if (!it) return;
    it.frame = b.dataset.fr; const n = node(id);
    n.className = n.className.replace(/\bfr-\w+/, `fr-${it.frame}`);
    n.classList.toggle('has-clip', it.frame === 'torn');
    if (it.frame === 'torn') n.style.setProperty('--torn', it.torn);
    place(id, !!sel); onChange?.();
  });
  actions.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !sel) return;
    const it = item(sel), n = node(sel); if (!it) return;
    const act = b.dataset.act;
    if (act === 'rot-l') it.rot -= 6; if (act === 'rot-r') it.rot += 6;
    if (act === 'smaller' || act === 'bigger') { const f = act === 'bigger' ? 1.08 : 0.92; it.w = Math.round(it.w * f); it.h = Math.round(it.h * f); }
    if (act === 'front') it.z = Math.max(...page.items.map((i) => i.z)) + 1;
    if (act === 'delete') {
      page.items = page.items.filter((i) => i !== it);
      if (it.type === 'photo') page.cards = page.cards.filter((c) => c.id !== it.cardId);   // frees one of the page's image slots
      n.remove(); select(null); onRemove?.(); onChange?.(); return;
    }
    applyBox(n, it); place(sel, true); onChange?.();
  });

  // caption editing
  sheet.addEventListener('focusin', (e) => { const c = e.target.closest('.cap'); if (c) { c.contentEditable = 'plaintext-only'; if (c.contentEditable !== 'plaintext-only') c.contentEditable = 'true'; } });
  sheet.addEventListener('input', (e) => {
    const c = e.target.closest('.cap'); if (!c) return;
    const it = item(c.closest('.it').dataset.id); const card = page.cards.find((k) => k.id === it.cardId); if (card) card.caption = c.textContent;
  });
  sheet.addEventListener('click', (e) => {
    const c = e.target.closest('.cap'); if (!c) return;
    c.contentEditable = 'plaintext-only'; if (c.contentEditable !== 'plaintext-only') c.contentEditable = 'true'; c.focus();
  });
  sheet.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest('.cap')) { e.preventDefault(); e.target.blur(); } });

  const onResize = () => { if (sel) place(sel, true); else hide(); };
  addEventListener('resize', onResize);
  // forget the selection too: the bubble is shared, so an old page must not react to its buttons
  return { select, hide, refresh: onResize, destroy() { removeEventListener('resize', onResize); sel = hoverId = null; hide(); } };
}

export function addItems(sheet, page, its) {
  for (const it of its) { const n = buildItem(it, page); if (n) { n.classList.add('pop'); sheet.append(n); } }
}
