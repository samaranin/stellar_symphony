import { clamp } from "@/lib/astro";
import { StarRecord } from "@/lib/types";

export type ToneParams = {
  gain: number;
  particleDensity: number;
  filterCutoff: number;
  baseNote: number;
  reverbWet: number;
};

export function mapStarToTone(star: StarRecord): ToneParams {
  const mag = clamp(star.mag, -2, 10);
  const temp = star.temp ?? specToTemp(star.spec);
  const dist = star.dist ?? 10;

  const gain = clamp(0.4 - mag * 0.03, 0.08, 0.35);
  const particleDensity = clamp(0.25 - mag * 0.015, 0.05, 0.35);

  // Normalize temperature to 0..1 between 3000K and 12000K
  // For temperatures above 12000K we apply a gentle log-based reduction so
  // very hot stars don't all snap to the absolute top of the range.
  let normTemp = clamp((temp - 3000) / (12000 - 3000), 0, 1);
  if (temp > 12000) {
    // reduction scales with log(temp/12000). Multiplier tuned to give
    // moderate compression for 20k-30kK stars without affecting mid-range.
    const extraLog = Math.log10(temp / 12000);
    const reduction = Math.min(0.6, extraLog * 0.9);
    normTemp = clamp(1 - reduction, 0, 1);
  }
  const filterCutoff = 400 + normTemp * 3600;

  // Apply a mild ease/boost to mid-hot temperatures so 6k-9kK map higher.
  // Then apply a gentle compression on the very hottest stars so extremely
  // hot objects (e.g. 20000-35000K) don't jump to excessively high notes.
  const basePow = Math.pow(normTemp, 0.6);
  // Soft-compress the top end using a scaled tanh curve. The factor controls
  // how strongly the upper range is squashed (1.2..1.6 are reasonable).
  const tanhScale = 1.4;
  const compressed = Math.tanh(basePow * tanhScale) / Math.tanh(tanhScale);
  let boostedNorm = clamp(compressed, 0, 1);
  // For temperatures above 12000K, cap the final normalized boost so the
  // top-end doesn't produce excessively high MIDI notes. This keeps 12k+
  // stars in a reasonable musical range.
  if (temp > 12000) {
    const cap = 0.75; // maximum normalized value (0..1) for very hot stars
    boostedNorm = Math.min(boostedNorm, cap);
  }
  const baseNote = Math.round(36 + boostedNorm * 36);

  const reverbWet = clamp(dist / 50, 0.1, 0.6);

  return { gain, particleDensity, filterCutoff, baseNote, reverbWet };
}

export function specToTemp(spec?: string): number {
  if (!spec) return 5800;
  const letter = spec.charAt(0).toUpperCase();
  const map: Record<string, number> = {
    O: 30000,
    B: 20000,
    A: 10000,
    F: 7500,
    G: 5800,
    K: 4500,
    M: 3200
  };
  return map[letter] ?? 5800;
}
