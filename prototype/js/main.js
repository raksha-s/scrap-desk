// Scrap Desk — UI prototype (milestone 0). Throwaway: mock AI, in-memory data.
import { Stage } from './stage.js';
import { store, addFolder, folderById, pageById, pagesIn, skinColor, uid, folderSkins, SKIN_ORDER, SKIN_NAMES } from './data.js';
import { seedDemo } from './seed.js';
import { buildSheet, attachEditor, addItems } from './sheet.js';
import { composePage, addCardToPage, addStickerToPage } from './pages.js';
import { openStickers } from './stickers.js';
import { direct } from './director.js';
import { openCreate } from './create.js';
import { openAlbum } from './album.js';
import { openCamera } from './camera.js';
import { play, wireButtonSounds } from './sound.js';
import { $, $$, toast, sleep, folderArt } from './ui.js';

await Promise.race([document.fonts.ready, sleep(2500)]);
await seedDemo();

const canvas = $('#stage');
const stage = new Stage(canvas);
wireButtonSounds();
// most recently added photo in a folder (empty folders get nothing)
const peekFor = (folderId) => {
  const pages = pagesIn(folderId).slice().sort((a, b) => b.createdAt - a.createdAt);
  for (const p of pages) { const c = [...p.cards].reverse().find((k) => k.kind === 'photo' || k.kind === 'camera'); if (c) return { src: c.src }; }
  return null;
};
const stageFolders = () => store.folders.map((f) => ({ ...f, peek: peekFor(f.id), pages: pagesIn(f.id).length }));
const refreshPeek = (folderId) => { const i = idxOf(folderId); if (i >= 0) stage.setContent(i, { peek: peekFor(folderId), pages: pagesIn(folderId).length }); };
stage.setFolders(stageFolders());
document.fonts.ready.then(() => stage.refreshLabels());

const views = { home: $('#home'), folder: $('#folderView'), page: $('#pageView') };
const cur = { view: 'home', folderId: null, pageId: null };
let mode = 'folders';
let enterNext = null;
let editor = null, activeSheet = null;

const idxOf = (folderId) => store.folders.findIndex((f) => f.id === folderId);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// paper sound for moving between the desk, a folder and a page
function viewSound(from, to) {
  if (from === to) return;
  if (to === 'home') play('close'); else if (to === 'page') play('page'); else play(from === 'home' ? 'open' : 'close');
}
stage.onFlip = () => { if (cur.view === 'home' && mode === 'folders') play('flick'); };

function activate(name) {
  viewSound(cur.view, name);
  cur.view = name; document.body.dataset.view = name;
  for (const [k, v] of Object.entries(views)) { const on = k === name; v.classList.toggle('is-active', on); v.inert = !on; }
}

/* ---------------- routing ---------------- */
function go(path, opts = {}) {
  enterNext = opts.enter || null;
  if (location.hash === `#${path}`) route(); else location.hash = path;
}
function route() {
  const [, kind, id] = (location.hash.slice(1) || '/').split('/');
  if (kind === 'f' && folderById(id)) showFolder(id);
  else if (kind === 'p' && pageById(id)) showPage(id);
  else showHome();
}
addEventListener('hashchange', route);

/* ---------------- home ---------------- */
function showHome() {
  activate('home');
  stage.setView(mode === 'list' ? 'list' : 'home');
  if (cur.folderId) { const i = idxOf(cur.folderId); if (i >= 0) stage.focusTo(i); }
  renderList();
}

function renderList() {
  const ul = $('#folderList'); ul.innerHTML = '';
  store.folders.forEach((f, i) => {
    const n = pagesIn(f.id).length;
    const li = document.createElement('li');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'folder-row';
    b.style.setProperty('--c', skinColor(f.skin)); b.style.setProperty('--i', i); b.style.setProperty('--r', `${((i * 53) % 5 - 2) * 0.35}deg`);
    b.innerHTML = '<span class="chip"></span><span><h3></h3><p></p></span><span class="go">→</span>';
    b.querySelector('h3').textContent = f.name; b.querySelector('p').textContent = n ? plural(n, 'page') : 'empty';
    b.addEventListener('click', () => { cur.folderId = f.id; go(`/f/${f.id}`); });
    li.append(b); ul.append(li);
  });
}

