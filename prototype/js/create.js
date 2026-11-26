// "Add New" writing pad: one question per sheet — folder → date(s) (required) → story → up to 6 photos → Generate.
import { $, $$, toast, readImage, wireDialog, folderArt } from './ui.js';
import { nextSkin, uid } from './data.js';
import { SAMPLE_STORY, samplePhotoCards } from './seed.js';
import { play } from './sound.js';

const MAX = 6;
const dlg = $('#createDlg'), form = $('#createForm');
const dStart = $('#dStart'), dEnd = $('#dEnd'), endWrap = $('#endWrap'), lblStart = $('#lblStart');
const story = $('#story'), storyCount = $('#storyCount');
const fileInput = $('#fileInput'), slots = $('#slots'), photoPick = $('#photoPick');
const folderGrid = $('#folderGrid'), newWrap = $('#newFolderWrap'), newName = $('#newFolderName');
const btnGen = $('#btnGenerate'), errDate = $('#errDate');
const pad = $('#pad'), leaves = $$('.leaf', dlg), LAST = leaves.length - 1;

let st, resolver, folders, page = 0;
const reset = (defaultFolderId) => {
  st = { kind: 'day', cards: [], folder: defaultFolderId, touched: false };      // no folder is chosen unless you came from one
  dStart.value = ''; dEnd.value = ''; story.value = ''; newName.value = 'Unnamed Folder';
  setKind('day'); renderSlots(); renderFolders(); update(); errDate.hidden = true;
};

function setKind(k) {
  st.kind = k;
  $$('.seg-opt', dlg).forEach((b) => { const on = b.dataset.kind === k; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
  endWrap.hidden = k !== 'range'; lblStart.textContent = k === 'range' ? 'From' : 'Date';
  dEnd.required = k === 'range';
  update();
}

function dateError() {
  if (!dStart.value) return st.touched ? 'Pick a date — every page needs one.' : '';
  if (st.kind === 'range') {
    if (!dEnd.value) return st.touched ? 'Pick the last day of your range.' : '';
    if (dEnd.value < dStart.value) return 'The range ends before it starts.';
  }
  return '';
}
const dateValid = () => !!dStart.value && (st.kind !== 'range' || (!!dEnd.value && dEnd.value >= dStart.value));
const folderValid = () => !!st.folder && (st.folder !== 'new' || !!newName.value.trim());
const valid = () => folderValid() && dateValid();
function update() {
  const e = dateError(); errDate.hidden = !e; errDate.textContent = e;
  btnGen.disabled = !valid();
  $('[data-next]', leaves[0]).disabled = !folderValid();     // a page needs a folder and a date
  $('[data-next]', leaves[1]).disabled = !dateValid();
  storyCount.textContent = story.value.length;
  if (st.kind === 'range' && dStart.value) dEnd.min = dStart.value;
}

// show sheet n: every sheet before it is turned up over the clip
function turnTo(n, { quiet = false } = {}) {
  n = Math.max(0, Math.min(LAST, n));
  const moved = n !== page; page = n;
  leaves.forEach((leaf, i) => { leaf.classList.toggle('is-turned', i < n); leaf.inert = i !== n; });
  if (quiet || !moved) return;
  play('page');
  const typing = matchMedia('(pointer: fine)').matches && $('textarea, input[type="date"]', leaves[n]);   // no surprise keyboard on touch screens
  (typing || $('h3', leaves[n])).focus({ preventScroll: true });
}
function next() {
  if (page === 0 && !folderValid()) { (st.folder === 'new' ? newName : $('button', folderGrid)).focus(); return; }
  if (page === 1 && !dateValid()) { st.touched = true; update(); (dStart.value ? dEnd : dStart).focus(); return; }
  turnTo(page + 1);
}

// one coloured folder per tile, its name underneath; the last tile makes a new one
function renderFolders() {
  const tile = (id, label, skin) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = `folder-tile${id === 'new' ? ' is-new' : ''}`; b.setAttribute('role', 'radio'); b.dataset.id = id;
    const name = document.createElement('span'); name.className = 'folder-name'; name.textContent = label;
    b.append(folderArt(skin), name); return b;
  };
  folderGrid.replaceChildren(...folders.map((f) => tile(f.id, f.name, f.skin)), tile('new', 'New folder', nextSkin()));
  markFolder();
}
function markFolder() {
  $$('.folder-tile', folderGrid).forEach((b) => b.setAttribute('aria-checked', b.dataset.id === st.folder));
  newWrap.hidden = st.folder !== 'new';
}

// always six slots: chosen photos fill them in order, the rest stay empty and open the file picker
function renderSlots() {
  slots.innerHTML = '';
  for (let i = 0; i < MAX; i++) {
    const c = st.cards[i], li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button';
    if (c) {
      li.className = 'slot-full'; li.style.setProperty('--r', `${((i * 37) % 7 - 3) * 0.8}deg`);
      const img = new Image(); img.src = c.src; img.alt = `Photo ${i + 1}`;
      b.className = 'slot-x'; b.textContent = '×'; b.setAttribute('aria-label', `Remove photo ${i + 1}`); b.dataset.id = c.id;
      li.append(img, b);
    } else {
      b.className = 'slot-add'; b.setAttribute('aria-label', `Add a photo, slot ${i + 1} of ${MAX}`);
      li.append(b);
    }
    slots.append(li);
  }
}

async function addFiles(files) {
  const imgs = [...files].filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) return;
  const room = MAX - st.cards.length;
  if (imgs.length > room) toast(`Up to ${MAX} photos per page — added the first ${room}.`);
  for (const f of imgs.slice(0, room)) {
    const src = URL.createObjectURL(f);
    try { const { w, h } = await readImage(src); st.cards.push({ id: uid('c'), kind: 'photo', src, w, h, blob: true }); }
    catch { URL.revokeObjectURL(src); toast(`Couldn't read ${f.name}.`); }
  }
  renderSlots();
}

