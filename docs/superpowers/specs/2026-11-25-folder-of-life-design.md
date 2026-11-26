# Folder of Life — Design

Status: draft for approval · 2026-11-25
Scope of this doc: the whole product, plus the order we build it in. **Milestone 0 (UI prototype) is the only thing being built right now, and it is throwaway.**

---

## 1. Intent and why

Folder of Life is a digital junk-journal / scrapbook for web (desktop and mobile browsers).
Someone writes a few lines about a day or a stretch of days, adds up to six photos, and the app builds a finished scrapbook page: photos taped in as polaroids, a handwritten pull-quote, wax-seal stamps, leaves, torn pattern strips, tape, clips, pins.

It exists for **anyone who wants a handmade journal without physically scrapbooking.** Pages are private to the person unless they choose to export an image to their device.

The page must **feel handmade, by that person, and feel like the site understood how they felt in that moment.** That second sentence is the product. Everything else is craft in service of it.

Example input (the sample project): *"November was quite depressing initially. But just as Diwali started, things started getting better, my friends came over to cook food and celebrate me moving out… I found a very cute and unique lady bug at office… there were some really dark days while there were some really beautiful days. I will cherish it all"* + five photos (selfie at office, friends cooking).
A good page for this holds the **arc**: a muted, heavier beginning that turns warm and golden — not a generic happy page.

## 2. Goals

1. A page that reads the story's *mood and arc* and dresses itself accordingly (palette, stamps, leaves, tape, quote, captions).
2. A believable handmade look: slight rotations, tape, shadows, torn edges, mixed paper — never a rigid grid, never overlapping text.
3. A home screen that matches the wireframe: tabbed paper folders in a stack, folder/list toggle, "Start New" with ↑ ↓.
4. Create flow: **date or date range (mandatory)** → story → up to 6 photos → folder name (default "Unnamed Folder") → Generate.
5. Extras: album-cover polaroids (open-source API), instant camera photo, hover-to-choose polaroid frame.
6. Smooth, physical-feeling transitions and interactions using WebGL / Three.js.
7. Works on desktop web and mobile web.
8. **Costs the user nothing**, including the LLM, hosting, fonts, libraries and APIs.

## 3. Non-goals

- No accounts, sync, sharing, social feed, or collaboration (v1).
- No native apps.
- No free-form pixel editor. Light hand-editing (drag, rotate, swap, delete, regenerate) only.
- No user-uploaded stickers in v1.
- Not a general photo editor.

## 4. Anti-goals (failure even if it "works")

- Looks like a template with random clip-art sprinkled on it.
- Cheerful by default: a hard month must not get confetti.
- Text overlapping photos, text unreadable on busy paper, photos cropped to hide faces.
- Generation that breaks or hangs when the free LLM is rate-limited.
- Anything that silently costs money or requires a card.
- Story text leaving the device without the person being told.

## 5. Constraints

- **Free only.** Free fonts (Google Fonts), MIT libraries (React, Three.js, Vite), free APIs, free hosting tier when we deploy.
- **Private by default.** Data lives in the browser (IndexedDB). Export is explicit.
- **Mobile web must work.** Camera needs HTTPS or localhost.
- Provided assets are the visual vocabulary: `Folder design` (11 folder colours), `Stamp designs` (32 wax seals), `Leaves designs` (19), `Pattern designs` (9 torn strips), `Objects` (clips, pins, tape, tags, polaroid frame, cameras, turntable), `Button designs.png` (cardboard buttons), `Moodboard` and the three SVG exports in `Figma Design`.
- No project folder is a git repo yet; specs live in `docs/superpowers/specs/`.

## 6. Approaches considered

For how the page "brain" works:

| | Approach | Trade-off |
|---|---|---|
| A | Rules only: keyword → palette/stickers → fixed layouts | Instant, free, offline. Can't read an arc ("dark, then warm"). |
| **B** | **LLM writes an *art direction*; a deterministic layout engine places everything** | Understands feeling; layout stays safe (no overlaps). Needs a free LLM + tiny proxy. |
| C | LLM places every item with coordinates | Flexible but unreliable: overlaps, slow, costly. Rejected. |

