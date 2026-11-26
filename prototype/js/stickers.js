// Sticker picker: every cut-out in the library, grouped, one tap to put it on the page.
import { $, wireDialog } from './ui.js';
import { manifest } from './data.js';

// manifest list → tab label → the item type the sheet draws it as
const GROUPS = [
  ['cats', 'Cats', 'cat'], ['flowers', 'Flowers', 'flower'], ['stamps', 'Wax seals', 'stamp'], ['stickers', 'Clips & pins', 'sticker'],
  ['leaves', 'Leaves', 'leaf'], ['papers', 'Paper', 'paper'], ['patterns', 'Patterns', 'pattern'],
];

const dlg = $('#stickerDlg'), tabs = $('#stkTabs'), grid = $('#stkGrid');
let resolver, current = GROUPS[0][0];

const nice = (id) => id.replace(/-/g, ' ');

function show(key) {
  current = key;
  const type = GROUPS.find((g) => g[0] === key)[2];
  tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === key));
  grid.replaceChildren(...manifest[key].map((a) => {
    const li = document.createElement('li'), b = document.createElement('button'), img = new Image();
    b.type = 'button'; b.setAttribute('aria-label', `Add ${nice(a.id)}`); b.title = nice(a.id);
    img.loading = 'lazy'; img.alt = ''; img.src = a.file; img.draggable = false;
    b.append(img); li.append(b);
    b.addEventListener('click', () => { const r = resolver; resolver = null; dlg.close(); r?.({ type, art: a.id }); });
    return li;
  }));
  grid.scrollTop = 0;
}

for (const [key, label] of GROUPS) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chipbtn'; b.dataset.key = key; b.textContent = label;
  b.addEventListener('click', () => show(key)); tabs.append(b);
}
dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
wireDialog(dlg);
dlg.addEventListener('close', () => { if (resolver) { const r = resolver; resolver = null; r(null); } });

// resolves to { type, art } or null; reopens on the tab used last
export function openStickers() {
  dlg.showModal(); show(current);
  return new Promise((res) => { resolver = res; });
}
