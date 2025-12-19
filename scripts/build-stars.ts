#!/usr/bin/env ts-node
/**
 * Build-time star ingestion.
 *
 * For MVP we:
 * - start from curated bright stars (hand maintained below)
 * - add a synthetic background cloud for density
 * - write both stars and constellations to /public/data
 *
 * TODO: swap synthetic background with real catalog fetch (SIMBAD/etc) using cached responses in /cache.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type InputStar = {
  id: string;
  ra: number;
  dec: number;
  mag: number;
  name?: string;
  bayer?: string;
  dist?: number;
  spec?: string;
  temp?: number;
};

type Constellation = {
  id: string;
  name: string;
  edges: [string, string][];
};

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DATA = path.join(ROOT, "public", "data");
const CACHE = path.join(ROOT, "cache");

const CURATED: InputStar[] = [
  {
    id: "hip_32349",
    name: "Sirius",
    bayer: "α CMa",
    ra: 101.287155,
    dec: -16.716116,
    mag: -1.46,
    dist: 2.64,
    spec: "A1V",
    temp: 9940
  },
  {
    id: "hip_37279",
    name: "Procyon",
    bayer: "α CMi",
    ra: 114.825493,
    dec: 5.225,
    mag: 0.38,
    dist: 3.5,
    spec: "F5IV-V",
    temp: 6530
  },
  {
    id: "hip_24436",
    name: "Betelgeuse",
    bayer: "α Ori",
    ra: 88.792939,
    dec: 7.407064,
    mag: 0.42,
    dist: 197,
    spec: "M1-2Ia-Iab",
    temp: 3500
  },
  {
    id: "hip_27989",
    name: "Bellatrix",
    bayer: "γ Ori",
    ra: 81.282764,
    dec: 6.349703,
    mag: 1.64,
    dist: 76,
    spec: "B2III",
    temp: 21000
  },
  {
    id: "hip_25336",
    name: "Rigel",
    bayer: "β Ori",
    ra: 78.634467,
    dec: -8.201639,
    mag: 0.18,
    dist: 264,
    spec: "B8Ia",
    temp: 12100
  },
  {
    id: "hip_25930",
    name: "Saiph",
    bayer: "κ Ori",
    ra: 83.001667,
    dec: -9.669605,
    mag: 2.06,
    dist: 216,
    spec: "B0.5Ia",
    temp: 26000
  },
  {
    id: "hip_31592",
    name: "Adhara",
    bayer: "ε CMa",
    ra: 104.656453,
    dec: -28.972084,
    mag: 1.5,
    dist: 200,
    spec: "B2II",
    temp: 22000
  },
  {
    id: "hip_30324",
    name: "Mirzam",
    bayer: "β CMa",
    ra: 99.427918,
    dec: -17.986605,
    mag: 1.98,
    dist: 152,
    spec: "B1II-III",
    temp: 23000
  },
  {
    id: "altair",
    name: "Altair",
    bayer: "α Aql",
    ra: 297.695827,
    dec: 8.868321,
    mag: 0.77,
    dist: 5.13,
    spec: "A7V",
    temp: 7550
  },
  {
    id: "vega",
    name: "Vega",
    bayer: "α Lyr",
    ra: 279.234734,
    dec: 38.783689,
    mag: 0.03,
    dist: 7.68,
    spec: "A0V",
    temp: 9600
  },
  {
    id: "deneb",
    name: "Deneb",
    bayer: "α Cyg",
    ra: 310.357979,
    dec: 45.280338,
    mag: 1.25,
    dist: 802,
    spec: "A2Ia",
    temp: 8500
  },
  {
    id: "polaris",
    name: "Polaris",
    bayer: "α UMi",
    ra: 37.954561,
    dec: 89.264109,
    mag: 1.98,
    dist: 132,
    spec: "F7Ib",
    temp: 6015
  },
  {
    id: "capella",
    name: "Capella",
    bayer: "α Aur",
    ra: 79.17233,
    dec: 45.997991,
    mag: 0.08,
    dist: 12.9,
    spec: "G8III",
    temp: 4970
  }
];

const CONSTELLATIONS: Constellation[] = [
  {
    id: "ori",
    name: "Orion",
    edges: [
      ["hip_24436", "hip_27989"],
      ["hip_27989", "hip_25336"],
      ["hip_25336", "hip_25930"],
      ["hip_25336", "hip_24436"]
    ]
  },
  {
    id: "cma",
    name: "Canis Major",
    edges: [
      ["hip_32349", "hip_31592"],
      ["hip_32349", "hip_30324"]
    ]
  },
  {
    id: "winter_triangle",
    name: "Winter Triangle",
    edges: [
      ["hip_32349", "hip_37279"],
      ["hip_37279", "hip_24436"],
      ["hip_24436", "hip_32349"]
    ]
  },
  {
    id: "summer_triangle",
    name: "Summer Triangle",
    edges: [
      ["vega", "deneb"],
      ["deneb", "altair"],
      ["altair", "vega"]
    ]
  },
  {
    id: "northern_highlights",
    name: "Northern Highlights",
    edges: [
      ["polaris", "capella"],
      ["capella", "vega"],
      ["vega", "polaris"]
    ]
  }
];

function ensureDirs() {
  for (const dir of [PUBLIC_DATA, CACHE]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function validate(stars: InputStar[]): InputStar[] {
  return stars.filter((star) => {
    const withinRanges =
      star.ra >= 0 && star.ra < 360 && star.dec >= -90 && star.dec <= 90 && star.id;
    if (!withinRanges) {
      console.warn("Skipping invalid star", star.id);
      return false;
    }
    return true;
  });
}

function dedupe(stars: InputStar[]): InputStar[] {
  const seen = new Set<string>();
  const result: InputStar[] = [];
  for (const star of stars) {
    if (seen.has(star.id)) continue;
    seen.add(star.id);
    result.push(star);
  }
  return result;
}

function generateBackground(count: number, seed = 1): InputStar[] {
  const rng = mulberry32(seed);
  const specs = ["O", "B", "A", "F", "G", "K", "M"];
  const stars: InputStar[] = [];
  for (let i = 0; i < count; i++) {
    const ra = rng() * 360;
    // Weight declination toward equator for density
    const dec = (Math.asin(rng() * 2 - 1) * 180) / Math.PI;
    const mag = 2 + Math.pow(rng(), 2) * 6; // bias brighter than uniform
    const spec = specs[Math.floor(rng() * specs.length)];
    const dist = 5 + rng() * 500;
    stars.push({
      id: `bg_${i.toString().padStart(4, "0")}`,
      ra,
      dec,
      mag,
      dist,
      spec
    });
  }
  return stars;
}

function writeJson(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function main() {
  ensureDirs();

  // TODO: replace synthetic background with real catalog fetch; cache raw responses in /cache with backoff.

  const background = generateBackground(2000, 42);
  const stars = dedupe(validate([...CURATED, ...background]));

  writeJson(path.join(PUBLIC_DATA, "stars.json"), stars);
  writeJson(path.join(PUBLIC_DATA, "constellations.json"), CONSTELLATIONS);

  console.log(`Wrote ${stars.length} stars and ${CONSTELLATIONS.length} constellations to /public/data`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