**Chosen: B, with a free LLM**, built in two steps: the layout engine takes an *art-direction object*; the prototype produces it with a local rule-based "director" (A); the real build swaps in a free hosted LLM behind the same interface. Rule-based director stays forever as the fallback when the LLM is rate-limited, offline or slow.

## 7. Decisions (these are my calls unless marked "you")

| # | Decision | Why |
|---|---|---|
| 1 | React + Vite + TypeScript, mobile-first responsive | Plain, free, fast local dev; easy to deploy anywhere |
| 2 | Pages rendered as live HTML/CSS (SVG filters for torn edges); export by rasterising that DOM to PNG | Real text, crisp export; canvas text is a pain |
| 3 | **Three.js (you)** for the stage: folder stack, open/close, page lift, flip, hover lift, light on wax seals. DOM for forms/text/layout | Physical feel where it matters, accessibility where it counts |
| 4 | Three.js degrades to CSS motion when WebGL is missing, on weak phones, or with reduced-motion | Must never block use |
| 5 | **Free LLM (you)**: hosted free tier (Groq or Gemini; pick at build after reading live limits) behind a tiny proxy so the key never reaches the browser; rule-based fallback on any failure | Free, fast, keeps the key private |
| 6 | Show a one-line note on first generate: "Your story text is sent to an AI service to design the page." Later optional "fully private" mode with an in-browser model (WebLLM, needs recent Chrome/Edge) | Honest about the one place privacy leaks |
| 7 | Storage: IndexedDB in the browser, photos downscaled on import | Private, free, offline |
| 8 | Album covers: **MusicBrainz search + Cover Art Archive** (open source); iTunes Search as fallback | You asked for open source |
| 9 | Camera: browser `getUserMedia`, shot develops like an instant photo | Free, no SDK |
| 10 | Fonts: a serif for titles, a mono for tab labels (matches wireframe), 2 handwriting faces for story/captions | Free via Google Fonts |
| 11 | Buttons use the real art from `Cardboard UI Component Assets Sheet.png` (bar, toggle, keycaps, icons, text), cut out and laid out exactly as the sheet's example; every other key is the same keycap, 9-sliced to any width | Matches your design pixel-for-pixel; stretches without distorting edges |
| 13 | Folder back panel is made taller (the strip between the top edge and front flap is stretched), with full-width paper sheets and the latest photo standing in that pocket; the folder's own front flap is redrawn on top | Reads as papers inside a folder, like the reference |
| 12 | Stationery sheet (`Pasted…1.09.05`) is cut into individual transparent stickers; the 32 wax seals are cut out of their solid backgrounds (they are not transparent as supplied); polaroid frame and camera photos are rebuilt in CSS / cut out | The sheet ships as one flat image and the seals ship on an off-white ground |

## 8. Screens and flows

**Home** (wireframe `Frame 1.svg`)
- Serif title "Folder of Life". Tall stack of tabbed paper folders; tabs step across the width; stack runs off the bottom.
- Folder label printed on its tab in mono caps. Folder colour comes from the 11 provided folders (mirrored for right-hand tabs).
- Bottom-left: cardboard **folder / list** toggle. Bottom-right: cardboard **↑ ↓ Start New** bar. ↑ ↓ (and swipe / wheel / keys) step through folders.
- Selecting a folder lifts it, then it opens to its pages.

**Inside a folder**: pages as sheets fanned out like papers in a folder (grid) or as a list (toggle). Tap one to open it; the sheet lifts out of the folder.

**Start New** (steps, can be one scrolling sheet on mobile)
1. Date or date range — **required**; Generate stays disabled without it.
2. A few lines of story.
3. Up to 6 photos (counter, reorder, remove).
4. Folder — pick existing or name a new one; default "Unnamed Folder".
5. **Generate.** Short "reading your story…" moment, then the page assembles piece by piece.

