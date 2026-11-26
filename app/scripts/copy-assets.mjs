// Copies the approved prototype's art into the app and writes the asset manifest the engine reads.
// The prototype's sample photos are personal and are not part of the app.
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const from = at('../../prototype/assets/');
const to = at('../public/art/');

rmSync(to, { recursive: true, force: true });
for (const entry of readdirSync(from, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'photos') continue;
  cpSync(`${from}${entry.name}`, `${to}${entry.name}`, { recursive: true, filter: (f) => !f.endsWith('.DS_Store') });
}
const manifest = JSON.parse(readFileSync(`${from}manifest.json`, 'utf8'));
delete manifest.photos;
const rewritten = JSON.stringify(manifest, null, 1).replaceAll('"assets/', '"art/');
writeFileSync(at('../src/engine/manifest.json'), `${rewritten}\n`);
console.log('art copied, manifest written');
