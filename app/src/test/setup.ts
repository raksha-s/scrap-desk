import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// waiting for something to appear gives up after 1 s by default, too soon on a busy machine
configure({ asyncUtilTimeout: 10_000 });

// jsdom is missing a few things every browser has
if (typeof window !== 'undefined') {
  window.matchMedia ??= (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
  window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  const dialog = window.HTMLDialogElement?.prototype;
  if (dialog && !dialog.showModal) {
    dialog.showModal = function () { this.open = true; };
    dialog.close = function () { if (this.open) { this.open = false; this.dispatchEvent(new Event('close')); } };
  }
  let n = 0;
  URL.createObjectURL ??= () => `blob:test-${++n}`;
  URL.revokeObjectURL ??= () => {};
}

afterEach(() => {
  if (typeof document !== 'undefined') { cleanup(); location.hash = ''; }
});

// jsdom has no PointerEvent: without one, tests lose the pointer position
if (typeof window !== 'undefined' && !window.PointerEvent) {
  window.PointerEvent = class extends MouseEvent {
    pointerId: number; pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; this.pointerType = init.pointerType ?? ''; }
  } as typeof PointerEvent;
}
