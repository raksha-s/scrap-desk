// The persistent canvas behind the screens: owns the 3D desk and its pointer, wheel and key controls.
import { useEffect, useRef } from 'react';
import { play } from '../sound/sound';
import { createStage } from './createStage';
import type { Stage, StageFolder, StageView } from './Stage';
import { syncStage } from './sync';

interface Props {
  folders: StageFolder[];
  view: StageView;
  /** the folder being shown, or last shown; -1 for none */
  selected: number;
  onOpen(folderId: string): void;
  onUnavailable(): void;
}

export function StageCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const shown = useRef<StageFolder[] | null>(null);
  const now = useRef(props);
  now.current = props;

  useEffect(() => {
    const el = canvas.current!;
    const s = createStage(el);
    if (!s) { el.hidden = true; now.current.onUnavailable(); return; }
    stage.current = s; shown.current = null;
    const home = () => now.current.view === 'home';
    s.onFlip = () => { if (home()) play('flick'); };
    document.fonts?.load('600 72px "IBM Plex Mono"').then(() => { if (stage.current === s) s.refreshLabels(); }).catch(() => {});

    const open = (i: number) => { const f = now.current.folders[i]; if (f) now.current.onOpen(f.id); };
    let drag: { y: number; total: number; moved: boolean } | null = null;
    let wheelDone = 0;
    const parallax = (e: PointerEvent) => s.setPointer(e.clientX, e.clientY);
    const move = (e: PointerEvent) => {
      if (!home()) return;
      if (drag) {
        const dy = e.clientY - drag.y; drag.y = e.clientY; drag.total += Math.abs(dy);
        if (drag.total > 7) { drag.moved = true; s.scrollPx(-dy); }
        return;
      }
      const i = s.hitTest(e.clientX, e.clientY); s.setHover(i); el.style.cursor = i >= 0 ? 'pointer' : 'default';
    };
    const leave = () => s.setHover(-1);
    const down = (e: PointerEvent) => { if (!home()) return; drag = { y: e.clientY, total: 0, moved: false }; el.setPointerCapture(e.pointerId); };
    const up = (e: PointerEvent) => {
      if (!drag) return; const d = drag; drag = null;
      if (d.moved) { s.settle(); return; }
      const i = s.hitTest(e.clientX, e.clientY); if (i < 0) return;
      if (i === s.focusIndex) open(i); else s.focusTo(i);
    };
    const cancel = () => { drag = null; s.settle(); };
    const wheel = (e: WheelEvent) => {
      if (!home()) return; e.preventDefault();
      s.scrollPx(e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.9);
      clearTimeout(wheelDone); wheelDone = window.setTimeout(() => s.settle(), 140);
    };
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!home() || document.querySelector('dialog[open]') || target.closest?.('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); s.focusBy(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); s.focusBy(-1); }
      else if (e.key === 'Enter' && !target.closest?.('button')) open(s.focusIndex);
    };
    addEventListener('pointermove', parallax); addEventListener('keydown', key);
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave); el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', cancel); el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      clearTimeout(wheelDone);
      removeEventListener('pointermove', parallax); removeEventListener('keydown', key);
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); el.removeEventListener('wheel', wheel);
      s.dispose(); stage.current = null; shown.current = null;
    };
  }, []);

  useEffect(() => {
    const s = stage.current; if (!s) return;
    syncStage(s, shown.current, props.folders);
    shown.current = props.folders;
  }, [props.folders]);

  useEffect(() => {
    const s = stage.current; if (!s) return;
    const { view, selected } = props;
    s.setView(view, selected >= 0 ? selected : undefined);
    if ((view === 'home' || view === 'list') && selected >= 0) s.focusTo(selected);
    // only when the screen or folder shown changes: re-running on every folder edit would move the stack
  }, [props.view, props.selected]);

  return <canvas id="stage" ref={canvas} aria-hidden="true" />;
}
