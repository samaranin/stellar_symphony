"use client";

/**
 * Seeded Random Number Generator
 * 
 * Provides deterministic pseudo-random number generation using the Mulberry32 algorithm.
 * Given the same seed, the sequence of random numbers will always be identical,
 * enabling reproducible music generation for each star.
 */

export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    // Ensure seed is a valid 32-bit integer
    this.state = Math.floor(Math.abs(seed) * 0xffffffff) || 1;
  }

  /**
   * Generate next random number in [0, 1)
   * Uses Mulberry32 algorithm for fast, high-quality randomness
   */
  next(): number {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in [min, max] (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate random float in [min, max]
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Pick random element from array
   */
  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /**
   * Pick random element from array using weights
   */
  weightedPick<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Generate a gaussian-distributed random number
   * Uses Box-Muller transform
   */
  nextGaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
}

/**
 * Create a simple RNG function from seed (for backward compatibility)
 */
export function createRNG(seed: number): () => number {
  const rng = new SeededRNG(seed);
  return () => rng.next();
}

/**
 * Hash a string to a numeric seed
 */
export function hashToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a seed from star data for consistent music per star
 */
export function starToSeed(starId: string, ra: number, dec: number): number {
  const idHash = hashToSeed(starId);
  const coordHash = Math.floor(ra * 1000 + dec * 10000);
  return Math.abs(idHash ^ coordHash);
}
