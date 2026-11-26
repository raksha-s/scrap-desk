import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const sheet = readFileSync(new URL('../../styles/sheet.css', import.meta.url), 'utf8');

// the exporter writes CSS keyword quotes out as the words "open-quote" and "close-quote"
it('writes the quote marks as characters, so they survive export', () => {
  expect(sheet).toContain('.quote q::before { content: "“"; }');
  expect(sheet).toContain('.quote q::after { content: "”"; }');
});
