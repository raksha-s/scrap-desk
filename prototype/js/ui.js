import { folderSkins } from './data.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let toastTimer;
export function toast(msg, ms = 2800) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function readImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = rej; i.src = src; });
}

// backdrop click closes a dialog only if the press began on the backdrop and it has been open a moment
export function wireDialog(dlg) {
  let downOnBackdrop = false, openedAt = 0;
  const show = dlg.showModal.bind(dlg);
  dlg.showModal = () => { openedAt = performance.now(); show(); };
  dlg.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === dlg; });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg && downOnBackdrop && performance.now() - openedAt > 500) dlg.close();
    downOnBackdrop = false;
  });
}

// the coloured folder picture, cropped to the folder itself (the source images have wide margins)
export function folderArt(skinId) {
  const f = folderSkins[skinId], g = f.geo;
  const box = document.createElement('span'); box.className = 'folder-art'; box.style.aspectRatio = `${g.bw * f.w} / ${g.bh * f.h}`;
  const img = new Image(); img.src = f.file; img.alt = ''; img.draggable = false;
  img.style.cssText = `width:${100 / g.bw}%;left:${(-g.bx / g.bw) * 100}%;top:${(-g.by / g.bh) * 100}%`;
  box.append(img); return box;
}
