#!/usr/bin/env ts-node
/**
 * Build-time star ingestion skeleton.
 * TODO: replace manual seeds with real fetch against SIMBAD or another catalog.
 */
import fs from "fs";
import path from "path";

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

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DATA = path.join(ROOT, "public", "data");
const CACHE = path.join(ROOT, "cache");

function ensureDirs() {
  for (const dir of [PUBLIC_DATA, CACHE]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function loadManualSeeds(): InputStar[] {
  const manual = path.join(ROOT, "public", "data", "stars.json");
  const contents = fs.readFileSync(manual, "utf-8");
  return JSON.parse(contents) as InputStar[];
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

async function main() {
  ensureDirs();

  // Placeholder pipeline
  // 1) TODO: fetch famous stars (cache in /cache)
  // 2) TODO: merge with curated CSV
  // 3) TODO: append background stars
  // 4) dedupe + clamp + write out

  const seeds = validate(loadManualSeeds());
  fs.writeFileSync(path.join(PUBLIC_DATA, "stars.json"), JSON.stringify(seeds, null, 2));
  console.log(`Wrote ${seeds.length} stars to public/data/stars.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
