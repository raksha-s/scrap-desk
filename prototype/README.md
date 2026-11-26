# Scrap Desk — UI prototype (throwaway)

Milestone 0 of `docs/superpowers/specs/2026-11-25-folder-of-life-design.md`.
Purpose: judge the look and feel. Nothing here is the real app, and the "AI" is a rule-based mock.

## Run it

```bash
cd "/Users/rakshas/Junk Journal Project/prototype"
python3 serve.py 5190   # no-cache dev server, so edits show up on refresh
```

Open http://localhost:5190 (needs internet for Google Fonts and the album-cover search).
Camera needs `localhost` or HTTPS, so it works on this machine; on a phone you will need an HTTPS tunnel.

## What is real vs mocked

- Real: the Three.js folder stack and transitions, the sound effects (synthesised in `js/sound.js`, no audio files), the layout engine, drag/rotate/resize, frame picker, MusicBrainz + Cover Art Archive search, camera, responsive layout.
- Mocked: the art director (rule-based, `js/director.js`), photo-specific captions (needs a vision model), export to PNG, saving (everything resets on reload).
- `assets/` is generated from your source folders by a prep step (wax seals and the stationery sheet were cut out of solid backgrounds).
