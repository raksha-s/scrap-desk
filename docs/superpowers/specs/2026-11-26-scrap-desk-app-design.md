# Scrap Desk — Real App (Milestone 1) Design

Status: approved · 2026-11-26
Builds on `2026-11-25-folder-of-life-design.md` (the whole-product design). Where the two differ, this document wins.

---

## 1. Intent and why

Scrap Desk (formerly "Folder of Life") is a digital junk journal for desktop and mobile web, for anyone who wants a handmade journal without physically scrapbooking. The product promise is that a finished page feels handmade, by that person, and that the app understood how they felt.

The UI prototype in `prototype/` has been refined over many rounds and **approved**. This milestone turns it into a real app: **the same look and feel, with journals that are kept, and pages that can be saved as images.**

## 2. Goals

1. Everything in section 6 works and looks as it does in the prototype.
2. Folders, pages, photos and edits survive refresh, tab close and browser restart.
3. **Export** saves the page as a PNG that matches the screen.
4. A codebase in which the free-AI milestone can be added by swapping one module.
5. Still costs nothing: free libraries, fonts and APIs only.

**Done means:** prototype and app compared side by side at desktop (1440 × 900) and phone (390 × 844) widths with no unintended differences; a page created, edited and reopened after a browser restart is identical; exported PNGs match in Chrome and Safari; tests and production build pass.

## 3. Non-goals (this milestone)

Real AI (next milestone) · hosting or deployment · accounts, sync, sharing · backup/restore · editing a page's date or story after it is made · regenerate · undo · installable/offline app · new visual features or redesigns.

## 4. Anti-goals

- The feel drifts from the approved prototype (motion, sounds, spacing, art).
- A journal is lost, or a save fails silently.
- Anything silently costs money, or story text or photos leave the device.

## 5. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen by you)** | New React + TypeScript app; carry the folder animation, layout engine, director, sounds, styling and art across with little change; rebuild screens and storage | Keeps the approved feel, quicker. Some prototype code needs tidying. |
| B | Rewrite everything, prototype as visual reference only | Cleaner, much slower, fine-tuned details could drift |
| C | Keep the plain-JavaScript prototype and add saving to it (my rejection) | Fastest now, but one large script and global state make later work fragile |

## 6. What the app does (carried over from the prototype)

**Desk (home)**
- Title "Scrap Desk". Three.js stack of tabbed folders on a paper background; tabs alternate sides. Hover lifts; wheel, drag and ↑ ↓ move through the stack; click a folder behind to bring it forward, click the front one (or Enter) to open it.
- A folder with pages shows white sheets in its pocket and its most recent photo peeking out. Empty folders stay empty.
- Cardboard folder/list toggle (selected key sits pressed in) and **+ Add New** key.

**Inside a folder**
- Square back-arrow key, folder name and page count, page thumbnails, a "Start a page here" card, and an empty-folder message.
- Top right: **+ Add New** (a square **+** on phones) and **⋮** with **Edit name** (28 characters max; Enter or clicking away saves, Esc cancels) and **Change color** (the 11 folder colors; stays open for trying them).

**Add New (writing pad)**, one question per sheet with page-flip:
1. Which folder? Coloured folder tiles plus "New folder" (default name "Unnamed Folder"). Nothing preselected unless started inside a folder.
2. When was it? One day or a date range. **Required.**
3. What happened? Ruled paper, up to 900 characters, optional.
4. Photos: six slots, picker or drag-and-drop, removable.

**Generate** is enabled once folder and date are valid. The "Reading your story…" screen plays (at least about 2.6 s), then the page assembles piece by piece.

**Journal page**
- White 3:4 sheet (900 × 1200 design units) with punched holes: title, date, story note, quote, photos, tape, patterns, loose paper, leaves, wax seals, flowers, a cat, clips, pins and word labels. No overlapping text.
- Drag any piece. Selected piece: rotate, smaller, bigger, bring to front, delete. Photos: six frames on hover or tap (Polaroid, Instax, Film strip, Kraft mat, Rounded, Torn edge). Captions are editable.
- Top: back arrow, date, **Export**.
- Bottom bar: record (**Add Music Cover**, disc slides out), camera (**Add Image**, print peeks out; off at 6 images, album covers not counted), stamp (**Add Sticker**, tilts forward).
- Sticker picker with seven tabs, reopening on the last used. Album search: MusicBrainz + Cover Art Archive, iTunes as fallback. Camera: viewfinder, flip, "From files", flash, developing effect.
- Cardboard zoom bar bottom right: 50–300%, fit button, drag empty space to pan.

**Everywhere:** synthesised cardboard-tap and paper sounds, keyboard support, reduced-motion support, current phone layouts.

## 7. What is new