function setMode(m) {
  mode = m; $('#viewToggle').dataset.mode = m;
  $$('.toggle-opt').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === m));
  $('#listView').hidden = m !== 'list';
  if (cur.view === 'home') stage.setView(m === 'list' ? 'list' : 'home');
  if (m === 'list') renderList();
}
$$('.toggle-opt').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('#btnStart').addEventListener('click', () => startNew(null));

// pointer: parallax everywhere, hover + click + drag on the stack
addEventListener('pointermove', (e) => stage.setPointer(e.clientX, e.clientY));
let drag = null;
canvas.addEventListener('pointermove', (e) => {
  if (cur.view !== 'home' || mode !== 'folders') return;
  if (drag) {
    const dy = e.clientY - drag.y; drag.y = e.clientY; drag.total += Math.abs(dy);
    if (drag.total > 7) { drag.moved = true; stage.scrollPx(-dy); }
    return;
  }
  const i = stage.hitTest(e.clientX, e.clientY); stage.setHover(i); canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => stage.setHover(-1));
canvas.addEventListener('pointerdown', (e) => { if (cur.view !== 'home' || mode !== 'folders') return; drag = { y: e.clientY, total: 0, moved: false }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return; const d = drag; drag = null;
  if (d.moved) { stage.settle(); return; }
  const i = stage.hitTest(e.clientX, e.clientY); if (i < 0) return;
  if (i === stage.focusIndex) { cur.folderId = store.folders[i].id; go(`/f/${cur.folderId}`); } else stage.focusTo(i);
});
canvas.addEventListener('pointercancel', () => { drag = null; stage.settle(); });
let wheelT;
canvas.addEventListener('wheel', (e) => {
  if (cur.view !== 'home' || mode !== 'folders') return; e.preventDefault();
  stage.scrollPx(e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.9);
  clearTimeout(wheelT); wheelT = setTimeout(() => stage.settle(), 140);
}, { passive: false });

addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]') || e.target.closest?.('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')) return;
  if (cur.view === 'home' && mode === 'folders') {
    if (e.key === 'ArrowDown') { e.preventDefault(); stage.focusBy(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); stage.focusBy(-1); }
    else if (e.key === 'Enter') { const f = store.folders[stage.focusIndex]; if (f && !e.target.closest('button')) { cur.folderId = f.id; go(`/f/${f.id}`); } }
  } else if (e.key === 'Escape') {
    if (cur.view === 'folder' && closeFolderMenus(true)) return;
    if (cur.view === 'folder') go('/'); else if (cur.view === 'page') go(`/f/${cur.folderId}`);
  }
});

/* ---------------- inside a folder ---------------- */
const thumbObservers = [];
function showFolder(id) {
  const f = folderById(id); cur.folderId = id;
  activate('folder'); stage.setView('folder', idxOf(id));
  endRename(false); closeFolderMenus(); dressFolder(f);
  const pages = pagesIn(id);
  $('#fvMeta').textContent = pages.length ? plural(pages.length, 'page') : 'empty folder';
  const grid = $('#fvGrid'); grid.innerHTML = '';
  thumbObservers.splice(0).forEach((o) => o.disconnect());
  pages.forEach((p, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'page-card';
    b.style.setProperty('--i', i); b.style.setProperty('--r', `${((i * 41) % 5 - 2) * 0.9}deg`);
    b.innerHTML = '<div class="thumb"></div><div class="cap"><span></span><small></small></div>';
    b.querySelector('.cap span').textContent = p.direction.title; b.querySelector('small').textContent = p.direction.dateChip;
    const thumb = b.querySelector('.thumb'); const sheet = buildSheet(p); thumb.append(sheet);
    const fit = () => { sheet.style.transform = `scale(${thumb.clientWidth / 900})`; };
    const ro = new ResizeObserver(fit); ro.observe(thumb); thumbObservers.push(ro);
    b.addEventListener('click', () => go(`/p/${p.id}`));
    grid.append(b);
  });
  const n = document.createElement('button'); n.type = 'button'; n.className = 'page-card new'; n.style.setProperty('--i', pages.length);
  n.innerHTML = '<div class="thumb"><span><b>+</b>Start a page here</span></div>';
  n.addEventListener('click', () => startNew(id)); grid.append(n);
  if (!pages.length) { const e = document.createElement('p'); e.className = 'fv-empty'; e.textContent = 'Nothing in here yet — your first page will land in this folder.'; grid.prepend(e); }
}
$('#fvBack').addEventListener('click', () => go('/'));
$('#fvNew').addEventListener('click', () => startNew(cur.folderId));

