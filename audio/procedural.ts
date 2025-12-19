"use client";

import { StarRecord } from "@/lib/types";
import { clamp } from "@/lib/astro";

/**
 * Advanced Procedural Music Generation System
 * 
 * Combines two powerful techniques:
 * 1. Markov Chains - For statistically coherent melodic/harmonic transitions
 * 2. Genetic Algorithm - For evolving optimal musical phrases over time
 * 
 * The system generates ambient music that is:
 * - Deterministically seeded (same star + seed = same music)
 * - Musically coherent (Markov ensures natural progressions)
 * - Evolutionarily optimized (GA finds pleasing patterns)
 */

// ============================================================================
// TYPES
// ============================================================================

/** Musical scale/mode definition */
export type Scale = {
  name: string;
  intervals: number[]; // semitones from root
};

/** A musical phrase chromosome for the genetic algorithm */
export type Phrase = {
  notes: number[];      // MIDI note numbers
  durations: number[];  // note durations in beats
  velocities: number[]; // 0-1 velocity/dynamics
  fitness: number;      // evaluated fitness score
};

/** Markov transition matrix for note progressions */
export type TransitionMatrix = Map<number, Map<number, number>>;

/** Configuration for the procedural generator */
export type GeneratorConfig = {
  scale: Scale;
  baseNote: number;     // MIDI root note
  octaveRange: number;  // how many octaves to span
  phraseLength: number; // notes per phrase
  temperature: number;  // star temperature (affects scale choice)
  magnitude: number;    // star magnitude (affects density/activity)
  distance: number;     // star distance (affects spaciousness)
};

// ============================================================================
// MUSICAL SCALES - Chosen based on star characteristics
// ============================================================================

