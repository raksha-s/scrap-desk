// Selecting, hovering and dragging pieces. A drag moves the element directly and saves once, on release.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Page } from '../../engine/types';
import { useStore } from '../../state/useApp';
import { moveItem } from './edits';

interface Drag { id: string; node: HTMLElement; scale: number; x0: number; y0: number; ix: number; iy: number; w: number; h: number; x: number; y: number; moved: boolean }

export function useEditor(page: Page | undefined, shown: string | null) {
  const store = useStore();
  const [selected, select] = useState<string | null>(null);
  const [hovered, setHover] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [tick, setTick] = useState(0);                       // bumps whenever the bubble has to find its piece again
  const refresh = useRef(() => setTick((t) => t + 1)).current;
  const drag = useRef<Drag | null>(null);
  const hoverTimer = useRef(0);

  useEffect(() => { select(null); setHover(null); setDragging(null); drag.current = null; return () => clearTimeout(hoverTimer.current); }, [shown]);
  useEffect(() => { addEventListener('resize', refresh); return () => removeEventListener('resize', refresh); }, [refresh]);

  const keepHover = () => clearTimeout(hoverTimer.current);
  const dropHover = () => { keepHover(); hoverTimer.current = window.setTimeout(() => setHover(null), 260); };
  const photoAt = (e: ReactPointerEvent) => (e.target as Element).closest<HTMLElement>('.it.photo');

  const end = () => {
    const d = drag.current; if (!d) return;
    drag.current = null; setDragging(null);
    if (d.moved && page) store.updatePage(page.id, (p) => moveItem(p, d.id, d.x, d.y));
    refresh();
  };

  const sheetHandlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      const target = e.target as Element;
      if (target.closest('.cap')) return;                    // typing a caption
      const node = target.closest<HTMLElement>('.it');
      const item = node && page?.items.find((i) => i.id === node.dataset.id);
      if (!node || !item) { select(null); return; }
      if (e.button !== 0) return;
      select(item.id); setDragging(item.id);
      const scale = node.closest('.sheet')!.getBoundingClientRect().width / 900 || 1;
      drag.current = { id: item.id, node, scale, x0: e.clientX, y0: e.clientY, ix: item.x, iy: item.y, w: item.w, h: item.h, x: item.x, y: item.y, moved: false };
      node.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const d = drag.current; if (!d) return;
      const dx = (e.clientX - d.x0) / d.scale, dy = (e.clientY - d.y0) / d.scale;
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      d.moved = true; d.x = d.ix + dx; d.y = d.iy + dy;
      d.node.style.left = `${d.x - d.w / 2}px`; d.node.style.top = `${d.y - d.h / 2}px`;
      refresh();
    },
    onPointerUp: end,
    onPointerCancel: end,
    onPointerOver: (e: ReactPointerEvent) => {
      if (e.pointerType === 'touch' || drag.current) return;
      const node = photoAt(e); if (!node) return;
      keepHover(); setHover(node.dataset.id!);
    },
    onPointerOut: (e: ReactPointerEvent) => { if (e.pointerType !== 'touch' && photoAt(e)) dropHover(); },
  };

  return { selected, hovered, dragging, tick, refresh, select, sheetHandlers, keepHover, dropHover };
}
