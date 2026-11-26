// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from './App';

it('shows the app name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Scrap Desk' })).toBeTruthy();
});
