# Stellar Symphony 🌟🎵

An interactive 3D star visualization with procedurally generated ambient music. Built with Next.js, Three.js, and Tone.js.

![Static Badge](https://img.shields.io/badge/Stars-90%2B_Real_Stars-blue)
![Static Badge](https://img.shields.io/badge/Constellations-19_Patterns-green)
![Static Badge](https://img.shields.io/badge/Audio-Markov_Chains_%2B_Genetic_Algorithm-purple)

## ✨ Features

- **3D Interactive Sky Sphere** — Navigate through a realistic starfield with 90+ accurately positioned stars
- **19 Constellations** — Including Orion, Ursa Major, Cassiopeia, Cygnus, and famous asterisms
- **Procedural Music Generation** — Each star generates unique ambient music using:
  - Markov chains for melodic transitions
  - Genetic algorithms for phrase evolution
  - Star parameters (magnitude, temperature, distance) influence timbre and mood
- **Smooth Camera Animation** — Click any star to smoothly focus on it
- **Real Astronomical Data** — Star positions from Hipparcos catalog with accurate RA/Dec coordinates

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000. Data loads from `/public/data/stars.json` and `/public/data/constellations.json`.

### Run Tests

```bash
npm run test
```

25 unit tests covering astro utilities, audio mappings, and procedural generation.

### Build for Production

```bash
npm run build
```

## 📊 Star Data

The project includes **90+ real stars** from the Hipparcos catalog with:

| Field | Description |
|-------|-------------|
| `id` | Hipparcos catalog ID (e.g., `hip_32349`) |
| `name` | Common name (e.g., "Sirius") |
| `bayer` | Bayer designation (e.g., "α CMa") |
| `ra` | Right Ascension in degrees |
| `dec` | Declination in degrees |
| `mag` | Apparent magnitude |
| `dist` | Distance in light-years |
| `spec` | Spectral type |
| `temp` | Surface temperature in Kelvin |

### Featured Stars (Top 10 Brightest)

| Star | Magnitude | Distance | Spectral Type |
|------|-----------|----------|---------------|
| Sirius | -1.46 | 8.6 ly | A1V |
| Canopus | -0.74 | 310 ly | A9II |
| Alpha Centauri | -0.27 | 4.37 ly | G2V |
| Arcturus | -0.05 | 36.7 ly | K0III |
| Vega | 0.03 | 25 ly | A0Va |
| Capella | 0.08 | 43 ly | G8III |
| Rigel | 0.13 | 860 ly | B8Ia |
| Procyon | 0.34 | 11.4 ly | F5IV-V |
| Betelgeuse | 0.42 | 700 ly | M1-2Ia-Iab |
| Altair | 0.77 | 16.7 ly | A7V |

### Constellations Included

- **Northern Sky**: Ursa Major, Cassiopeia, Cygnus, Boötes, Pegasus, Andromeda
- **Zodiac**: Leo, Gemini, Taurus, Virgo, Scorpius, Sagittarius
- **Southern Sky**: Orion, Canis Major, Crux, Carina
- **Asterisms**: Winter Triangle, Summer Triangle, Spring Triangle

## 🎵 Procedural Music System

The audio engine uses advanced algorithms to generate unique ambient soundscapes:

### Markov Chains
- Note transition probabilities based on musical theory
- Scale-aware generation (pentatonic to chromatic based on star temperature)
- Weighted transitions favor consonant intervals

### Genetic Algorithm
- Population of 12 musical phrases
- 8 generations of evolution per star
- Fitness function evaluates:
  - Melodic contour variety
  - Rhythmic interest
  - Note range utilization

### Star-to-Music Mapping

| Star Property | Musical Effect |
|---------------|----------------|
| Magnitude | Volume level, note density |
| Temperature | Filter brightness, scale complexity |
| Distance | Reverb depth, spaciousness |
| Spectral Type | Chord voicing, harmonic content |

## 📁 Project Structure

```
/app
  page.tsx              # Main client page
/components
  SkyScene.tsx          # R3F scene container
  StarField.tsx         # Points geometry starfield
  ConstellationLines.tsx # LineSegments for constellations
  StarInfoPanel.tsx     # Star details + audio controls
  ControlsBar.tsx       # UI controls
/audio
  engine.ts             # Tone.js audio engine
  mappings.ts           # Star → audio parameter mapping
  procedural.ts         # Markov chains + genetic algorithm
  procedural.test.ts    # Unit tests
/lib
  astro.ts              # RA/Dec → XYZ conversion
  types.ts              # TypeScript interfaces
/public/data
  stars.json            # 90+ real star records
  constellations.json   # 19 constellation patterns
/scripts
  build-stars.ts        # Data generation script
```

## 🌐 Deploy

The site is fully static and can be deployed to:
- Vercel (recommended)
- Cloudflare Pages
- GitHub Pages
- Any static hosting

```bash
npm run build
# Output in .next/ folder
```

## 📚 Data Sources & References

### Astronomical Data
- **Hipparcos Catalog** — ESA's high-precision astrometry mission (1989-1993)
  - Source: https://www.cosmos.esa.int/web/hipparcos
- **Wikipedia Brightest Stars List** — https://en.wikipedia.org/wiki/List_of_brightest_stars
- **Individual Star Data**:
  - Sirius: https://en.wikipedia.org/wiki/Sirius
  - Vega: https://en.wikipedia.org/wiki/Vega
  - Arcturus: https://en.wikipedia.org/wiki/Arcturus

### Procedural Music Algorithms
- **Markov Chains in Music** — https://en.wikipedia.org/wiki/Markov_chain#Music
- **Genetic Algorithms** — Holland, J.H. (1975). "Adaptation in Natural and Artificial Systems"

### Technologies
- **Three.js** — https://threejs.org/
- **React Three Fiber** — https://docs.pmnd.rs/react-three-fiber
- **Tone.js** — https://tonejs.github.io/
- **Next.js** — https://nextjs.org/

## 📄 License

MIT License - See LICENSE file for details.

## 🙏 Acknowledgments

- ESA Hipparcos mission for stellar position data
- IAU for constellation definitions
- The Tone.js team for the excellent Web Audio library