/* ---------------- rename / recolor, from the ⋮ menu at the top right ---------------- */
const fvView = $('#folderView'), fvMore = $('#fvMore'), fvMenu = $('#fvMenu'), fvColours = $('#fvColours'), fvColour = $('#fvColour');
const fvName = $('#fvName'), fvInput = $('#fvNameInput');
let renaming = null;                                       // id of the folder whose name is being typed

function dressFolder(f) {
  fvView.classList.toggle('on-dark', !!folderSkins[f.skin]?.dark);
  fvName.textContent = f.name; fvName.title = f.name; fvColour.style.setProperty('--c', skinColor(f.skin));
}

function showMenu(on) { fvMenu.hidden = !on; fvMore.setAttribute('aria-expanded', on); }
// closes the menu and the color choices; true if either was open
function closeFolderMenus(refocus = false) {
  const was = !fvMenu.hidden || !fvColours.hidden;
  showMenu(false); fvColours.hidden = true;
  if (was && refocus) fvMore.focus({ preventScroll: true });
  return was;
}
fvMore.addEventListener('click', () => {
  const open = fvMenu.hidden; closeFolderMenus();
  if (open) { showMenu(true); $('#fvRename').focus({ preventScroll: true }); }
});
fvMenu.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { closeFolderMenus(); return; }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault(); const items = $$('[role="menuitem"]', fvMenu);
  items[(items.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
});
addEventListener('pointerdown', (e) => { if (!fvMore.parentElement.contains(e.target)) closeFolderMenus(); });

function startRename() {
  const f = folderById(cur.folderId); if (!f) return;
  closeFolderMenus(); renaming = f.id; fvInput.value = f.name; fvName.hidden = true; fvInput.hidden = false; fvInput.focus(); fvInput.select();
}
function endRename(save) {
  if (!renaming) return;
  const f = folderById(renaming), name = fvInput.value.trim(); renaming = null;
  fvInput.hidden = true; fvName.hidden = false;
  if (!save || !f || !name || name === f.name) return;
  f.name = name; stage.rename(idxOf(f.id), name);
  if (cur.folderId === f.id) dressFolder(f);
}
$('#fvRename').addEventListener('click', startRename);
fvInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== 'Escape') return;
  e.preventDefault(); e.stopPropagation(); endRename(e.key === 'Enter'); fvMore.focus({ preventScroll: true });
});
fvInput.addEventListener('blur', () => endRename(true));

fvColour.addEventListener('click', () => {
  const f = folderById(cur.folderId); if (!f) return;
  closeFolderMenus();
  fvColours.replaceChildren(...[...SKIN_ORDER].sort().map((skin) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', f.skin === skin);
    b.setAttribute('aria-label', SKIN_NAMES[skin]); b.title = SKIN_NAMES[skin]; b.dataset.skin = skin; b.append(folderArt(skin)); return b;
  }));
  fvColours.hidden = false; $('[aria-checked="true"]', fvColours)?.focus({ preventScroll: true });
});
fvColours.addEventListener('click', (e) => {                // stays open, so colors can be tried one after another
  const b = e.target.closest('button'); const f = folderById(cur.folderId); if (!b || !f) return;
  f.skin = b.dataset.skin; stage.recolor(idxOf(f.id), f.skin); dressFolder(f);
  $$('button', fvColours).forEach((x) => x.setAttribute('aria-checked', x === b));
});

