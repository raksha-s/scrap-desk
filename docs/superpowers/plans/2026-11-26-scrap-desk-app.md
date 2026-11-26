# Scrap Desk App (Milestone 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved prototype into a real app with the same look and feel, journals that are saved, and PNG export.

**Architecture:** A new Vite + React + TypeScript app in `app/`. The prototype's pure engine, Three.js stage and sound code are ported nearly line for line; screens become React components that keep the prototype's DOM structure and class names so its CSS carries over unchanged; IndexedDB sits behind one repository, with a small store between it and the screens.

**Tech Stack:** react/react-dom 19.3.1, vite 8.3.8, @vitejs/plugin-react 6, typescript 5.9.3, three 0.170.0 (+ @types/three 0.170.0), idb 8.0.4, modern-screenshot 4.7.0, @fontsource/{instrument-serif, ibm-plex-mono, caveat, reenie-beanie}; tests: vitest 4.1.12, jsdom 26, fake-indexeddb 6, @testing-library/react 16 + @testing-library/dom.

**Spec:** `docs/superpowers/specs/2026-11-26-scrap-desk-app-design.md`

## Global Constraints

- `prototype/` is the reference and is **never modified**. "As prototype" below means: same DOM structure, class names, copy, timings and numbers as the cited prototype file.
- Node 20.19 or newer (this machine: 20.20.2). All `npm` commands run in `app/`.
- Free only; permissive licences. Static build, no server. Vite `base: './'`.
- The only network requests at runtime: the app's own files, `musicbrainz.org`, `coverartarchive.org` (and the `archive.org` hosts it redirects to), `itunes.apple.com` and its artwork host. No Google Fonts. Story text and photos never leave the device.
- Limits: 6 images per page (album covers don't count), story 900 characters, folder name 28 characters, default name `Unnamed Folder`.
- Sheet is 900 × 1200 design units. Images are stored with long side ≤ 1600 px, JPEG quality 0.85. Export is 1800 × 2400 PNG named `scrap-desk-<start date>.png`.
- Phone layout breakpoint 720 px. Check widths: 1440 × 900 and 390 × 844. Reduced motion respected.
- Save-failure message, exactly: `Couldn't save. Your browser is blocking storage or has run out of space, so changes may be lost when you close this tab.`
- Not in this milestone: AI, hosting, accounts, backup, editing date/story afterwards, regenerate, undo, offline install, redesigns.
- Every commit ends with the session's attribution line.

## Review Focus

1. A slow add (album download, camera) finishes after the user left or deleted the page: the piece goes to the page it was started on, or is dropped if that page is gone; no crash. (Task 12)
2. Camera permission is granted after the camera dialog was closed: the stream is stopped at once, so the camera light goes out. (Task 12)
3. A photo the browser cannot decode (e.g. HEIC in Chrome) or a transparent PNG: the bad file is named in a message and the others are added; transparency becomes white, not black. (Task 5)
4. On a phone, rendering outlasts the tap so the share sheet is refused: the PNG downloads instead; cancelling the share sheet downloads nothing. (Task 7)
5. Saved data that no longer matches (unknown art id, missing image, page whose folder was deleted in another tab): everything else still shows; no blank screen. (Tasks 4, 6)

## File Structure

```
app/
  package.json  vite.config.ts  tsconfig.json  index.html
  scripts/      copy-assets.mjs  golden.mjs
  public/art/   copied from prototype/assets (without photos/)
  src/
    main.tsx  App.tsx  route.ts
    engine/     types rng dates catalog manifest(.json + .ts) director layout place ids  __fixtures__/
    storage/    repo.ts  memory.ts
    state/      store.ts  useApp.ts
    images/     import.ts  urls.ts
    stage/      Stage.ts  createStage.ts  StageCanvas.tsx
    sound/      sound.ts
    ui/         Dialog.tsx  ConfirmDialog.tsx  toast.tsx  FolderArt.tsx  icons.tsx
    features/
      desk/     Desk.tsx  FolderList.tsx
      folder/   FolderView.tsx  FolderMenu.tsx
      create/   form.ts  WritingPad.tsx  generate.ts  Generating.tsx
      page/     Sheet.tsx  measureNote.ts  edits.ts  zoom.ts  PageView.tsx  Bubble.tsx  ZoomBar.tsx  Tray.tsx
      export/   exportPage.tsx  deliver.ts
      stickers/ StickerDialog.tsx
      album/    search.ts  AlbumDialog.tsx
      camera/   session.ts  CameraDialog.tsx
    styles/     base keys list folder page sheet dialogs pad generating responsive stickers (.css)
```

Tests sit beside their file as `*.test.ts(x)`.

---

### Task 1: Project setup

**Files:** Create `.gitignore` (project root), `app/{package.json,vite.config.ts,tsconfig.json,index.html}`, `app/scripts/copy-assets.mjs`, `app/src/{main.tsx,App.tsx,App.test.tsx}`, `app/src/styles/*.css`, `app/src/engine/manifest.json`. Modify `.claude/launch.json`.

**Interfaces:** Produces: scripts `npm run dev | build | test | typecheck`; art served at `art/...`; `src/engine/manifest.json` with all paths starting `art/` and no `photos` key.

- [ ] **Step 1:** At the project root run `git init`. `.gitignore`: `node_modules/`, `dist/`, `.DS_Store`, `Sample Project/`, `prototype/assets/photos/`, `.claude/settings.local.json` (the two photo folders are personal photos). Commit what exists: `chore: add design sources, prototype and docs`.
- [ ] **Step 2:** Scaffold `app/` with the Tech Stack versions pinned exactly. Dev server port 5191, `--strictPort`. Add launch config `scrap-desk` (`npm --prefix app run dev`, port 5191), keeping the prototype's.
- [ ] **Step 3:** Write `copy-assets.mjs`: copy every `prototype/assets` subfolder except `photos` to `app/public/art/`; write the rewritten manifest. Run it.
- [ ] **Step 4:** Split `prototype/css/styles.css` into `src/styles/` by line range, imported in this order so the cascade is unchanged: base 1–65, keys 66–153, list 154–171, folder 172–214, page 215–294, sheet 295–405, dialogs 406–472, pad 473–542, generating 543–558, responsive 559–606, stickers 607–end. Only changes: `url("../assets/…")` becomes `url("/art/…")`; delete `.proto-flag` rules. Import the fontsource weights `prototype/index.html:11` requests.
- [ ] **Step 5:** Failing test `App.test.tsx` (jsdom):

```tsx
it('shows the app name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Scrap Desk' })).toBeTruthy();
});
```
- [ ] **Step 6:** `npm test` fails; add the minimal `App` (`<h1>Scrap Desk</h1>`, document title `Scrap Desk`); `npm test && npm run build` pass.
- [ ] **Step 7:** Commit `chore: scaffold app with carried-over art and styles`.

### Task 2: Engine — types, dates, director

**Files:** Create `src/engine/{types,rng,ids,dates,catalog,manifest,director}.ts`, `app/scripts/golden.mjs`, `src/engine/__fixtures__/golden.json`, `src/engine/director.test.ts`. Source: `prototype/js/{rng,director,catalog,data}.js`.

**Interfaces — Produces:**

```ts
// types.ts
export type ArtType = 'stamp'|'leaf'|'pattern'|'sticker'|'flower'|'cat'|'paper';
export type ArtList = 'stamps'|'leaves'|'patterns'|'stickers'|'flowers'|'cats'|'papers';
export interface Asset { id: string; file: string; w: number; h: number; kind?: string; corner_at?: string }
export interface FolderSkin { id: string; file: string; avg: string; w: number; h: number; dark: boolean;
  geo: { bx: number; by: number; bw: number; bh: number; tabL: number; tabR: number; tabH: number } }
export type ArtIndex = Record<ArtList, Record<string, Asset>>;
export interface Card { id: string; kind: 'photo'|'camera'|'album'; imageId: string; w: number; h: number;
  caption?: string; album?: { title: string; artist: string } }
export type FrameId = 'polaroid'|'instax'|'film'|'kraft'|'round'|'torn';
interface Box { id: string; x: number; y: number; w: number; h: number; rot: number; z: number; d: number; picked?: boolean }
export type Item = Box & (
  | { type: 'photo'; cardId: string; frame: FrameId; torn: string }
  | { type: 'note'; text: string; sig: string; kind: 'kraft'|'white'|'slate'; fs: number; lh: number; torn: string }
  | { type: 'title'; text: string; chip: string; tfs: number }
  | { type: 'quote'; text: string; qfs: number }
  | { type: ArtType; art: string }
  | { type: 'tape'; kind: string }
  | { type: 'scrap'; text: string; mono?: boolean });
export interface DirectorInput { story: string; start: string; end: string; cardCount: number }
export interface ArtDirection { /* exactly the object returned by direct() in prototype/js/director.js */ }
export interface Director { direct(input: DirectorInput): Promise<ArtDirection> }
export interface Folder { id: string; name: string; skin: string; createdAt: number }
export interface Page { id: string; folderId: string; start: string; end: string; story: string;
  cards: Card[]; direction: ArtDirection; items: Item[]; createdAt: number; updatedAt: number }
```
- `rng.ts`: `hashStr(s: string): number`, `mulberry32(a: number): () => number`; `ids.ts`: `uid(prefix?: string): string` (must not repeat across reloads: add a random suffix).
- `dates.ts`: `parseDay(s): Date`, `describeDates(start: string, end?: string): { title: string; chip: string; short: string; span: 'day'|'month'|'multi' }`.
- `director.ts`: `export const ruleDirector: Director`.
- `manifest.ts`: `art: ArtIndex`, `folderSkins: Record<string, FolderSkin>`, `SKIN_ORDER`, `SKIN_NAMES`, `nextSkin(used: string[]): string`.

- [ ] **Step 1:** Write `golden.mjs`, run as `node --experimental-default-type=module scripts/golden.mjs`. It stubs `fetch` (returns the prototype manifest) and `document` (elements whose `scrollHeight` is 260), imports the prototype's `director.js` and `layout.js`, and saves `{input, args: {direction, cards, story}, direction, items}` for: the sample story (`SAMPLE_STORY` in `prototype/js/seed.js`, 2026-11-01→30, 5 cards), an empty story with 0 cards, a one-day heavy story with 1 card, a range across two years with 6 cards. Card sizes alternate 1000×750 and 750×1000, ids `c0…`.
- [ ] **Step 2:** Failing tests:

```ts
it.each([
  ['2026-11-01','2026-11-30',{title:'November',chip:'1 – 30 Nov 2026',short:'Nov 2026',span:'month'}],
  ['2026-11-09','2026-11-09',{title:'9 November',chip:'Monday · 2026',short:'9 Nov 2026',span:'day'}],
  ['2026-10-28','2026-11-02',{title:'Oct – Nov',chip:'28 Oct – 2 Nov 2026',short:'Oct – Nov 2026',span:'multi'}],
  ['2025-12-30','2026-01-02',{title:'2025 – 2026',chip:'30 Dec 2025 – 2 Jan 2026',short:'Dec 2025 – Jan 2026',span:'multi'}],
])('describes %s to %s', (a, b, want) => expect(describeDates(a, b)).toEqual(want));

it.each(golden)('directs like the prototype', async (g) =>
  expect(await ruleDirector.direct(g.input)).toEqual(g.direction));

it('reads the sample arc', async () => {
  const d = await ruleDirector.direct(golden[0].input);
  expect(d.mood.arc).toBe('heavy-warm');
  expect(d.quote).toBe('I will cherish it all');
});
```
- [ ] **Step 3:** Run, see failure; port the modules to TypeScript without changing logic; run until `npm test` and `npm run typecheck` pass.
- [ ] **Step 4:** Commit `feat: port the director engine`.

### Task 3: Engine — layout and placing pieces

**Files:** Create `src/engine/{layout,place}.ts` and tests. Source: `prototype/js/{layout,pages}.js`.

**Interfaces — Consumes:** Task 2. **Produces:**

```ts
export type MeasureNote = (text: string, sig: string, w: number, fs: number, lh: number) => number;
export function layoutPage(a: { direction: ArtDirection; cards: Card[]; story: string },
  deps: { art: ArtIndex; measureNote: MeasureNote }): { items: Item[]; mode: string };
export function cardSize(card: Pick<Card,'kind'|'w'|'h'>, w: number): { w: number; h: number };
export function bbox(b: { x: number; y: number; w: number; h: number; rot: number }): { x0: number; x1: number; y0: number; y1: number };
export function findSpot(items: Item[], w: number, h: number, seed: number): { x: number; y: number; rot: number; score: number };
export function placeCard(page: Page, card: Card): Item[];                       // photo + tape, as addCardToPage
export function placeSticker(page: Page, type: ArtType, artId: string, art: ArtIndex): Item; // as addStickerToPage
```
`place*` do not mutate `page`. Items added later get ids from `uid('i')`.

- [ ] **Step 1:** Failing tests:

```ts
it.each(golden)('lays out like the prototype', (g) =>
  expect(layoutPage(g.args, { art, measureNote: () => 260 }).items).toEqual(g.items));

it('keeps text blocks apart and on the sheet', async () => {
  // stories of 0, 12, 200, 400, 900 chars × 0..6 cards × 8 dates; measureNote = estimate from length, width and line height
  expect(overlaps).toEqual([]);   // no two of title/note/quote bounding boxes intersect by more than 1 unit
  expect(offSheet).toEqual([]);   // each of those boxes lies within 0..900 × 0..1200
});

it('adds a camera card with tape above everything, without touching the page', () => {
  const before = structuredClone(page); const [photo, tape] = placeCard(page, card);
  expect(photo).toMatchObject({ type: 'photo', cardId: card.id, frame: 'polaroid' });
  expect(tape.type).toBe('tape'); expect(tape.z).toBeGreaterThan(photo.z);
  expect(page).toEqual(before);
});

it('puts a picked sticker on top', () => {
  const s = placeSticker(page, 'cat', Object.keys(art.cats)[0], art);
  expect(s.picked).toBe(true); expect(Math.max(s.w, s.h)).toBe(220);
  expect(s.z).toBeGreaterThan(Math.max(...page.items.map((i) => i.z)));
});
```
Golden `items` omit nothing: if the port adds or drops a property, fix the port.
- [ ] **Step 2:** Port. If the overlap or on-sheet test fails (the prototype only penalises overlap), retry that block smaller before accepting a spot, without changing results for the golden inputs.
- [ ] **Step 3:** `npm test && npm run typecheck` pass. Commit `feat: port the layout engine`.

### Task 4: Storage and app state

**Files:** Create `src/storage/{repo,memory}.ts`, `src/state/{store,useApp}.ts` and tests (`// @vitest-environment node`, `fake-indexeddb/auto`).

**Interfaces — Produces:**

```ts
export interface StoredImage { id: string; blob: Blob; width: number; height: number }
export interface Repo {
  load(): Promise<{ folders: Folder[]; pages: Page[]; seeded: boolean }>;  // creation order
  markSeeded(): Promise<void>;
  putFolder(f: Folder): Promise<void>;
  deleteFolder(id: string): Promise<void>;                                  // with its pages and their images
  putPage(p: Page, extra?: { images?: StoredImage[]; folder?: Folder }): Promise<void>; // one transaction
  deletePage(id: string): Promise<void>;
  getImage(id: string): Promise<StoredImage | undefined>;
}
export function openRepo(name?: string): Promise<Repo>;   // default 'scrap-desk', schema version 1
export function memoryRepo(): Repo;

export interface AppState { ready: boolean; folders: Folder[]; pages: Page[]; saveError: string | null }
export function createStore(open: () => Promise<Repo>): {
  get(): AppState; subscribe(fn: () => void): () => void; init(): Promise<void>;
  addFolder(name: string, skin?: string): Folder; renameFolder(id: string, name: string): void;
  recolorFolder(id: string, skin: string): void; deleteFolder(id: string): void;
  addPage(p: Page, images: StoredImage[], folder?: Folder): Promise<void>;
  updatePage(id: string, change: (p: Page) => Page, images?: StoredImage[]): void;
  deletePage(id: string): void; image(id: string): Promise<StoredImage | undefined>; flush(): Promise<void>;
};
export function useApp<T>(select: (s: AppState) => T): T;
```
Images are saved in IndexedDB as bytes + MIME type and returned as `Blob`. `putPage` deletes images the previous version of that page used and the new one doesn't. Writes run in call order. `addPage` changes state only after the save succeeds and rejects otherwise; every other action changes state first and on failure sets `saveError`, keeping state. If `open` rejects, use `memoryRepo()` and set `saveError`. `init` calls `navigator.storage?.persist?.()`.

- [ ] **Step 1:** Failing tests (names and assertions):

```ts
it('round-trips folders, pages and images across a reopen', …)   // reopen same db name; deep-equal; image bytes and type equal
it('drops images a page no longer uses')                           // getImage(removed) === undefined, kept one still there
it('deleting a folder removes its pages and images', …)
it('ignores pages whose folder is missing', …)                     // load().pages excludes the orphan
it('seeds one empty Unnamed Folder on first run only', async () => {
  await s.init(); expect(s.get().folders.map((f) => [f.name, f.skin])).toEqual([['Unnamed Folder', 'f03']]);
  s.deleteFolder(s.get().folders[0].id); await s.flush();
  const again = createStore(() => openRepo(db)); await again.init(); expect(again.get().folders).toEqual([]);
});
it('keeps an edit on screen and reports a failed save', …)         // putPage rejects → page changed, saveError === SAVE_ERROR
it('adds no page and no folder when the first save fails', …)      // addPage rejects; folders and pages unchanged
it('works in memory when storage cannot be opened', …)             // open rejects → ready true, saveError set, addFolder works
it('trims folder names to 28 characters and defaults blank ones', …) // '' → 'Unnamed Folder'
```
- [ ] **Step 2:** Run (fail), implement, run (pass). Commit `feat: save journals in the browser`.

### Task 5: Importing images

**Files:** Create `src/images/{import,urls}.ts` and tests.

**Interfaces — Produces:**

```ts
export function scaledSize(w: number, h: number, max?: number): { w: number; h: number };  // max 1600, never upscales
export interface Codec { decode(b: Blob): Promise<{ width: number; height: number; source: CanvasImageSource }>;
  encode(source: CanvasImageSource, w: number, h: number): Promise<Blob> }
export function importImage(file: Blob, codec?: Codec): Promise<StoredImage>;
export function importMany(files: File[], codec?: Codec): Promise<{ images: StoredImage[]; failed: string[] }>;
export function useImageUrl(imageId: string, load: (id: string) => Promise<StoredImage | undefined>): string | undefined; // cached object URL
```
Default codec: `createImageBitmap(b, { imageOrientation: 'from-image' })`; canvas filled white before drawing; JPEG 0.85.

- [ ] **Step 1:** Failing tests:

```ts
expect(scaledSize(4000, 3000)).toEqual({ w: 1600, h: 1200 });
expect(scaledSize(900, 3200)).toEqual({ w: 450, h: 1600 });
expect(scaledSize(800, 600)).toEqual({ w: 800, h: 600 });
// codec whose decode rejects for 'b.heic'
const r = await importMany([a, heic, c], codec);
expect(r.images).toHaveLength(2); expect(r.failed).toEqual(['b.heic']);
// default encoder with a spied 2D context: fillStyle '#fff' and fillRect(0,0,w,h) happen before drawImage
```
- [ ] **Step 2:** Implement, tests pass, commit `feat: import and downscale photos`.

### Task 6: Drawing a page

**Files:** Create `src/features/page/{Sheet.tsx,measureNote.ts}` and tests. Source: `prototype/js/sheet.js:1-87`, `measureNote` in `layout.js`.

**Interfaces — Produces:**

```tsx
export function Sheet(p: { page: Page; imageUrl?: (imageId: string) => string | undefined;
  enter?: boolean; editing?: boolean; selectedId?: string | null; freshCardId?: string; addedIds?: string[] }): JSX.Element;
export const FRAMES: [FrameId, string][];
export function cardCaption(card: Card, page: Page): string;
export const measureNote: MeasureNote;                 // as prototype
export function noteFontsReady(): Promise<void>;       // await before every layoutPage call
```
Without `imageUrl`, photos resolve through `useImageUrl` and the store.

- [ ] **Step 1:** Failing tests:

```tsx
it('draws every kind of piece with the prototype classes')    // one item per type → .it.photo.fr-polaroid, .pnote.kraft, .sheet.paper-grid, .tstrip.t-sage, img.art …
it('positions by centre', …)                                  // item {x:450,y:600,w:100,h:50,rot:5} → left '400px', top '575px', transform 'rotate(5deg)'
it('skips unknown art and photos with no card, drawing the rest', …)
it('shows an empty frame when the image is missing', …)       // .ph present, no broken <img>
expect(cardCaption({ ...card, caption: '' }, page)).toBe('');
```
- [ ] **Step 2:** Implement, pass, commit `feat: draw journal pages`.

### Task 7: Export (trial first)

**Files:** Create `src/features/export/{exportPage.tsx,deliver.ts,deliver.test.ts,Trial.tsx}`.

**Interfaces — Produces:**

```ts
export function exportPage(page: Page, load: (imageId: string) => Promise<StoredImage | undefined>): Promise<Blob>;
export const exportFilename: (start: string) => string;
export function deliver(blob: Blob, filename: string, env?: { nav: Navigator; download(b: Blob, n: string): void; touch: boolean }):
  Promise<'shared' | 'downloaded' | 'cancelled'>;
```
`exportPage` mounts a clean `Sheet` off screen (no `enter`, `editing` or selection), waits for fonts and every image, renders at scale 2, unmounts.

- [ ] **Step 1: Trial.** A dev-only route `#/dev/export` (`import.meta.env.DEV`) showing a page that has all item types, all six frames, a sepia photo filter and an album record, beside the `modern-screenshot` output.
- [ ] **Step 2:** Compare in the built-in browser. **Ask the user to open the same URL in Safari and say whether the two match.** If it fails in either, try `html-to-image`; if both fail, stop and report before writing a canvas renderer.
- [ ] **Step 3:** Failing tests:

```ts
expect(exportFilename('2026-11-01')).toBe('scrap-desk-2026-11-01.png');
await expect(deliver(blob, n, { nav: sharing, download, touch: true })).resolves.toBe('shared');
await expect(deliver(blob, n, { nav: rejects('NotAllowedError'), download, touch: true })).resolves.toBe('downloaded');
await expect(deliver(blob, n, { nav: rejects('AbortError'), download, touch: true })).resolves.toBe('cancelled'); // download not called
await expect(deliver(blob, n, { nav: sharing, download, touch: false })).resolves.toBe('downloaded');            // desktop never shares
```
- [ ] **Step 4:** Implement; tests pass; the trial PNG is exactly 1800 × 2400. Commit `feat: export a page as PNG`.

### Task 8: Desk, 3D stage, sound, shared UI, routing

**Files:** Create `src/stage/*`, `src/sound/sound.ts`, `src/ui/*`, `src/route.ts`, `src/features/desk/*`; modify `App.tsx`. Source: `prototype/js/{stage,sound,ui,main}.js` (`main.js:1-147`), `index.html`.

**Interfaces — Produces:**

```ts
export type Route = { view: 'home' } | { view: 'folder'; id: string } | { view: 'page'; id: string };
export function parseRoute(hash: string): Route;
export function resolveRoute(r: Route, s: AppState): Route;      // missing id → home
export function go(path: string, opts?: { enter?: string }): void;

export interface StageFolder { id: string; name: string; skin: string; pages: number; peek: { src: string } | null }
export class Stage { /* prototype public methods and onFlip, plus */ dispose(): void }
export function createStage(canvas: HTMLCanvasElement): Stage | null;   // null without WebGL

export function play(name: 'tap'|'release'|'flick'|'open'|'close'|'page', delay?: number): void;
export function wireButtonSounds(root?: Document): () => void;
export function toast(message: string, ms?: number): void;              // 2800
export function Dialog(p: { open: boolean; onClose(): void; className: string; labelledBy?: string; children: React.ReactNode }): JSX.Element; // backdrop rule as ui.js wireDialog
export function ConfirmDialog(p: { open: boolean; title: string; body: string; onConfirm(): void; onCancel(): void }): JSX.Element; // buttons Cancel, Delete
export function FolderArt(p: { skin: string }): JSX.Element;
```
All three view sections stay mounted and toggle `is-active` + `inert`; `body[data-view]` follows. `saveError` shows as a message that stays until saving works again. Peek = newest page's last photo or camera card. `dispose` cancels the frame loop, removes listeners and frees the renderer (React mounts effects twice in development).

- [ ] **Step 1:** Failing tests:

```ts
expect(parseRoute('#/f/abc')).toEqual({ view: 'folder', id: 'abc' });
expect(parseRoute('#/nonsense')).toEqual({ view: 'home' });
expect(resolveRoute({ view: 'page', id: 'gone' }, state)).toEqual({ view: 'home' });
expect(createStage(canvasWithNoWebGL)).toBeNull();
it('falls back to list view without WebGL')           // folder toggle disabled, title "3D view isn't available on this device", rows rendered
it('shows an empty desk with + Add New when there are no folders')
```
- [ ] **Step 2:** Implement. Guard stage maths for zero folders (`scrollPx`, `focusTo`).
- [ ] **Step 3:** Tests pass. In the browser at both widths, compare with the prototype (port 5190): stack, hover, wheel/drag/arrows/Enter, toggle, list, sounds; no console errors. Commit `feat: the desk`.

### Task 9: Inside a folder

**Files:** Create `src/features/folder/*` and tests. Source: `main.js` "inside a folder" and "rename / recolor" blocks; `index.html` `#folderView`.

**Interfaces — Consumes:** store, `Sheet`, `Dialog`, `go`. **Produces:** `FolderView(p: { folderId: string | null; onAddNew(folderId: string): void })`.

- [ ] **Step 1:** Failing tests:

```tsx
it('renames on Enter and on blur, cancels on Escape')
it('recolours and keeps the swatches open')
it('shows count, thumbnails, start card and empty message')   // 'empty folder', 'Start a page here', 'Nothing in here yet — your first page will land in this folder.'
it('asks before deleting a folder', …)  // menuitem 'Delete folder' → dialog 'Delete “Trips”?', body 'This permanently deletes the folder and its 2 pages.' (singular '1 page'); Cancel keeps; Delete removes and routes home
```
- [ ] **Step 2:** Implement; the third menu item uses the existing menu styling. Pass; compare in browser; reload keeps name and colour. Commit `feat: folder view with rename, recolour and delete`.

### Task 10: Writing pad and generating

**Files:** Create `src/features/create/*` and tests. Source: `prototype/js/create.js`, `main.js` `generate()`, `index.html` `#createDlg`, `#gen`.

**Interfaces — Produces:**

```ts
export interface Draft { folder: string | 'new' | null; newName: string; kind: 'day'|'range'; start: string; end: string;
  story: string; photos: (StoredImage & { url: string })[]; touched: boolean }
export const emptyDraft: (folderId?: string) => Draft;
export function dateError(d: Draft): string;
export function canAdvance(d: Draft, step: 0|1|2): boolean;
export function canGenerate(d: Draft): boolean;
export function generatePage(d: Draft, deps: { store; director: Director; measureNote: MeasureNote; onStep?(line: string, sub: string, chips: string[]): Promise<void> }): Promise<Page>;
```
`WritingPad` takes an initial draft so a failed generate can reopen it unchanged.

- [ ] **Step 1:** Failing tests:

```ts
expect(emptyDraft().folder).toBeNull(); expect(emptyDraft('f1').folder).toBe('f1'); expect(emptyDraft().newName).toBe('Unnamed Folder');
expect(dateError({ ...d, touched: false, start: '' })).toBe('');
expect(dateError({ ...d, touched: true, start: '' })).toBe('Pick a date — every page needs one.');
expect(dateError({ ...d, touched: true, kind: 'range', start: '2026-11-05', end: '' })).toBe('Pick the last day of your range.');
expect(dateError({ ...d, kind: 'range', start: '2026-11-05', end: '2026-11-01' })).toBe('The range ends before it starts.');
expect(canGenerate({ ...d, folder: 'new', newName: '  ' })).toBe(false);
it('saves page, images and new folder together')          // one putPage call carrying folder and images
it('leaves nothing behind when saving fails')             // rejects; no folder, no page; draft unchanged
it('caps photos at six')                                  // toast 'Up to 6 photos per page — added the first 6.'
it('has no sample link')                                  // queryByText('Load my sample') === null
```
- [ ] **Step 2:** Implement (photos via `importMany`; failures toast `Couldn't read <name>.`; step lines and waits as `generate()`, total ≥ 2600 ms). On failure reopen the pad with the draft and show the save message.
- [ ] **Step 3:** Pass; browser: four sheets flip, Enter advances, drag-and-drop, generate, reload shows the page. Commit `feat: writing pad and page generation`.

### Task 11: Journal page, editing, zoom, export and delete

**Files:** Create `src/features/page/{edits,zoom}.ts`, `{PageView,Bubble,ZoomBar}.tsx` and tests. Source: `sheet.js:89-191`, `main.js` "a page".

**Interfaces — Produces:**

```ts
export type PieceAction = 'rot-l'|'rot-r'|'smaller'|'bigger'|'front'|'delete';
export function applyAction(p: Page, id: string, a: PieceAction): Page;
export function moveItem(p: Page, id: string, x: number, y: number): Page;
export function setFrame(p: Page, id: string, f: FrameId): Page;
export function setCaption(p: Page, cardId: string, text: string): Page;
export const ZOOM_STEPS: number[];  export function stepZoom(z: number, dir: 1|-1): number;
export function fitScale(deskW: number, deskH: number, padTop: number, padBottom: number): number;
```

- [ ] **Step 1:** Failing tests:

```ts
expect(item(applyAction(p, id, 'rot-r')).rot).toBe(rot + 6);
expect(item(applyAction(p, id, 'bigger')).w).toBe(Math.round(w * 1.08));
expect(item(applyAction(p, id, 'smaller')).w).toBe(Math.round(w * 0.92));
expect(item(applyAction(p, id, 'front')).z).toBe(maxZ + 1);
expect(applyAction(p, photoId, 'delete').cards).toHaveLength(p.cards.length - 1);
expect(stepZoom(100, 1)).toBe(125); expect(stepZoom(300, 1)).toBe(300); expect(stepZoom(50, -1)).toBe(50);
expect(fitScale(928, 1240, 0, 0)).toBe(1);
it('asks before deleting a page')  // key 'Delete page' → 'Delete this page?', 'This permanently deletes the page and its photos.' → routes to its folder
it('Export calls exportPage then deliver, and is disabled while working')  // failure toasts "Couldn't export this page. Try again."
```
- [ ] **Step 2:** Implement. Every edit goes through `store.updatePage`; a drag moves the node directly and commits once on release. Captions are uncontrolled `plaintext-only` fields, saved on input, Enter blurs. Delete key: same square keycap as Back, bin icon, left of Export. Page opens at 100%; assemble animation only on a newly generated page.
- [ ] **Step 3:** Pass; browser at both widths: drag, bubble, six frames, caption, zoom and pan, export a real page and open the PNG, reload keeps every edit. Commit `feat: edit, export and delete pages`.

### Task 12: Stickers, music cover, camera

**Files:** Create `src/features/{stickers,album,camera}/*`, `features/page/Tray.tsx` and tests. Source: `prototype/js/{stickers,album,camera}.js`, `main.js` tool handlers, `index.html`.

**Interfaces — Produces:**

```ts
export const imagesFull: (p: Page) => boolean;
export interface AlbumHit { key: string; title: string; artist: string; thumb: string; cover: string }
export function searchAlbums(q: string, signal: AbortSignal, f?: typeof fetch): Promise<{ list: AlbumHit[]; status: string }>;
export function fetchCover(url: string, f?: typeof fetch): Promise<StoredImage>;
export function addCard(store, pageId: string, kind: 'camera'|'album', image: StoredImage, album?: { title: string; artist: string }): string[] | null; // new item ids; null if page gone or full
export function cameraSession(media: MediaDevices): { start(facing: 'user'|'environment'): Promise<MediaStream | null>; stop(): void };
```

- [ ] **Step 1:** Failing tests:

```ts
expect(imagesFull(pageWith({ photo: 5, album: 3 }))).toBe(false); expect(imagesFull(pageWith({ photo: 4, camera: 2 }))).toBe(true);
it('uses MusicBrainz, then iTunes when it is empty or fails')   // status strings exactly as album.js
it('rejects a cover that cannot be downloaded')                  // toast "Couldn't download that cover. Try another." and page unchanged
it('adds to the page it started on', …)                          // route changed meanwhile; original page gains the card
it('drops the piece if that page is gone', …)                    // addCard returns null, no throw
it('stops a stream that arrives after the dialog closed', async () => {
  const s = cameraSession(slowMedia); const pending = s.start('environment'); s.stop(); resolve(stream);
  expect(await pending).toBeNull(); expect(track.stop).toHaveBeenCalled();
});
it('disables Add Image at six')                                  // aria-disabled, label 'Limit of 6 images reached'
```
- [ ] **Step 2:** Implement. Toasts and fallbacks as prototype; camera shots and files go through `importImage`; developing effect via `freshCardId`; sticker dialog remembers its tab; placed sticker is selected after 720 ms.
- [ ] **Step 3:** Pass; browser: add one of each (camera may be blocked there, so check "From files"); reload; export includes the cover. Commit `feat: stickers, music covers and camera`.

### Task 13: Side-by-side check and hand-over

**Files:** Create `app/README.md`; fix whatever the check finds.

- [ ] **Step 1:** `npm test && npm run typecheck && npm run build` all pass.
- [ ] **Step 2:** With prototype (5190) and app (5191) running, walk every bullet of spec §6 and §7 at 1440 × 900 and 390 × 844, plus reduced motion and keyboard only. Fix differences, each with its own commit.
- [ ] **Step 3:** Confirm the network log shows only the allowed hosts, and the built `dist/` works from a static server (`npm run preview`).
- [ ] **Step 4:** Quit-and-reopen check: create, edit, close the browser tab, reopen; identical.
- [ ] **Step 5:** README: how to run, test and build; where data lives; the Safari storage warning. Commit `docs: how to run Scrap Desk`.
- [ ] **Step 6:** Ask the user to check in Safari: open the app, use the camera, export a page.