export const SCALES: Record<string, Scale> = {
  // Warm, bright scales for hot stars (O, B, A)
  lydian: { name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  major: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
  mixolydian: { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  
  // Neutral scales for medium stars (F, G)
  dorian: { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  aeolian: { name: "Aeolian", intervals: [0, 2, 3, 5, 7, 8, 10] },
  
  // Dark, mysterious scales for cool stars (K, M)
  phrygian: { name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  locrian: { name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
  
  // Ambient/atmospheric scales
  pentatonic: { name: "Pentatonic", intervals: [0, 2, 4, 7, 9] },
  wholeTone: { name: "Whole Tone", intervals: [0, 2, 4, 6, 8, 10] },
};

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR (Mulberry32)
// ============================================================================

export function createRNG(seed: number): () => number {
  let t = Math.floor(seed * 0xffffffff);
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// MARKOV CHAIN MELODY GENERATOR
// ============================================================================

/**
 * Builds a Markov transition matrix from a scale and musical rules.
 * The matrix encodes probability of transitioning from one scale degree to another.
 */
export function buildTransitionMatrix(
  scale: Scale,
  random: () => number
): TransitionMatrix {
  const matrix: TransitionMatrix = new Map();
  const n = scale.intervals.length;
  
  // Musical tendencies for interval movements (based on music theory)
  // Higher weights = more likely transitions
  const intervalWeights: Record<number, number> = {
    0: 0.1,   // Unison (rare, can be static)
    1: 0.25,  // Step up (common, melodic)
    [-1]: 0.25, // Step down (common, melodic)
    2: 0.15,  // Skip up (occasional)
    [-2]: 0.15, // Skip down (occasional)
    3: 0.08,  // Third up
    [-3]: 0.08, // Third down
    4: 0.05,  // Fourth up (less common)
    [-4]: 0.05, // Fourth down
    5: 0.03,  // Fifth up (rare but impactful)
    [-5]: 0.03, // Fifth down
  };
  
  for (let from = 0; from < n; from++) {
    const toProbs = new Map<number, number>();
    let totalWeight = 0;
    
    for (let to = 0; to < n; to++) {
      const interval = to - from;
      // Get base weight, add some randomness for variation
      const baseWeight = intervalWeights[interval] ?? 0.01;
      const weight = baseWeight + random() * 0.05;
      toProbs.set(to, weight);
      totalWeight += weight;
    }
    
    // Normalize to probabilities
    for (const [to, weight] of toProbs) {
      toProbs.set(to, weight / totalWeight);
    }
    
    matrix.set(from, toProbs);
  }
  
  return matrix;
}

/**
 * Generates the next note using the Markov chain transition matrix.
 */
export function markovNextNote(
  currentDegree: number,
  matrix: TransitionMatrix,
  random: () => number
): number {
  const transitions = matrix.get(currentDegree);
  if (!transitions) return 0;
  
  const r = random();
  let cumulative = 0;
  
  for (const [nextDegree, prob] of transitions) {
    cumulative += prob;
    if (r <= cumulative) {
      return nextDegree;
    }
  }
  
  return 0; // Fallback to root
}

/**
 * Generates a melodic phrase using Markov chains.
 */
export function generateMarkovPhrase(
  config: GeneratorConfig,
  matrix: TransitionMatrix,
  random: () => number,
  length: number
): number[] {
  const notes: number[] = [];
  const scale = config.scale;
  const n = scale.intervals.length;
  
  // Start on a stable degree (root, third, or fifth)
  let currentDegree = [0, 2, 4][Math.floor(random() * 3)] % n;
  
  for (let i = 0; i < length; i++) {
    // Calculate actual MIDI note
    const octaveShift = Math.floor(random() * config.octaveRange) - 1;
    const interval = scale.intervals[currentDegree];
    const note = config.baseNote + interval + (octaveShift * 12);
    notes.push(clamp(note, 24, 96));
    
    // Transition to next degree
    currentDegree = markovNextNote(currentDegree, matrix, random);
  }
  
  return notes;
}

// ============================================================================
// GENETIC ALGORITHM FOR PHRASE EVOLUTION
// ============================================================================

const GA_POPULATION_SIZE = 12;
const GA_GENERATIONS = 8;
const GA_MUTATION_RATE = 0.15;
const GA_CROSSOVER_RATE = 0.7;

/**
 * Creates an initial population of phrases using Markov generation.
 */
export function initializePopulation(
  config: GeneratorConfig,
  matrix: TransitionMatrix,
  random: () => number
): Phrase[] {
  const population: Phrase[] = [];
  
  for (let i = 0; i < GA_POPULATION_SIZE; i++) {
    const notes = generateMarkovPhrase(config, matrix, random, config.phraseLength);
    const durations = generateDurations(config.phraseLength, random);
    const velocities = generateVelocities(config.phraseLength, random);
    
    population.push({
      notes,
      durations,
      velocities,
      fitness: 0
    });
  }
  
  return population;
}

/**
 * Generates rhythmic durations for a phrase.
 * Uses probability distribution favoring musical subdivisions.
 */
function generateDurations(length: number, random: () => number): number[] {
  const durations: number[] = [];
  const durationOptions = [0.25, 0.5, 0.75, 1, 1.5, 2]; // beats
  const weights = [0.1, 0.3, 0.15, 0.25, 0.1, 0.1]; // probability weights
  
  for (let i = 0; i < length; i++) {
    const r = random();
    let cumulative = 0;
    let duration = 1;
    
    for (let j = 0; j < durationOptions.length; j++) {
      cumulative += weights[j];
      if (r <= cumulative) {
        duration = durationOptions[j];
        break;
      }
    }
    
    durations.push(duration);
  }
  
  return durations;
}

/**
 * Generates velocity/dynamics for each note.
 */
function generateVelocities(length: number, random: () => number): number[] {
  const velocities: number[] = [];
  
  for (let i = 0; i < length; i++) {
    // Natural phrasing: slight emphasis on downbeats
    const isDownbeat = i % 4 === 0;
    const baseVelocity = isDownbeat ? 0.7 : 0.5;
    const variation = (random() - 0.5) * 0.3;
    velocities.push(clamp(baseVelocity + variation, 0.2, 1.0));
  }
  
  return velocities;
}

/**
 * Fitness function evaluating musical quality of a phrase.
 * Based on music theory principles:
 * - Melodic contour (smooth movement preferred)
 * - Consonance (intervals that sound good together)
 * - Rhythmic interest (variety but not chaos)
 * - Dynamic range (expression)
 */
export function evaluateFitness(phrase: Phrase, config: GeneratorConfig): number {
  let fitness = 0;
  const { notes, durations, velocities } = phrase;
  const n = notes.length;
  
  if (n < 2) return 0;
  
  // 1. Melodic smoothness (prefer stepwise motion)
  let smoothness = 0;
  for (let i = 1; i < n; i++) {
    const interval = Math.abs(notes[i] - notes[i - 1]);
    if (interval <= 2) smoothness += 1.0;      // step
    else if (interval <= 4) smoothness += 0.7;  // skip
    else if (interval <= 7) smoothness += 0.4;  // larger
    else smoothness += 0.1;                     // leap (less desirable for ambient)
  }
  fitness += (smoothness / (n - 1)) * 30;
  
  // 2. Consonance check (intervals from scale)
  const consonantIntervals = new Set([0, 3, 4, 5, 7, 8, 9, 12]); // P1, m3, M3, P4, P5, m6, M6, P8
  let consonance = 0;
  for (let i = 1; i < n; i++) {
    const interval = Math.abs(notes[i] - notes[i - 1]) % 12;
    if (consonantIntervals.has(interval)) consonance += 1;
  }
  fitness += (consonance / (n - 1)) * 25;
  
  // 3. Melodic contour variety (not too static, not too jumpy)
  let contourChanges = 0;
  for (let i = 2; i < n; i++) {
    const dir1 = Math.sign(notes[i - 1] - notes[i - 2]);
    const dir2 = Math.sign(notes[i] - notes[i - 1]);
    if (dir1 !== dir2 && dir1 !== 0 && dir2 !== 0) contourChanges++;
  }
  const contourScore = clamp(contourChanges / (n - 2), 0.2, 0.6) * 100;
  fitness += contourScore * 0.2;
  
  // 4. Rhythmic variety
  const uniqueDurations = new Set(durations).size;
  fitness += (uniqueDurations / 4) * 10;
  
  // 5. Dynamic expression
  const velocityRange = Math.max(...velocities) - Math.min(...velocities);
  fitness += velocityRange * 10;
  
  // 6. Resolution tendency (ending on stable note)
  const lastNote = notes[n - 1];
  const rootDistance = (lastNote - config.baseNote) % 12;
  if (rootDistance === 0 || rootDistance === 7 || rootDistance === 4) {
    fitness += 5; // Bonus for ending on root, fifth, or third
  }
  
  return fitness;
}

/**
 * Selection: Tournament selection for genetic diversity.
 */
function tournamentSelect(population: Phrase[], random: () => number): Phrase {
  const tournamentSize = 3;
  let best: Phrase | null = null;
  
  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(random() * population.length);
    if (!best || population[idx].fitness > best.fitness) {
      best = population[idx];
    }
  }
  
  return best!;
}

/**
 * Crossover: Single-point crossover between two parent phrases.
 */
function crossover(parent1: Phrase, parent2: Phrase, random: () => number): Phrase {
  if (random() > GA_CROSSOVER_RATE) {
    return { ...parent1, fitness: 0 };
  }
  
  const point = Math.floor(random() * parent1.notes.length);
  
  return {
    notes: [...parent1.notes.slice(0, point), ...parent2.notes.slice(point)],
    durations: [...parent1.durations.slice(0, point), ...parent2.durations.slice(point)],
    velocities: [...parent1.velocities.slice(0, point), ...parent2.velocities.slice(point)],
    fitness: 0
  };
}

/**
 * Mutation: Random changes to notes, durations, or velocities.
 */
function mutate(phrase: Phrase, config: GeneratorConfig, random: () => number): void {
  const scale = config.scale;
  
  for (let i = 0; i < phrase.notes.length; i++) {
    if (random() < GA_MUTATION_RATE) {
      // Mutate note (shift by scale degree)
      const shift = Math.floor(random() * 3) - 1; // -1, 0, or 1
      const currentDegree = findClosestDegree(phrase.notes[i], config);
      const newDegree = clamp(currentDegree + shift, 0, scale.intervals.length - 1);
      const octaveShift = Math.floor((phrase.notes[i] - config.baseNote) / 12);
      phrase.notes[i] = config.baseNote + scale.intervals[newDegree] + (octaveShift * 12);
      phrase.notes[i] = clamp(phrase.notes[i], 24, 96);
    }
    
    if (random() < GA_MUTATION_RATE * 0.5) {
      // Mutate duration
      const options = [0.25, 0.5, 0.75, 1, 1.5, 2];
      phrase.durations[i] = options[Math.floor(random() * options.length)];
    }
    
    if (random() < GA_MUTATION_RATE * 0.3) {
      // Mutate velocity
      phrase.velocities[i] = clamp(phrase.velocities[i] + (random() - 0.5) * 0.2, 0.2, 1.0);
    }
  }
}

/**
 * Find the closest scale degree for a given MIDI note.
 */
function findClosestDegree(note: number, config: GeneratorConfig): number {
  const interval = (note - config.baseNote) % 12;
  let closest = 0;
  let minDist = 12;
  
  for (let i = 0; i < config.scale.intervals.length; i++) {
    const dist = Math.abs(config.scale.intervals[i] - interval);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }
  
  return closest;
}

/**
 * Evolves the population through multiple generations.
 */
export function evolvePopulation(
  population: Phrase[],
  config: GeneratorConfig,
  random: () => number,
  generations: number = GA_GENERATIONS
): Phrase[] {
  let currentPop = [...population];
  
  for (let gen = 0; gen < generations; gen++) {
    // Evaluate fitness
    for (const phrase of currentPop) {
      phrase.fitness = evaluateFitness(phrase, config);
    }
    
    // Sort by fitness (descending)
    currentPop.sort((a, b) => b.fitness - a.fitness);
    
    // Create new population
    const newPop: Phrase[] = [];
    
    // Elitism: keep top 2
    newPop.push({ ...currentPop[0], fitness: 0 });
    newPop.push({ ...currentPop[1], fitness: 0 });
    
    // Fill rest with offspring
    while (newPop.length < GA_POPULATION_SIZE) {
      const parent1 = tournamentSelect(currentPop, random);
      const parent2 = tournamentSelect(currentPop, random);
      const offspring = crossover(parent1, parent2, random);
      mutate(offspring, config, random);
      newPop.push(offspring);
    }
    
    currentPop = newPop;
  }
  
  // Final evaluation
  for (const phrase of currentPop) {
    phrase.fitness = evaluateFitness(phrase, config);
  }
  currentPop.sort((a, b) => b.fitness - a.fitness);
  
  return currentPop;
}

// ============================================================================
// CHORD PROGRESSION GENERATOR (Also using Markov chains)
// ============================================================================

export type ChordProgression = {
  roots: number[];      // Root notes (MIDI)
  qualities: string[];  // "maj", "min", "dim", "aug", "sus4", etc.
  durations: number[];  // Duration in bars
};

/**
 * Chord transition probabilities based on functional harmony.
 * Maps from chord degree to possible next degrees with weights.
 */
const CHORD_TRANSITIONS: Record<number, [number, number][]> = {
  // I chord tends to go to IV, V, vi, or stay
  0: [[0, 0.1], [3, 0.3], [4, 0.35], [5, 0.2], [1, 0.05]],
  // ii chord typically goes to V or vii°
  1: [[4, 0.6], [6, 0.2], [0, 0.1], [3, 0.1]],
  // iii chord goes to vi, IV, or ii
  2: [[5, 0.4], [3, 0.3], [1, 0.2], [0, 0.1]],
  // IV chord goes to V, I, ii, or vi
  3: [[4, 0.4], [0, 0.25], [1, 0.2], [5, 0.15]],
  // V chord strongly resolves to I, but can deceptive cadence to vi
  4: [[0, 0.65], [5, 0.2], [3, 0.1], [2, 0.05]],
  // vi chord goes to ii, IV, V
  5: [[1, 0.35], [3, 0.3], [4, 0.2], [2, 0.15]],
  // vii° typically resolves to I
  6: [[0, 0.7], [2, 0.15], [5, 0.15]],
};

/**
 * Generate a chord progression using Markov chains.
 */
export function generateChordProgression(
  config: GeneratorConfig,
  random: () => number,
  length: number = 4
): ChordProgression {
  const roots: number[] = [];
  const qualities: string[] = [];
  const durations: number[] = [];
  
  // Start on I (tonic)
  let currentDegree = 0;
  
  // Quality map for major scale harmony
  const qualityMap = ["maj", "min", "min", "maj", "maj", "min", "dim"];
  
  for (let i = 0; i < length; i++) {
    // Calculate root note
    const interval = config.scale.intervals[currentDegree % config.scale.intervals.length];
    roots.push(config.baseNote + interval);
    qualities.push(qualityMap[currentDegree % 7]);
    durations.push(1 + Math.floor(random() * 2)); // 1-2 bars
    
    // Transition to next chord
    const transitions = CHORD_TRANSITIONS[currentDegree] ?? [[0, 1]];
    const r = random();
    let cumulative = 0;
    
    for (const [nextDegree, weight] of transitions) {
      cumulative += weight;
      if (r <= cumulative) {
        currentDegree = nextDegree;
        break;
      }
    }
  }
  
  return { roots, qualities, durations };
}

// ============================================================================
// STAR-TO-MUSIC MAPPING
// ============================================================================

/**
 * Select a scale based on star temperature.
 */
export function selectScaleFromTemperature(temp: number): Scale {
  // Hot stars (>10000K): Bright, major modes
  if (temp > 15000) return SCALES.lydian;
  if (temp > 10000) return SCALES.major;
  if (temp > 7500) return SCALES.mixolydian;
  
  // Medium stars (5000-7500K): Neutral modes
  if (temp > 6000) return SCALES.dorian;
  if (temp > 5000) return SCALES.pentatonic;
  
  // Cool stars (<5000K): Dark, minor modes
  if (temp > 4000) return SCALES.aeolian;
  if (temp > 3500) return SCALES.phrygian;
  
  return SCALES.locrian; // Coldest, most mysterious
}

/**
 * Main function to generate complete procedural music data for a star.
 */
export function generateProceduralMusic(
  star: StarRecord,
  seed: number = Math.random()
): {
  melody: Phrase;
  harmony: Phrase;
  bassline: Phrase;
  chords: ChordProgression;
  config: GeneratorConfig;
} {
  const random = createRNG(seed);
  
  // Derive configuration from star properties
  const temp = star.temp ?? 5800;
  const mag = clamp(star.mag, -2, 10);
  const dist = star.dist ?? 10;
  
  const config: GeneratorConfig = {
    scale: selectScaleFromTemperature(temp),
    baseNote: Math.round(48 + ((temp - 3000) / (12000 - 3000)) * 12), // C3-C4 range
    octaveRange: 2,
    phraseLength: 8 + Math.floor((1 - mag / 10) * 8), // Brighter = longer phrases
    temperature: temp,
    magnitude: mag,
    distance: dist
  };
  
  // Build Markov transition matrix
  const matrix = buildTransitionMatrix(config.scale, random);
  
  // Generate and evolve melody population
  const melodyPop = initializePopulation(config, matrix, random);
  const evolvedMelody = evolvePopulation(melodyPop, config, random);
  const bestMelody = evolvedMelody[0];
  
  // Generate harmony (simpler, slower, higher)
  const harmonyConfig = { ...config, baseNote: config.baseNote + 12, phraseLength: 4 };
  const harmonyMatrix = buildTransitionMatrix(config.scale, random);
  const harmonyPop = initializePopulation(harmonyConfig, harmonyMatrix, random);
  const evolvedHarmony = evolvePopulation(harmonyPop, harmonyConfig, random, 4);
  const bestHarmony = evolvedHarmony[0];
  
  // Generate bassline (lower, simpler)
  const bassConfig = { ...config, baseNote: config.baseNote - 12, phraseLength: 4, octaveRange: 1 };
  const bassPop = initializePopulation(bassConfig, matrix, random);
  const evolvedBass = evolvePopulation(bassPop, bassConfig, random, 4);
  const bestBass = evolvedBass[0];
  
  // Generate chord progression
  const chords = generateChordProgression(config, random, 4);
  
  return {
    melody: bestMelody,
    harmony: bestHarmony,
    bassline: bestBass,
    chords,
    config
  };
}

/**
 * Convert MIDI note number to note name with octave.
 */
export function midiToNoteName(midi: number): string {
  const clamped = clamp(midi, 0, 127);
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(clamped / 12) - 1;
  const name = names[clamped % 12];
  return `${name}${octave}`;
}

/**
 * Build chord notes from root and quality.
 */
export function buildChordNotes(root: number, quality: string): string[] {
  const intervals: Record<string, number[]> = {
    maj: [0, 4, 7],
    min: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    sus4: [0, 5, 7],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10]
  };
  
  const offsets = intervals[quality] ?? intervals.maj;
  return offsets.map(i => midiToNoteName(root + i));
}
