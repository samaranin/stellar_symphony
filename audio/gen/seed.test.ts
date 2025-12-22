import { describe, it, expect } from "vitest";
import {
  SeededRNG,
  createRNG,
  hashToSeed,
  starToSeed,
} from "./seed";

describe("Seed Generation Module", () => {
  describe("SeededRNG class", () => {
    it("produces deterministic sequences with same seed", () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      
      const seq1 = [rng1.next(), rng1.next(), rng1.next()];
      const seq2 = [rng2.next(), rng2.next(), rng2.next()];
      
      expect(seq1).toEqual(seq2);
    });

    it("produces different sequences with different seeds", () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(123);
      
      expect(rng1.next()).not.toEqual(rng2.next());
    });

    it("produces values in [0, 1)", () => {
      const rng = new SeededRNG(999);
      for (let i = 0; i < 100; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it("nextInt produces integers in range", () => {
      const rng = new SeededRNG(42);
      for (let i = 0; i < 50; i++) {
        const val = rng.nextInt(10, 20);
        expect(val).toBeGreaterThanOrEqual(10);
        expect(val).toBeLessThanOrEqual(20);
        expect(Number.isInteger(val)).toBe(true);
      }
    });

    it("nextFloat produces floats in range", () => {
      const rng = new SeededRNG(42);
      for (let i = 0; i < 50; i++) {
        const val = rng.nextFloat(5.5, 10.5);
        expect(val).toBeGreaterThanOrEqual(5.5);
        expect(val).toBeLessThanOrEqual(10.5);
      }
    });

    it("pick selects from array", () => {
      const rng = new SeededRNG(42);
      const items = ["a", "b", "c", "d"];
      const picks = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        picks.add(rng.pick(items));
      }
      
      // Should eventually pick all items
      expect(picks.size).toBeGreaterThan(1);
      for (const pick of picks) {
        expect(items).toContain(pick);
      }
    });

    it("weightedPick respects weights", () => {
      const rng = new SeededRNG(42);
      const items = ["a", "b"];
      const weights = [9, 1]; // 'a' should be picked 90% of the time
      
      let aCount = 0;
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        if (rng.weightedPick(items, weights) === "a") {
          aCount++;
        }
      }
      
      // Should be roughly 90% (with some tolerance)
      expect(aCount / iterations).toBeGreaterThan(0.8);
      expect(aCount / iterations).toBeLessThan(0.95);
    });

    it("shuffle produces valid permutation", () => {
      const rng = new SeededRNG(42);
      const original = [1, 2, 3, 4, 5];
      const shuffled = rng.shuffle(original);
      
      expect(shuffled.length).toBe(original.length);
      expect(shuffled.sort()).toEqual(original.sort());
    });

    it("shuffle is deterministic with same seed", () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const arr = [1, 2, 3, 4, 5];
      
      expect(rng1.shuffle([...arr])).toEqual(rng2.shuffle([...arr]));
    });
  });

  describe("createRNG function", () => {
    it("returns a function compatible with legacy code", () => {
      const random = createRNG(42);
      expect(typeof random).toBe("function");
      
      const val = random();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });

    it("is deterministic", () => {
      const rng1 = createRNG(42);
      const rng2 = createRNG(42);
      
      expect([rng1(), rng1()]).toEqual([rng2(), rng2()]);
    });
  });

  describe("hashToSeed", () => {
    it("produces consistent hash for same input", () => {
      expect(hashToSeed("test")).toBe(hashToSeed("test"));
    });

    it("produces different hashes for different inputs", () => {
      expect(hashToSeed("hello")).not.toBe(hashToSeed("world"));
    });

    it("produces non-negative numbers", () => {
      expect(hashToSeed("negative")).toBeGreaterThanOrEqual(0);
      expect(hashToSeed("")).toBeGreaterThanOrEqual(0);
    });
  });

  describe("starToSeed", () => {
    it("produces consistent seed for same star", () => {
      const seed1 = starToSeed("hip_32349", 101.2875, -16.7161);
      const seed2 = starToSeed("hip_32349", 101.2875, -16.7161);
      
      expect(seed1).toBe(seed2);
    });

    it("produces different seeds for different stars", () => {
      const seed1 = starToSeed("hip_32349", 101.2875, -16.7161);
      const seed2 = starToSeed("hip_69673", 213.9154, 19.1825);
      
      expect(seed1).not.toBe(seed2);
    });

    it("produces non-negative numbers", () => {
      expect(starToSeed("test", 0, 0)).toBeGreaterThanOrEqual(0);
      expect(starToSeed("test", -180, -90)).toBeGreaterThanOrEqual(0);
    });
  });
});
