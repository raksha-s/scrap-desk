import type { MeasureNote } from '../../engine/layout';

/** Measures a handwritten note with the real CSS so the box fits the real text. */
export const measureNote: MeasureNote = (text, sig, w, fs, lh) => {
  const el = document.createElement('div');
  el.className = 'pnote';
  el.style.cssText = `position:absolute;left:-9999px;top:0;width:${w}px;height:auto;visibility:hidden;--fs:${fs}px;--lh:${lh}px;`;
  el.append(document.createTextNode(text));
  const s = document.createElement('span'); s.className = 'sig'; s.textContent = sig; el.append(s);
  document.body.append(el);
  const h = el.scrollHeight; el.remove();
  return h;
};

/** Await before laying out a page: measuring with a stand-in font would size notes wrongly. */
export async function noteFontsReady(): Promise<void> {
  if (!document.fonts) return;
  const wanted = ['500 25px Caveat', '600 25px Caveat', '400 30px "Reenie Beanie"'].map((f) => document.fonts.load(f));
  await Promise.race([Promise.allSettled(wanted), new Promise((r) => setTimeout(r, 2500))]);
}