**Page view**
- A sheet (paper, punched holes, clip) with: date label, handwritten story note, polaroid photos, pulled quote, stamps, leaves, torn pattern strips, tape, pins, small captions.
- Hover (or tap) a polaroid → frame options (polaroid, instax wide, film strip, kraft mat, rounded, plain, tape corners).
- **+ Album**: search a song/album/artist, pick a cover; becomes a polaroid with a record peeking out.
- **+ Camera**: viewfinder, shoot, the photo develops in; becomes a polaroid.
- Drag / rotate / delete pieces. **Regenerate** reshuffles the layout with the same art direction. **Export PNG.**

## 9. The art direction (the contract between "brain" and layout)

```jsonc
{
  "mood": { "arc": ["heavy", "warm"], "summary": "hard month that turned golden", "energy": 0.4 },
  "palette": { "paper": "#efe6d6", "ink": "#2b2118", "accent": "#b4772a", "tape": "kraft" },
  "quote": "not all was bad this month",           // pulled from the story, never invented
  "title": "November",
  "captions": ["Diwali with family", "friends came to cook"],   // <= 6 words each
  "stickers": {
    "stamps":  ["gold-sun", "burgundy-leaf"],
    "leaves":  ["orange-birch", "brown-maple"],
    "patterns":["printed-text-strip"],
    "objects": ["kraft-tape", "red-pin", "bulldog-clip"]
  },
  "density": "medium",                                // sparse | medium | rich
  "photoTreatment": "warm-faded"
}
```

Rules: values come from the asset catalogue only (unknown ids are dropped); quote must be a substring of the story; captions never invent facts; a "heavy→warm" arc puts cool/muted pieces early (top/left) and gold/warm late (bottom/right).

## 10. Layout engine (deterministic, seeded)

1. Page is a fixed 3:4 sheet; coordinates in sheet units, scaled to any screen.
2. Pick a **template** by photo count (0–6) from a hand-designed set informed by the Pinterest/moodboard references; each template defines slots with allowed rotation/size ranges.
3. Place photos, then the story note, then date label/quote, then decorations by rejection sampling against occupied rectangles (+ margin). Text blocks are never overlapped.
4. Seed = story hash + regenerate counter, so a page is reproducible and "Regenerate" gives a new variation.
5. Photos use `object-fit: cover` with a face-safe focal point (centre-biased); never cropped below a minimum visible fraction.

## 11. Data

`Folder { id, name, colour, createdAt }` · `Page { id, folderId, dateStart, dateEnd, story, photos[], direction, seed, items[] }` where `items[]` stores every placed piece (type, asset id, x, y, rotation, scale, z, frame). Photos stored as downscaled blobs. All in IndexedDB.

## 12. Milestones

- **M0 — UI prototype (now, throwaway).** Static/clickable, mock data, rule-based director, real MusicBrainz/CAA search, real camera. Purpose: you judge the look and feel. Nothing from it is kept unless you say so.
- **M1 — Real components** (after you approve M0): Vite/React/TS app, design tokens, components, layout engine, IndexedDB.
- **M2 — Free LLM director + proxy**, privacy note.
- **M3 — Polish**: Three.js page flip/curl, export, mobile pass, accessibility, optional private mode.

## 13. Left to the builder

Exact template geometry, easing curves and durations, final font pairings, the asset tag table, tab-label truncation rules, photo downscale size, and which free LLM provider to start with (decide after reading the live limits).

## 14. Known limits of the M0 prototype

- The "director" is rule-based; photo-specific captions need a vision model (M2), so polaroid captions show the date and are editable.
- Export to PNG, saving and the page-flip curl are not in M0.
- Camera capture was not testable in the review browser (it blocks camera); the permission-denied and file-picker fallbacks were.
- A few pale seals (ivory butterfly, lily, rose) have slightly ragged cut-out edges.

## 15. Calls I made that you should check

Mirroring folder PNGs for right-hand tabs · rebuilding the buttons in CSS · cutting the stationery sheet into stickers · Three.js limited to the stage, DOM for text · a privacy note instead of blocking cloud use · M0 is throwaway.
