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

  const normTemp = clamp((temp - 3000) / (12000 - 3000), 0, 1);
  const filterCutoff = 400 + normTemp * 3600;
  const baseNote = Math.round(36 + normTemp * 12);

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
