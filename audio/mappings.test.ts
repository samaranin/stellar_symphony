import { mapStarToTone, specToTemp } from "./mappings";
import { describe, it, expect } from "vitest";

describe("audio mappings", () => {
  it("maps hotter stars to higher cutoff", () => {
    const cool = mapStarToTone({ id: "cool", ra: 0, dec: 0, mag: 2, spec: "K" });
    const hot = mapStarToTone({ id: "hot", ra: 0, dec: 0, mag: 2, spec: "B" });
    expect(hot.filterCutoff).toBeGreaterThan(cool.filterCutoff);
  });

  it("specToTemp defaults to sun-like temp", () => {
    expect(specToTemp()).toBeCloseTo(5800);
  });

  it("clamps gain and reverb within bounds", () => {
    const bright = mapStarToTone({ id: "bright", ra: 0, dec: 0, mag: -5 });
    const dim = mapStarToTone({ id: "dim", ra: 0, dec: 0, mag: 12, dist: 500 });
    expect(bright.gain).toBeGreaterThan(dim.gain);
    expect(dim.reverbWet).toBeLessThanOrEqual(0.6);
    expect(dim.gain).toBeGreaterThan(0);
  });
});
