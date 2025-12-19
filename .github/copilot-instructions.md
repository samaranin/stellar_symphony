# Copilot Instructions — Stellar Symphony (MVP)

## Role

You are acting as a senior full-stack engineer focused on **high-performance WebGL**, **clean TypeScript**, and **deterministic browser audio**.

## Objective

Build **Stellar Symphony**, a **static** web application that renders an **interactive 3D sky sphere** with stars and constellation lines. On selecting a star, the camera smoothly rotates/zooms to it, a details panel opens, and an **in-browser ambient music generator** (Tone.js/Web Audio) plays music derived from that star’s parameters.

## Hard Constraints

* **No runtime backend / no database.**
* All app data must load from **static files** served from `/public/data/*`.
* The site must be deployable as static hosting (Vercel/Cloudflare Pages acceptable).
* Audio must **NOT autoplay**. Start only after explicit user gesture (Play button).
* MVP needs only **a few thousand stars**, plus a curated set of “famous” named stars.

## Target Stack

* Next.js (App Router) + **TypeScript**
* Tailwind CSS (optional shadcn/ui)
* Three.js via **@react-three/fiber** and **@react-three/drei**
* **Tone.js** for audio generation
* Optional for animations: simple lerp per frame (avoid heavy libs unless needed)

---

## Core Features (MVP)

### 1) 3D Sky Sphere + Starfield

* Render a sphere of radius `R` (e.g., 100) centered at `(0,0,0)`.
* Render stars as a performant single geometry:

  * Preferred: `THREE.Points` + `BufferGeometry`
  * Store `position`, `color`, and optionally `size`/`magnitude` attributes.
* Stars are positioned by RA/Dec → XYZ on the sphere surface.

**RA/Dec → XYZ conversion (required)**

* Inputs: `raDeg` in `[0..360)`, `decDeg` in `[-90..90]`, `R`.
* Convert degrees to radians and compute:

  * `x = R * cos(dec) * cos(ra)`
  * `y = R * sin(dec)`
  * `z = R * cos(dec) * sin(ra)`

### 2) Star Picking (Click/Tap) + Highlight

* Implement selection via **raycasting** on the `Points`.
* Use the intersection `index` to identify the star record.
* Hover (desktop) should highlight a star (optional but recommended).
* Mobile: tap selects (hover not required).

### 3) Smooth Camera Focus on Star

* Use `OrbitControls` or custom controls with constraints:

  * allow orbit rotation around origin
  * limit zoom to avoid clipping into the sphere
* When a star is selected:

  * smoothly animate camera position + target to the star within ~0.6–1.2s.
  * do per-frame lerp (no layout thrash / no allocations).

**Camera focusing rule (required)**

* Let `p` be star position on sphere.
* `dir = normalize(p)`
* `desiredCamera = dir * (R * cameraDistanceFactor)`; default factor ~`1.6`
* `desiredTarget = p` (or `p * 0.98`)

### 4) Constellation Lines Overlay

* Render constellation lines as `LineSegments`.
* Data format: constellations contain edges as pairs of star IDs.
* Avoid z-fighting by pushing endpoints slightly outward: `p * 1.001`.
* UI toggle: show/hide constellation overlay.

### 5) Star Details Panel + Audio Player

When star is selected, show:

* name (if available)
* identifiers (Bayer, HIP/HD, etc. if available)
* magnitude, spectral type, temperature, distance (optional fields)
  Controls:
* Play/Pause (required)
* Volume (required)
* “Re-seed / Regenerate variation” (required)

### 6) In-Browser Ambient Music Generation (Tone.js)

* Must run fully in browser, using Tone.js.
* Must not autoplay; only start after user gesture.
* Sound should be *star-identity consistent* but allow variation via re-seed.

**Minimum audio architecture (required)**

* Two layers:

  1. Pad layer (slow chords, long ADSR)
  2. Particle layer (sparse plucks/bells/noise)
* Effects chain: reverb + lowpass filter (delay optional)

**Minimum parameter mapping (required)**

* `mag` influences:

  * overall gain (clamped)
  * particle density (brighter → slightly more activity)
* `temp` or `spec` influences:

  * filter cutoff (hotter → brighter timbre)
  * base register / chord voicing
* `dist` (if available) influences:

  * reverb wet/decay (farther → more spacious)

**Audio quality requirements**

* No clipping at default settings
* Responsive play/stop (<200ms perceived)
* Efficient CPU on mid-range devices (avoid excessive polyphony)

