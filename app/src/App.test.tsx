// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { App } from './App';
import { readyStore, renderWith } from './test/render';

it('shows the app name', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
  HTMLCanvasElement.prototype.getContext = () => null;
  renderWith(await readyStore(), <App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Scrap Desk' })).toBeTruthy();
});
