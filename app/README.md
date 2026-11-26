# Scrap Desk

A digital junk journal for desktop and mobile browsers. Pick a date, write a few lines, add up to six photos, and the app builds a scrapbook page you can edit and save as an image.

Live at https://scrap-desk-gamma.vercel.app

## Run it

Needs Node 20.19 or newer. In this folder:

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5191.

| Command | Does |
|---|---|
| `npm run dev` | development server on port 5191 |
| `npm test` | automated tests |
| `npm run typecheck` | type check |
| `npm run build` | production files in `dist/` (any static host works) |
| `npm run preview` | serves the built files on port 5192 |
| `npm run assets` | copies the art from `../prototype/assets` into `public/art/` |
| `npm run golden` | re-records the prototype's engine output used by the tests |

In development, `#/dev/export` shows a page with every kind of piece next to its exported image.

## Where journals live

Everything is stored in your browser (IndexedDB), on this device only. Nothing is uploaded; the only outside requests are album-cover searches to MusicBrainz, the Cover Art Archive and iTunes.

- Clearing the browser's site data erases your journals.
- Safari can clear a site's data after about a week of browser use without a visit.
- Each address keeps its own data: pages made on port 5191 don't appear on port 5192.
- **Export** is the only copy outside the browser until backup exists.

## Camera

Browsers open the camera only on `localhost` or HTTPS. Elsewhere, use **From files**.

## Not built yet

The AI art director (a rule-based one stands in), backup, and editing a page's date or story after it is made. The supplied art is not offered for reuse.

## Deploying

The site is hosted on Vercel. From this folder:

```bash
vercel deploy --prod
```