---

## Data Requirements (Static)

### Star Data File

Location: `/public/data/stars.json`

**Schema (MVP)**

```json
[
  {
    "id": "hip_32349",
    "name": "Sirius",
    "bayer": "α CMa",
    "ra": 101.287155,
    "dec": -16.716116,
    "mag": -1.46,
    "dist": 2.64,
    "spec": "A1V",
    "temp": 9940
  }
]
```

Required fields: `id`, `ra`, `dec`, `mag`
Optional fields: `name`, `bayer`, `dist`, `spec`, `temp`

### Constellations Data File

Location: `/public/data/constellations.json`

**Schema**

```json
[
  {
    "id": "ori",
    "name": "Orion",
    "edges": [["hip_24436","hip_25336"], ["hip_25336","hip_27989"]]
  }
]
```

### Curated List (Input to Build Script)

Location: `/data_sources/famous_stars.csv`
Columns: `query_name,preferred_name,notes`

---

## Build-Time Data Ingestion (No Runtime Backend)

Create scripts that can generate `stars.json` at build-time (optional for MVP implementation order, but must exist as a documented path).

**Requirements**

* Script(s) should:

  * fetch/enrich famous stars list (e.g., from SIMBAD) OR accept manually-curated JSON for MVP
  * optionally append “background stars”
  * deduplicate and validate ranges
  * output to `/public/data/*`
* Include caching to avoid repeated fetches (store raw responses under `/cache`).
* Implement throttling and retries with exponential backoff.

If implementing the fetch is too time-consuming for MVP, provide a **manual seed dataset** + a script skeleton with TODOs.

---

## UX Requirements

* Fullscreen 3D canvas
* Details panel:

  * desktop: right side panel
  * mobile: bottom sheet
* Loading state while fetching JSON
* Error UI for missing WebGL or failed data load
* Respect `prefers-reduced-motion` by reducing camera animation (or allow instant focus)

---

## Performance Requirements

* Target ~60fps desktop, ~30fps mobile.
* Avoid per-frame allocations.
* Keep `stars.json` small (aim < 2–5MB). If larger, propose binary format later (non-MVP).

---

## Code Organization (Expected)

```
/app
  page.tsx
/components
  SkyScene.tsx
  StarField.tsx
  ConstellationLines.tsx
  StarInfoPanel.tsx
  ControlsBar.tsx
/audio
  engine.ts
  mappings.ts
/lib
  astro.ts        // RA/Dec conversions, clamping utilities
  types.ts
/scripts
  build-stars.ts
/public/data
  stars.json
  constellations.json
```

---

## Implementation Guidance (Do This)

1. Start with scene + rendering pipeline (R3F, camera, controls).
2. Implement loading + parsing static JSON.
3. Render stars as `Points` with `BufferGeometry`.
4. Add raycasting selection and selection state management.
5. Add smooth camera focusing.
6. Add constellation lines overlay + toggle.
7. Build details panel UI.
8. Implement Tone.js audio engine:

   * initialize on gesture
   * play/stop
   * star → params mapping
   * re-seed
9. Add small QA checklist + basic unit tests for RA/Dec conversion and mapping clamps.

---

## Non-Goals (Explicitly Out of Scope for MVP)

* User accounts, persistence beyond localStorage settings
* Real-time API calls from the browser to astronomy databases
* Photorealistic galaxy backgrounds
* Tens/hundreds of thousands of stars

---

## Acceptance Criteria (Must Pass)

* App runs fully from static hosting with `/public/data/*`.
* Renders starfield + at least 5 constellations.
* Selecting a star:

  * reliably identifies it (correct record)
  * smoothly focuses camera on it
  * opens details panel with star info
* Audio:

  * plays ambient sound derived from star parameters
  * play/pause/volume/re-seed work
  * does not autoplay
* Works on latest Chrome and mobile Safari/Chrome without crashing.

---

## Coding Standards

* TypeScript strict types; define shared types in `/lib/types.ts`.
* No unnecessary dependencies.
* Keep components small and testable.
* Avoid creating new arrays/objects in `useFrame` loops; precompute buffers.
* Document key math and mapping logic with concise comments.

---

## Deliverables

* Working MVP implementing all acceptance criteria
* Seed `stars.json` + `constellations.json` committed
* Build script skeleton (or working) documented in `README.md`
* Clear instructions to run locally and deploy statically
