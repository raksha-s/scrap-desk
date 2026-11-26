import { useEffect, useRef } from 'react';

/** Escape on the screen being shown, unless it belongs to a field or an open dialog. */
export function useEscape(active: boolean, onEscape: () => void) {
  const latest = useRef(onEscape); latest.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      if ((e.target as Element).closest?.('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')) return;
      latest.current();
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [active]);
}
