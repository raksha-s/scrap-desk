// Assets manifest + in-memory store (prototype: nothing persists on reload).

export const manifest = await fetch('assets/manifest.json').then((r) => r.json());

export const art = { stamps: {}, leaves: {}, patterns: {}, stickers: {}, flowers: {}, cats: {}, papers: {} };
for (const k of Object.keys(art)) for (const a of manifest[k]) art[k][a.id] = a;

export const folderSkins = Object.fromEntries(manifest.folders.map((f) => [f.id, f]));
export const SKIN_ORDER = ['f03', 'f09', 'f05', 'f11', 'f04', 'f07', 'f08', 'f12', 'f06', 'f13', 'f10'];

let n = 0;
export const uid = (p = 'x') => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

export const store = {
  folders: [],
  pages: [],
};

export const SKIN_NAMES = { f03: 'Terracotta', f04: 'Sage', f05: 'Forest', f06: 'Burgundy', f07: 'Pink', f08: 'Lavender', f09: 'Cream', f10: 'Charcoal', f11: 'Sky blue', f12: 'Butter', f13: 'Lime' };

// the colour the next new folder will get: the first one not in use
export function nextSkin() {
  const used = new Set(store.folders.map((f) => f.skin));
  return SKIN_ORDER.find((s) => !used.has(s)) || SKIN_ORDER[store.folders.length % SKIN_ORDER.length];
}

export function addFolder(name, skin) {
  const pick = skin || nextSkin();
  const f = { id: uid('f'), name: (name || 'Unnamed Folder').trim() || 'Unnamed Folder', skin: pick, createdAt: Date.now() };
  store.folders.push(f);
  return f;
}
export const folderById = (id) => store.folders.find((f) => f.id === id);
export const pageById = (id) => store.pages.find((p) => p.id === id);
export const pagesIn = (folderId) => store.pages.filter((p) => p.folderId === folderId);

export function skinColor(skinId) { return folderSkins[skinId]?.avg || '#b86b48'; }