/* ---------------- a page ---------------- */
const desk = $('#pvDesk'), sheetWrap = $('#sheetWrap'), zoomRange = $('#zoomRange');
const ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 250, 300];
let zoom = 100;                                            // per cent of the size that fits the screen
const clearArea = () => { const c = getComputedStyle(desk); return { top: parseFloat(c.paddingTop), bottom: parseFloat(c.paddingBottom) }; };
function fitSheet() {
  if (!desk.clientWidth) return;
  const pad = clearArea();                                 // the room left between the top keys and the bottom bar
  const fit = Math.min((desk.clientWidth - 28) / 900, (desk.clientHeight - pad.top - pad.bottom - 20) / 1200, 1.05);
  sheetWrap.style.setProperty('--s', ((fit * zoom) / 100).toFixed(4));
}
new ResizeObserver(fitSheet).observe(desk);

function showZoom() {
  zoomRange.value = zoom; zoomRange.setAttribute('aria-valuetext', `${zoom}%`); $('#zoomFit').textContent = `${zoom}%`;
  $('#zoomIn').disabled = zoom >= +zoomRange.max; $('#zoomOut').disabled = zoom <= +zoomRange.min;
  views.page.classList.toggle('zoomed', zoom > 100);
}
// zoom around whatever is in the middle of the screen
function setZoom(z) {
  z = Math.round(Math.min(+zoomRange.max, Math.max(+zoomRange.min, z)));
  const d = desk.getBoundingClientRect(), pad = clearArea(), cx = d.left + d.width / 2, cy = d.top + pad.top + (d.height - pad.top - pad.bottom) / 2;
  const a = sheetWrap.getBoundingClientRect(), fx = (cx - a.left) / a.width, fy = (cy - a.top) / a.height;
  zoom = z; showZoom(); fitSheet();
  const b = sheetWrap.getBoundingClientRect();
  desk.scrollLeft += b.left + fx * b.width - cx; desk.scrollTop += b.top + fy * b.height - cy;
  editor?.refresh();
}
function resetZoom() { zoom = 100; showZoom(); fitSheet(); desk.scrollTo(0, 0); editor?.refresh(); }
zoomRange.addEventListener('input', () => setZoom(+zoomRange.value));
$('#zoomIn').addEventListener('click', () => setZoom(ZOOM_STEPS.find((s) => s > zoom) ?? +zoomRange.max));
$('#zoomOut').addEventListener('click', () => setZoom([...ZOOM_STEPS].reverse().find((s) => s < zoom) ?? +zoomRange.min));
$('#zoomFit').addEventListener('click', resetZoom);
desk.addEventListener('scroll', () => editor?.refresh(), { passive: true });

// zoomed in: drag any empty spot to move around (touch screens scroll natively)
let pan = null;
desk.addEventListener('pointerdown', (e) => {
  if (zoom <= 100 || e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('.it')) return;
  e.preventDefault(); pan = { x: e.clientX, y: e.clientY, l: desk.scrollLeft, t: desk.scrollTop }; desk.setPointerCapture(e.pointerId); desk.classList.add('panning');
});
desk.addEventListener('pointermove', (e) => { if (pan) { desk.scrollLeft = pan.l - (e.clientX - pan.x); desk.scrollTop = pan.t - (e.clientY - pan.y); } });
const endPan = () => { pan = null; desk.classList.remove('panning'); };
desk.addEventListener('pointerup', endPan); desk.addEventListener('pointercancel', endPan);

function mountSheet(page, enter) {
  editor?.destroy();
  const sheet = buildSheet(page, { enter });
  $('#sheetScale').replaceChildren(sheet);
  activeSheet = sheet;
  editor = attachEditor(sheet, page, { bubble: $('#bubble'), frames: $('#bubbleFrames'), actions: $('#bubbleActions'),
    onRemove: () => { syncImageButton(page); refreshPeek(page.folderId); } });
  syncImageButton(page);
  fitSheet();
}

// a page holds up to six images (album covers don't count); when it's full, Add Image switches off
const MAX_IMAGES = 6;
const imagesFull = (page) => page.cards.filter((c) => c.kind !== 'album').length >= MAX_IMAGES;
function syncImageButton(page) {
  const b = $('#toolCamera'), full = imagesFull(page);
  const label = full ? `Limit of ${MAX_IMAGES} images reached` : 'Add Image';
  b.setAttribute('aria-disabled', full); b.setAttribute('aria-label', label); $('.obj-tip', b).textContent = label;
}

