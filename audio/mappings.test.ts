import { mapStarToTone, specToTemp } from "./mappings";

describe("audio mappings", () => {
  it("maps hotter stars to higher cutoff", () => {
    const cool = mapStarToTone({ id: "cool", ra: 0, dec: 0, mag: 2, spec: "K" });
    const hot = mapStarToTone({ id: "hot", ra: 0, dec: 0, mag: 2, spec: "B" });
    expect(hot.filterCutoff).toBeGreaterThan(cool.filterCutoff);
  });

  it("specToTemp defaults to sun-like temp", () => {
    expect(specToTemp()).toBeCloseTo(5800);
  });
});
