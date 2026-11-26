import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { fitScale, ZOOM_MAX, ZOOM_MIN } from './zoom';

interface Refs { desk: RefObject<HTMLDivElement | null>; wrap: RefObject<HTMLDivElement | null> }

/** Sizing, zooming (around the middle of the screen) and, when zoomed in, dragging the canvas about. */
export function useZoom({ desk, wrap }: Refs, shown: string | null, onMoved: () => void) {
  const [zoom, setZoomState] = useState(100);
  const now = useRef(100);
  const moved = useRef(onMoved); moved.current = onMoved;

  const clear = () => { const c = getComputedStyle(desk.current!); return { top: parseFloat(c.paddingTop) || 0, bottom: parseFloat(c.paddingBottom) || 0 }; };
  const fit = useCallback(() => {
    const d = desk.current, w = wrap.current;
    if (!d?.clientWidth || !w) return;
    const pad = clear();
    w.style.setProperty('--s', ((fitScale(d.clientWidth, d.clientHeight, pad.top, pad.bottom) * now.current) / 100).toFixed(4));
  }, []);

  useEffect(() => {
    const watch = new ResizeObserver(() => { fit(); moved.current(); });
    watch.observe(desk.current!);
    return () => watch.disconnect();
  }, [fit]);

  // each page opens fitted to the screen
  useEffect(() => {
    if (!shown) return;
    now.current = 100; setZoomState(100);
    requestAnimationFrame(() => { fit(); desk.current?.scrollTo?.(0, 0); moved.current(); });
    fit();
  }, [shown, fit]);

  const setZoom = (z: number) => {
    const value = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)));
    const d = desk.current!, w = wrap.current!;
    const box = d.getBoundingClientRect(), pad = clear(), cx = box.left + box.width / 2, cy = box.top + pad.top + (box.height - pad.top - pad.bottom) / 2;
    const a = w.getBoundingClientRect(), fx = (cx - a.left) / (a.width || 1), fy = (cy - a.top) / (a.height || 1);
    now.current = value;
    flushSync(() => setZoomState(value));                   // the "zoomed" padding has to apply before measuring
    fit();
    const b = w.getBoundingClientRect();
    d.scrollLeft += b.left + fx * b.width - cx; d.scrollTop += b.top + fy * b.height - cy;
    moved.current();
  };
  const reset = () => { setZoom(100); desk.current!.scrollTo?.(0, 0); };

  // zoomed in: drag any empty spot to move around (touch screens scroll natively)
  const pan = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const end = () => { pan.current = null; desk.current?.classList.remove('panning'); };
  const panHandlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (now.current <= 100 || e.pointerType !== 'mouse' || e.button !== 0 || (e.target as Element).closest('.it')) return;
      e.preventDefault(); const d = desk.current!;
      pan.current = { x: e.clientX, y: e.clientY, l: d.scrollLeft, t: d.scrollTop }; d.setPointerCapture?.(e.pointerId); d.classList.add('panning');
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const p = pan.current; if (!p) return;
      desk.current!.scrollLeft = p.l - (e.clientX - p.x); desk.current!.scrollTop = p.t - (e.clientY - p.y);
    },
    onPointerUp: end, onPointerCancel: end,
    onScroll: () => moved.current(),
  };
  return { zoom, setZoom, reset, panHandlers };
}
