import { raDecToXYZ, clamp } from "./astro";

describe("astro utilities", () => {
  it("converts RA/Dec to XYZ on sphere radius", () => {
    const { x, y, z } = raDecToXYZ(0, 0, 100);
    expect(Math.round(x)).toBe(100);
    expect(Math.round(y)).toBe(0);
    expect(Math.round(z)).toBe(0);
  });

  it("clamps values within range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
