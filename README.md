# Stellar Symphony

Static Next.js (App Router) experience that renders an interactive 3D sky sphere with a few thousand static stars, constellation lines, and an ambient Tone.js generator mapped to star parameters.

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Data loads from `/public/data/stars.json` and `/public/data/constellations.json`.

### Refresh data

```bash
npm run data
```

Generates ~2k background stars plus curated bright stars and writes `/public/data/stars.json` and `/public/data/constellations.json`. The generator is deterministic; edit `scripts/build-stars.ts` to change density or curated lists.

## Project layout

- `app/page.tsx` — client page, loads static JSON, wires scene + UI.
- `components/*` — R3F scene (`SkyScene`, `StarField`, `ConstellationLines`), UI controls, info panel.
- `audio/*` — Tone.js engine and parameter mappings.
- `lib/*` — shared types and astro utilities (RA/Dec → XYZ, clamps).
- `public/data/*` — static datasets served at `/data/*`.
- `scripts/build-stars.ts` — build-time ingestion skeleton (TODO: fetch/merge real catalogs).
- `data_sources/famous_stars.csv` — curated seeds for the build script.

## Audio

Audio only starts after pressing Play. Two layers (pad + particles) flow through filter + reverb; mapping controlled in `audio/mappings.ts`. Use Re-seed to randomize within the same star identity.

## Deploy

The site is fully static; `next build && next export` (or host with Vercel/Cloudflare Pages) works. Keep `/public/data` in the build output.

## Tests

Add vitest unit tests for `lib/astro.ts` and `audio/mappings.ts` (baseline configuration is included in `package.json`).
