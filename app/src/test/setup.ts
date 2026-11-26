import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