### 7.1 Saving
- Stored in the browser (IndexedDB). No save button: creating, adding, moving, resizing, reframing, captioning, deleting, renaming and recolouring save as they happen.
- Photos and camera shots are downscaled on import (long side 1600 px) and stored as image files. A chosen album cover is downloaded and stored too, so old pages never depend on the internet.
- The app asks the browser to keep its data (`navigator.storage.persist()`).
- If saving fails (storage full, blocked, private window), a visible message says so; what is on screen stays.
- A page is saved only when complete. If generating fails, no half-made page appears and the writing pad's answers are not discarded.
- If an album cover cannot be downloaded, a message says so and nothing is added.
- Folders and pages are listed in the order they were created. A link to something that no longer exists opens the desk.
- Two tabs open at once: the latest change wins.

### 7.2 Export
- Saves only the sheet (no desk, controls or selection outlines) as a 1800 × 2400 PNG named `scrap-desk-<start date>.png`.
- Includes fonts, photo tints, frames, torn edges, tape and shadows.
- On phones that support it, opens the share sheet (so it can go to Photos); otherwise downloads.
- Build a small trial first, in Chrome and Safari, to choose between an MIT library that turns the page into an image (`modern-screenshot` or `html-to-image`) and drawing it ourselves on a canvas.
- Album cover hosts currently allow the download this needs (checked 2026-11-26).

### 7.3 Deleting
Real saving means unwanted pages would otherwise stay forever. Add **Delete folder** to the folder's ⋮ menu and a delete key beside **Export** on a page. Both ask for confirmation, saying what will go; deleting is permanent. Same cardboard styling. Deleting a page returns to its folder; deleting a folder returns to the desk. If no folders are left, the desk is empty with **+ Add New**, and the writing pad offers "New folder".

### 7.4 First visit and clean-up
- A new visitor gets one empty "Unnamed Folder". No demo content.
- Removed: the "UI prototype" flag, "Load my sample", seeded pages and sample photos.
- Without WebGL the desk opens in list view, and the 3D toggle is disabled. Nothing else may depend on WebGL.
- Fonts (Instrument Serif, IBM Plex Mono, Caveat, Reenie Beanie) are bundled with the app, not loaded from Google.

## 8. How it is built

- New folder `app/`; `prototype/` stays untouched as the visual reference.
- React, Vite, TypeScript. Three.js from npm. Static build output, no server.
- Hash routes as now: desk, `#/f/<folder>`, `#/p/<page>`.

| Part | Does | Depends on |
|---|---|---|
| `engine/` | dates, director, asset tags, layout, seeded randomness. Ported to TypeScript with the same results | asset manifest; text measuring passed in |
| `stage/` | the Three.js desk, ported as a self-contained class, wrapped by one component | folder data given to it |
| `sound/` | synthesised effects | nothing |
| `storage/` | the only code that touches IndexedDB; versioned schema | nothing |
| `features/` | desk, folder, page + editor, writing pad, stickers, album, camera, export | the above |
| `styles/` | prototype stylesheet split by screen, values unchanged | nothing |

**Data**
- `Folder { id, name, skin, createdAt }`
- `Page { id, folderId, start, end, story, cards[], direction, items[], createdAt, updatedAt }`; `cards[]` refer to stored images by id; `items[]` hold every piece's type, art, position, size, rotation, order and frame.
- `Image { id, blob, width, height }`; removed when nothing uses it.

Layout runs only when a page is created or a piece is added; a saved page is drawn from its `items`, so later layout changes never rearrange old pages.

**Director contract.** `direct(input) → Promise<ArtDirection>`, with the shape the prototype's `js/director.js` returns today. Layout uses only that object. The next milestone adds an AI implementation, validated against the asset list, with the rule-based one as fallback.

**Assets.** Copied from `prototype/assets`. May be compressed if there is no visible change.

## 9. Testing

- Automated: dates, director, layout (same input gives same page; on test stories of 0–900 characters with 0–6 photos, text blocks do not overlap and stay on the sheet, fixing the carried-over engine where it fails), storage (round trip, delete clean-up, failure message), writing-pad rules, six-image limit.
- In the browser: every item in section 6 and 7 at both widths, compared with the prototype.
- On real hardware, by you: camera and export on a phone need a secure (HTTPS) address, which arrives with hosting. On this computer both work at `localhost`.

## 10. Risks

- Export may render differently in Safari; the trial in 7.2 comes first.
- Browser storage is not a permanent archive: clearing browser data erases journals, and Safari can clear a site's data after about a week of browser use without a visit. Export is the only copy outside the browser until backup exists.
- Rights for some supplied art (cat pictures, postcards and similar) are unverified. Check before publishing the app publicly.

## 11. Calls I made that you should check

Delete added (7.3) · empty first visit with one folder · no demo content · list view when 3D is unavailable · photos downscaled to 1600 px · export size, name and phone share sheet · fonts bundled · app in `app/`, prototype kept · set up git in this project when the build starts, so each step can be undone · hosting and backup left for later.

## 12. Left to the builder

State library, IndexedDB helper, component boundaries, export technique (after the trial), image format and quality, test tooling details, confirmation dialog wording.

## 13. After this

M2 free AI director with a privacy note · M3 polish, hosting, backup, page-flip curl.
