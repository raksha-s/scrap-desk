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

it('credits the maker at the bottom of the desk', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
  HTMLCanvasElement.prototype.getContext = () => null;
  renderWith(await readyStore(), <App />);
  // the heart is read out as "love"
  const credit = screen.getByText(/by Raksha/);
  expect(credit.textContent).toBe('Made with ❤️ by Raksha');
  expect(screen.getByRole('img', { name: 'love' }).textContent).toBe('❤️');
  expect(credit.closest('#home')).toBeTruthy();
});
