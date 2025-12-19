# Copilot Instructions — Stellar Symphony

## Role

You are acting as a senior full-stack engineer focused on **high-performance WebGL**, **clean TypeScript**, and **deterministic browser audio**.

## Objective

**Stellar Symphony** is a **static** web application that renders an **interactive 3D sky sphere** with stars and constellation lines. On selecting a star, the camera smoothly rotates/zooms to it, a details panel opens, and an **in-browser ambient music generator** (Tone.js/Web Audio) plays music derived from that star's parameters using **Markov chains** and **genetic algorithms**.

## Current Implementation Status

### ✅ Completed Features

1. **3D Sky Sphere + Starfield**
   - 90+ real stars with accurate Hipparcos coordinates
   - THREE.Points with BufferGeometry for performance
   - RA/Dec → XYZ conversion

2. **Star Picking + Camera Focus**
   - Raycasting on Points geometry
   - Smooth camera animation (lerp-based)
   - OrbitControls with zoom constraints

3. **19 Constellations**
   - Orion, Ursa Major, Cassiopeia, Cygnus, Leo, Scorpius
   - Famous asterisms: Winter/Summer/Spring Triangle
   - LineSegments with z-fighting prevention

4. **Procedural Music Generation**
   - Markov chains for note transitions
   - Genetic algorithm for phrase evolution
   - Star parameters → audio mapping
   - Tone.js: PolySynth, Reverb, Filter, Delay

5. **UI Components**
   - Star details panel with Play/Stop/Volume/Re-seed
   - Constellation toggle
   - Responsive design

## Hard Constraints

* **No runtime backend / no database.**
* All app data must load from **static files** served from `/public/data/*`.
* The site must be deployable as static hosting (Vercel/Cloudflare Pages).
* Audio must **NOT autoplay**. Start only after explicit user gesture (Play button).

## Tech Stack

* Next.js 14 (App Router) + **TypeScript**
* Tailwind CSS
* Three.js via **@react-three/fiber** and **@react-three/drei**
* **Tone.js** 14.8 for audio generation
* **Vitest** for unit testing

---

## Core Technical Details

### RA/Dec → XYZ Conversion

```typescript
// lib/astro.ts
export function raDecToXYZ(raDeg: number, decDeg: number, R: number): [number, number, number] {
  const ra = raDeg * (Math.PI / 180);
  const dec = decDeg * (Math.PI / 180);
  return [
    R * Math.cos(dec) * Math.cos(ra),
    R * Math.sin(dec),
    R * Math.cos(dec) * Math.sin(ra),
  ];
}
```

### Camera Focus Formula

```typescript
const dir = normalize(starPosition);
const desiredCamera = dir * (R * 0.6);  // Factor 0.6 for comfortable zoom
const desiredTarget = starPosition * 0.98;
```

### Procedural Music Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Star Parameters                       │
│  (magnitude, temperature, distance, spectral type)       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              mapStarToGeneratorConfig()                  │
│  - Scale selection (pentatonic → chromatic)              │
│  - Note density, phrase length                           │
│  - Mutation rate, crossover rate                         │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌─────────────────────┐     ┌─────────────────────┐
│   Markov Chains     │     │  Genetic Algorithm  │
│ - Transition matrix │     │ - Population: 12    │
│ - Scale-aware       │     │ - Generations: 8    │
│ - Weighted probs    │     │ - Fitness scoring   │
└─────────┬───────────┘     └──────────┬──────────┘
          │                            │
          └──────────────┬─────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              generateProceduralMusic()                   │
│  Returns: { padNotes, shimmerNotes }                     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Tone.js Engine                         │
│  - PolySynth (pad layer, shimmer layer)                  │
│  - Effects: Reverb, Filter, FeedbackDelay                │
│  - Star params → filter cutoff, reverb, gain             │
└─────────────────────────────────────────────────────────┘
```

---

## Data Schema

### Star Data (`/public/data/stars.json`)

```json
{
  "id": "hip_32349",
  "name": "Sirius",
  "bayer": "α CMa",
  "ra": 101.2875,
  "dec": -16.7161,
  "mag": -1.46,
  "dist": 8.6,
  "spec": "A1V",
  "temp": 9940
}
```

Required: `id`, `ra`, `dec`, `mag`
Optional: `name`, `bayer`, `dist`, `spec`, `temp`

### Constellation Data (`/public/data/constellations.json`)

```json
{
  "id": "ori",
  "name": "Orion",
  "description": "The Hunter",
  "edges": [["hip_24436", "hip_27989"], ["hip_27989", "hip_25336"]]
}
```

---

## Code Organization

```
/app
  page.tsx              # Main client page
/components
  SkyScene.tsx          # R3F Canvas + controls
  StarField.tsx         # Points geometry
  ConstellationLines.tsx # LineSegments
  StarInfoPanel.tsx     # Details + audio controls
  ControlsBar.tsx       # UI toggles
/audio
  engine.ts             # Tone.js initialization & playback
  mappings.ts           # Star → audio params
  procedural.ts         # Markov + GA implementation
  procedural.test.ts    # 19 unit tests
/lib
  astro.ts              # RA/Dec conversion, clamp
  astro.test.ts         # 3 unit tests
  types.ts              # TypeScript interfaces
/public/data
  stars.json            # 90+ real stars
  constellations.json   # 19 constellations
/scripts
  build-stars.ts        # Data generation
```

---

## Testing

Run all tests:
```bash
npm run test
```

Current test coverage:
- `lib/astro.test.ts` — 3 tests (RA/Dec conversion, clamping)
- `audio/mappings.test.ts` — 3 tests (parameter mapping)
- `audio/procedural.test.ts` — 19 tests (Markov, GA, fitness)

---

## Performance Guidelines

* Target ~60fps desktop, ~30fps mobile
* Avoid per-frame allocations in `useFrame` loops
* Precompute buffers for starfield
* Keep data files < 2MB

---

## Data Sources & References

### Astronomical Data
- **Hipparcos Catalog** — ESA astrometry mission
  - https://www.cosmos.esa.int/web/hipparcos
- **Wikipedia Star Data**
  - List of brightest stars: https://en.wikipedia.org/wiki/List_of_brightest_stars
  - Sirius: https://en.wikipedia.org/wiki/Sirius
  - Vega: https://en.wikipedia.org/wiki/Vega
  - Arcturus: https://en.wikipedia.org/wiki/Arcturus

### Procedural Music Algorithms
- **Markov Chains in Music**
  - Wikipedia: https://en.wikipedia.org/wiki/Markov_chain#Music
  - Applications in algorithmic composition
- **Genetic Algorithms**
  - Holland, J.H. (1975). "Adaptation in Natural and Artificial Systems"
  - Used for phrase evolution with fitness-based selection

### Technologies
- **Three.js**: https://threejs.org/
- **React Three Fiber**: https://docs.pmnd.rs/react-three-fiber
- **Tone.js**: https://tonejs.github.io/
- **Next.js**: https://nextjs.org/
- **Vitest**: https://vitest.dev/

---

## Coding Standards

* TypeScript strict mode enabled
* Define shared types in `/lib/types.ts`
* No unnecessary dependencies
* Keep components small and testable
* Document key math/mapping logic with comments

---

## Future Enhancements (Out of Scope for MVP)

* User accounts / persistence
* Real-time API calls to astronomy databases
* Photorealistic galaxy backgrounds
* Tens of thousands of stars (would need binary format)
* VR/AR support