function showPage(id) {
  const page = pageById(id), f = folderById(page.folderId);
  cur.pageId = id; cur.folderId = f.id;
  activate('page'); stage.setView('page', idxOf(f.id));
  const back = $('#pvBack'); back.setAttribute('aria-label', `Back to ${f.name}`); back.title = `Back to ${f.name}`;   // icon only: long names made the key huge
  $('#pvMeta').textContent = page.direction.dateChip;
  mountSheet(page, enterNext === id); enterNext = null; resetZoom();
}
$('#pvBack').addEventListener('click', () => go(`/f/${cur.folderId}`));

$('#toolAlbum').addEventListener('click', async () => {
  const page = pageById(cur.pageId); const a = await openAlbum(); if (!a || !page) return;
  const card = { id: uid('c'), kind: 'album', src: a.cover, w: 500, h: 500, album: { title: a.title, artist: a.artist } };
  addItems(activeSheet, page, addCardToPage(page, card)); toast(`Added “${a.title}”. Drag it, tap the caption to rename.`);
});
$('#toolCamera').addEventListener('click', async () => {
  const page = pageById(cur.pageId); if (!page) return;
  if (imagesFull(page)) { toast(`This page already has ${MAX_IMAGES} images. Delete one to add another.`); return; }
  const s = await openCamera(); if (!s) return;
  const card = { id: uid('c'), kind: 'camera', src: s.src, w: s.w, h: s.h, fresh: true };
  addItems(activeSheet, page, addCardToPage(page, card)); syncImageButton(page); refreshPeek(page.folderId); toast('Developing… give it a few seconds.');
});

$('#toolStickers').addEventListener('click', async () => {
  const page = pageById(cur.pageId); if (!page) return;
  const pick = await openStickers(); if (!pick) return;
  const item = addStickerToPage(page, pick.type, pick.art);
  addItems(activeSheet, page, [item]);
  const ed = editor; setTimeout(() => { if (ed === editor && cur.view === 'page') ed.select(item.id); }, 720);   // once it has landed, show its controls
});

/* ---------------- add new → generate ---------------- */
async function startNew(defaultFolderId) {
  const res = await openCreate({ folders: store.folders, defaultFolderId });
  if (res) await generate(res);
}

async function generate(input) {
  const gen = $('#gen'), line = $('#genLine'), sub = $('#genSub'), chips = $('#genChips');
  line.textContent = 'Reading your story…'; sub.textContent = ''; chips.innerHTML = ''; gen.hidden = false;
  const dir = direct({ story: input.story, start: input.start, end: input.end, cardCount: input.cards.length });
  const t0 = performance.now();
  const say = async (l, s, c, wait) => { line.textContent = l; sub.textContent = s || ''; if (c) { chips.innerHTML = ''; c.forEach((t) => { const li = document.createElement('li'); li.textContent = t; chips.append(li); }); } await sleep(wait); };

  let folder = input.folderId ? folderById(input.folderId) : null;
  if (!folder) { folder = addFolder(input.newFolderName); stage.setFolders(stageFolders()); }
  const compose = composePage({ folderId: folder.id, start: input.start, end: input.end, story: input.story, cards: input.cards });

  if (input.story) {
    await say('Reading your story…', '', null, 650);
    await say('Feeling it out', `“${dir.mood.summary}”`, [...dir.mood.chips.map((m) => m), ...dir.themes.slice(0, 3)], 1150);
  } else await say('No words yet — letting the photos lead…', '', null, 700);
  await say('Choosing flowers, seals & tape', '', [dir.palette.tape + ' tape', `${dir.stickers.flowers.length} pressed flowers`, `${dir.stickers.stamps.length} wax seal${dir.stickers.stamps.length > 1 ? 's' : ''}`, 'one cat'], 800);
  await say('Arranging the page…', '', null, 450);
  const page = await compose; store.pages.push(page); refreshPeek(folder.id);
  await sleep(Math.max(0, 2600 - (performance.now() - t0)));
  gen.hidden = true;
  cur.folderId = folder.id;
  go(`/p/${page.id}`, { enter: page.id });
}

route();
// handy for poking around in the console during review
window.__fol = { store, stage, go };