// wiring (once)
$$('[data-next]', dlg).forEach((b) => b.addEventListener('click', next));
$$('[data-prev]', dlg).forEach((b) => b.addEventListener('click', () => turnTo(page - 1)));
// Enter in a one-line field turns the page; only the last sheet generates
form.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.matches('input:not([type="file"])')) return;
  e.preventDefault(); if (page < LAST) next(); else form.requestSubmit(btnGen);
});
$$('.seg-opt', dlg).forEach((b) => b.addEventListener('click', () => setKind(b.dataset.kind)));
[dStart, dEnd].forEach((i) => i.addEventListener('input', () => { st.touched = true; update(); }));
story.addEventListener('input', update);
newName.addEventListener('input', update);
fileInput.addEventListener('change', async () => { await addFiles(fileInput.files); fileInput.value = ''; });
slots.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.classList.contains('slot-add')) { fileInput.click(); return; }
  const c = st.cards.find((x) => x.id === b.dataset.id); if (c?.blob) URL.revokeObjectURL(c.src);
  st.cards = st.cards.filter((x) => x !== c); renderSlots(); $('.slot-add', slots)?.focus({ preventScroll: true });
});
['dragenter', 'dragover'].forEach((ev) => photoPick.addEventListener(ev, (e) => { e.preventDefault(); photoPick.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => photoPick.addEventListener(ev, (e) => { e.preventDefault(); photoPick.classList.remove('over'); }));
photoPick.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
folderGrid.addEventListener('click', (e) => {
  const b = e.target.closest('.folder-tile'); if (!b) return;
  st.folder = b.dataset.id; markFolder(); update();
  if (st.folder === 'new') { newWrap.scrollIntoView({ block: 'nearest' }); newName.select(); }
});
$('#loadSample').addEventListener('click', () => {
  setKind('range'); dStart.value = '2026-11-01'; dEnd.value = '2026-11-30'; story.value = SAMPLE_STORY; st.touched = true;
  st.cards.forEach((c) => c.blob && URL.revokeObjectURL(c.src)); st.cards = samplePhotoCards().slice(0, MAX); renderSlots(); update();
});
$$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
wireDialog(dlg);
dlg.addEventListener('close', () => { if (resolver) { const r = resolver; resolver = null; r(null); } });
form.addEventListener('submit', (e) => {
  e.preventDefault(); st.touched = true; update();
  if (page < LAST) { next(); return; }
  if (!valid()) { turnTo(folderValid() ? 1 : 0); return; }
  const result = {
    start: dStart.value, end: st.kind === 'range' ? dEnd.value : dStart.value,
    story: story.value.trim(), cards: st.cards,
    folderId: st.folder === 'new' ? null : st.folder, newFolderName: st.folder === 'new' ? (newName.value.trim() || 'Unnamed Folder') : null,
  };
  const r = resolver; resolver = null; dlg.close(); r?.(result);
});

export function openCreate({ folders: list, defaultFolderId = null }) {
  folders = list; reset(defaultFolderId);
  pad.classList.add('no-anim'); turnTo(0, { quiet: true });
  dlg.showModal();
  $$('.leaf-fields', dlg).forEach((el) => { el.scrollTop = 0; });
  void pad.offsetWidth; pad.classList.remove('no-anim');      // start on the first sheet without replaying flips
  return new Promise((res) => { resolver = res; });
}
