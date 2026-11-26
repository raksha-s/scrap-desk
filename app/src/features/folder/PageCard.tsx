import { useEffect, useRef, type CSSProperties } from 'react';
import type { Page } from '../../engine/types';
import { ErrorBoundary } from '../../ui/ErrorBoundary';
import { Sheet } from '../page/Sheet';

export function PageCard({ page, index, onOpen }: { page: Page; index: number; onOpen(): void }) {
  const thumb = useRef<HTMLDivElement>(null);
  const scaled = useRef<HTMLDivElement>(null);
  // the thumbnail is the real page, scaled to the card
  useEffect(() => {
    const box = thumb.current!, inner = scaled.current!;
    const fit = () => { const sheet = inner.firstElementChild as HTMLElement | null; if (sheet) sheet.style.transform = `scale(${box.clientWidth / 900})`; };
    const watch = new ResizeObserver(fit); watch.observe(box); fit();
    return () => watch.disconnect();
  }, []);
  return (
    <button type="button" className="page-card" onClick={onOpen}
      style={{ '--i': index, '--r': `${(((index * 41) % 5) - 2) * 0.9}deg` } as CSSProperties}>
      <div className="thumb" ref={thumb}><div ref={scaled} style={{ display: 'contents' }}><ErrorBoundary fallback={null}><Sheet page={page} /></ErrorBoundary></div></div>
      <div className="cap"><span>{page.direction?.title}</span><small>{page.direction?.dateChip}</small></div>
    </button>
  );
}
