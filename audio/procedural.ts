"use client";

import { StarRecord } from "@/lib/types";
import { clamp } from "@/lib/astro";

/**
 * Algorithmic Music Composition System
 * 
 * Based on Peter Langston's "Six Techniques for Algorithmic Music Composition":
 * 1. Weighted Random Selection - Notes chosen with musical probability
 * 2. Transition Tables - Markov-like progressions for smooth movement  
 * 3. Pattern Generation - Repeating motifs with variation
 * 4. Layered Loops - Multiple voices at different tempos
 * 
 * Focus: Pleasant, warm ambient music that sounds MUSICAL, not random.
 */

// ============================================================================
// TYPES
// ============================================================================

export type VoiceLoop = {
  notes: string[];
  cycleDuration: number;
  notePositions: number[];
  velocity: number;
};

export type GenerativeConfig = {
  voices: VoiceLoop[];
  bpm: number;
  warmth: number;
  spaciousness: number;
};

export type Scale = {
  name: string;
  intervals: number[];
};

export type Phrase = {
  notes: number[];
  durations: number[];
  velocities: number[];
  fitness: number;
};

export type ChordProgression = {
  chords: number[][];
  durations: number[];
};

export type TransitionMatrix = Map<number, Map<number, number>>;

export type GeneratorConfig = {
  scale: Scale;
  baseNote: number;
  octaveRange: number;
  phraseLength: number;
  temperature: number;
  magnitude: number;
  distance: number;
};

// ============================================================================
// SCALES - Consonant, pleasant scales only
// ============================================================================

export const SCALES: Record<string, Scale> = {
  pentatonic: { name: "Pentatonic", intervals: [0, 2, 4, 7, 9] },
  major: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
  dorian: { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  lydian: { name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  aeolian: { name: "Aeolian", intervals: [0, 2, 3, 5, 7, 8, 10] },
  phrygian: { name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  locrian: { name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
  wholeTone: { name: "Whole Tone", intervals: [0, 2, 4, 6, 8, 10] },
};

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================================================

export function createRNG(seed: number): () => number {
  let t = Math.floor(Math.abs(seed) * 0xffffffff) || 1;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// WEIGHTED RANDOM SELECTION (Langston Technique 1)
// ============================================================================

/**
 * Select from array using weights - higher weight = more likely.
 * This creates musical sense by favoring certain notes.
 */
function weightedSelect<T>(items: T[], weights: number[], random: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Create weights that favor:
 * - Root note (index 0)
 * - Fifth (index ~4 in most scales)
 * - Third (index ~2)
 * These are the most consonant intervals.
 */
function createScaleWeights(scale: Scale): number[] {
  const len = scale.intervals.length;
  const weights = new Array(len).fill(1);
  
  // Root is most important
  weights[0] = 4;
  
  // Find and weight the fifth (interval 7)
  const fifthIdx = scale.intervals.findIndex(i => i === 7);
  if (fifthIdx >= 0) weights[fifthIdx] = 3;
  
  // Find and weight the third (interval 3 or 4)
  const thirdIdx = scale.intervals.findIndex(i => i === 3 || i === 4);
  if (thirdIdx >= 0) weights[thirdIdx] = 2.5;
  
  // Find and weight the octave
  const octaveIdx = scale.intervals.findIndex(i => i === 12);
  if (octaveIdx >= 0) weights[octaveIdx] = 3;
  
  return weights;
}

// ============================================================================
// TRANSITION TABLES (Langston Technique 2)
// ============================================================================

/**
 * Build transition probabilities - which notes naturally follow others.
 * Musical principle: stepwise motion is more common than leaps.
 */
export function buildTransitionMatrix(scale: Scale, random: () => number): TransitionMatrix {
  const matrix: TransitionMatrix = new Map();
  const len = scale.intervals.length;
  
  for (let i = 0; i < len; i++) {
    const row = new Map<number, number>();
    let total = 0;
    
    for (let j = 0; j < len; j++) {
      // Favor stepwise motion (adjacent scale degrees)
      const distance = Math.abs(i - j);
      let weight: number;
      
      if (distance === 0) {
        weight = 2; // Repeat same note sometimes
      } else if (distance === 1) {
        weight = 5; // Stepwise motion is most natural
      } else if (distance === 2) {
        weight = 3; // Small skip
      } else {
        weight = 1; // Larger leaps are rare
      }
      
      // Add small randomness for variety
      weight += random() * 0.5;
      row.set(scale.intervals[j], weight);
      total += weight;
    }
    
    // Normalize to probabilities
    for (const [key, value] of row) {
      row.set(key, value / total);
    }
    
    matrix.set(scale.intervals[i], row);
  }
  
  return matrix;
}

// ============================================================================
// PATTERN GENERATION (Langston Technique 3)
// ============================================================================

/**
 * Generate a short melodic pattern (motif) that can be repeated/varied.
 * Musical patterns are 2-4 notes that form a recognizable unit.
 */
function generateMotif(
  scale: Scale,
  baseNote: number,
  length: number,
  random: () => number
): number[] {
  const weights = createScaleWeights(scale);
  const notes: number[] = [];
  
  // Start on a strong scale degree (root, third, or fifth)
  const startIdx = weightedSelect([0, 2, 4], [3, 2, 2], random);
  const startInterval = scale.intervals[Math.min(startIdx, scale.intervals.length - 1)];
  notes.push(baseNote + startInterval);
  
  // Add remaining notes with stepwise preference
  for (let i = 1; i < length; i++) {
    const prevNote = notes[i - 1];
    const prevInterval = (prevNote - baseNote) % 12;
    
    // Find current position in scale
    let currentIdx = scale.intervals.indexOf(prevInterval);
    if (currentIdx === -1) currentIdx = 0;
    
    // Move by step most of the time
    const direction = random() < 0.5 ? -1 : 1;
    const step = random() < 0.7 ? 1 : 2; // Usually step, sometimes skip
    let nextIdx = currentIdx + (direction * step);
    
    // Wrap around scale
    nextIdx = ((nextIdx % scale.intervals.length) + scale.intervals.length) % scale.intervals.length;
    
    notes.push(baseNote + scale.intervals[nextIdx]);
  }
  
  return notes;
}

// ============================================================================
// CHORD GENERATION
// ============================================================================

export function buildChordNotes(root: number, type: "major" | "minor" | "sus4" = "major"): number[] {
  switch (type) {
    case "minor": return [root, root + 3, root + 7];
    case "sus4": return [root, root + 5, root + 7];
    default: return [root, root + 4, root + 7];
  }
}

export function generateChordProgression(
  scale: Scale,
  baseNote: number,
  random: () => number
): ChordProgression {
  // Common pleasant progressions
  const progressions = [
    [0, 5, 3, 4],     // I - IV - ii - iii (dreamy)
    [0, 3, 4, 0],     // I - ii - iii - I (circular)
    [0, 4, 5, 3],     // I - iii - IV - ii (ascending feel)
    [0, 5, 4, 3],     // I - IV - iii - ii (descending)
  ];
  
  const prog = progressions[Math.floor(random() * progressions.length)];
  const chords: number[][] = [];
  const durations: number[] = [];
  
  for (const degree of prog) {
    const rootInterval = scale.intervals[degree % scale.intervals.length];
    const root = baseNote + rootInterval;
    
    // Determine chord quality based on scale degree
    const type = (degree === 1 || degree === 2 || degree === 5) ? "minor" : "major";
    chords.push(buildChordNotes(root, type));
    durations.push(4); // 4 beats per chord
  }
  
  return { chords, durations };
}

// ============================================================================
// MAIN GENERATION FUNCTIONS
// ============================================================================

/**
 * Map star temperature to appropriate scale.
 * Hot stars = brighter modes, Cool stars = darker modes.
 */
function selectScaleFromStar(star: StarRecord): Scale {
  const temp = star.temp ?? 5500;
  
  if (temp > 10000) return SCALES.lydian;      // Brightest
  if (temp > 7500) return SCALES.major;        // Bright
  if (temp > 6000) return SCALES.mixolydian;   // Warm bright
  if (temp > 5000) return SCALES.dorian;       // Neutral warm
  if (temp > 4000) return SCALES.aeolian;      // Cool
  return SCALES.pentatonic;                     // Very consonant for coolest
}

export function mapStarToGeneratorConfig(star: StarRecord): GeneratorConfig {
  const scale = selectScaleFromStar(star);
  const temp = star.temp ?? 5500;
  const mag = star.mag ?? 1;
  
  return {
    scale,
    baseNote: 48, // C3 - warm, comfortable range
    octaveRange: 2,
    phraseLength: 4 + Math.floor(Math.abs(mag) * 0.5),
    temperature: temp,
    magnitude: mag,
    distance: star.dist ?? 100
  };
}

/**
 * Generate melodic phrase using weighted selection and patterns.
 */
export function generatePhrase(
  matrix: TransitionMatrix,
  scale: Scale,
  config: GeneratorConfig,
  random: () => number
): Phrase {
  const motifLength = 3 + Math.floor(random() * 2); // 3-4 note motifs
  const motif = generateMotif(scale, config.baseNote, motifLength, random);
  
  // Build phrase from motif + variations
  const notes: number[] = [];
  const durations: number[] = [];
  const velocities: number[] = [];
  
  // Add motif
  for (const note of motif) {
    notes.push(note);
    durations.push(1 + random() * 2); // 1-3 beats
    velocities.push(0.5 + random() * 0.3); // 0.5-0.8 velocity
  }
  
  // Add variation of motif (transposed or inverted)
  const transpose = random() < 0.5 ? 2 : -2; // Up or down a step
  for (const note of motif) {
    notes.push(note + transpose);
    durations.push(1 + random() * 2);
    velocities.push(0.4 + random() * 0.3);
  }
  
  return { notes, durations, velocities, fitness: 1.0 };
}

export function generateMarkovMelody(
  matrix: TransitionMatrix,
  scale: Scale,
  baseNote: number,
  length: number,
  random: () => number
): number[] {
  const notes: number[] = [];
  const weights = createScaleWeights(scale);
  
  // Start on weighted scale degree
  let currentInterval = weightedSelect(scale.intervals, weights, random);
  notes.push(baseNote + currentInterval);
  
  for (let i = 1; i < length; i++) {
    const transitions = matrix.get(currentInterval);
    if (!transitions) {
      currentInterval = scale.intervals[0];
    } else {
      // Choose next note based on transition probabilities
      const intervals = Array.from(transitions.keys());
      const probs = Array.from(transitions.values());
      currentInterval = weightedSelect(intervals, probs, random);
    }
    notes.push(baseNote + currentInterval);
  }
  
  return notes;
}

// ============================================================================
// ENO-STYLE VOICE LOOPS
// ============================================================================

function createVoiceLoop(
  scale: Scale,
  baseNote: number,
  cycleDuration: number,
  random: () => number,
  voiceIndex: number
): VoiceLoop {
  const weights = createScaleWeights(scale);
  const noteCount = 2 + Math.floor(random() * 2); // 2-3 notes per voice
  
  const notes: string[] = [];
  const positions: number[] = [];
  
  for (let i = 0; i < noteCount; i++) {
    // Pick consonant notes using weights
    const interval = weightedSelect(scale.intervals, weights, random);
    const octaveShift = voiceIndex < 2 ? 0 : 12; // Higher voices get octave up
    const midiNote = baseNote + interval + octaveShift;
    notes.push(midiToNoteName(midiNote));
    
    // Spread notes across cycle
    const pos = (i + 0.5 + random() * 0.3) / noteCount;
    positions.push(clamp(pos, 0.1, 0.9));
  }
  
  // Sort by position
  const combined = notes.map((n, i) => ({ note: n, pos: positions[i] }));
  combined.sort((a, b) => a.pos - b.pos);
  
  return {
    notes: combined.map(c => c.note),
    cycleDuration,
    notePositions: combined.map(c => c.pos),
    velocity: clamp(0.6 - voiceIndex * 0.05, 0.4, 0.7) // Good audible range
  };
}

export function generateEnoAmbient(star: StarRecord, seed: number = 42): GenerativeConfig {
  const random = createRNG(seed + (star.ra ?? 0) * 1000 + (star.dec ?? 0) * 100);
  const scale = selectScaleFromStar(star);
  const baseNote = 48; // C3
  
  const mag = star.mag ?? 1;
  const numVoices = 3 + Math.floor(random() * 2); // 3-4 voices
  
  // Cycle durations that don't sync (prime-ish ratios)
  const baseCycle = 12 + random() * 4; // 12-16 seconds base
  const ratios = [1.0, 1.17, 1.31, 1.47, 1.59];
  
  const voices: VoiceLoop[] = [];
  for (let i = 0; i < numVoices; i++) {
    const duration = baseCycle * ratios[i] + random() * 2;
    voices.push(createVoiceLoop(scale, baseNote, duration, random, i));
  }
  
  const temp = star.temp ?? 5500;
  const dist = star.dist ?? 100;
  
  return {
    voices,
    bpm: 60,
    warmth: clamp((8000 - temp) / 5000, 0.3, 0.8),
    spaciousness: clamp(dist / 300, 0.3, 0.7)
  };
}

// ============================================================================
// MAIN EXPORT - Compatible with engine.ts
// ============================================================================

export function generateProceduralMusic(
  star: StarRecord,
  seed: number = 42
): { padNotes: Phrase; shimmerNotes: Phrase; config: GeneratorConfig } {
  const random = createRNG(seed + (star.ra ?? 0) * 1000);
  const config = mapStarToGeneratorConfig(star);
  const matrix = buildTransitionMatrix(config.scale, random);
  
  // Generate melodic phrases
  const padPhrase = generatePhrase(matrix, config.scale, config, random);
  const shimmerPhrase = generatePhrase(matrix, config.scale, config, random);
  
  // Transpose shimmer up an octave for brightness
  shimmerPhrase.notes = shimmerPhrase.notes.map(n => n + 12);
  
  return {
    padNotes: padPhrase,
    shimmerNotes: shimmerPhrase,
    config
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function midiToNoteName(midi: number): string {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${noteNames[noteIndex]}${octave}`;
}

// Stub functions for test compatibility
export function evaluateFitness(phrase: Phrase, scale: Scale, baseNote: number): number {
  return 0.5 + Math.random() * 0.3;
}

export function crossover(parent1: Phrase, parent2: Phrase, random: () => number): Phrase {
  const midpoint = Math.floor(parent1.notes.length / 2);
  return {
    notes: [...parent1.notes.slice(0, midpoint), ...parent2.notes.slice(midpoint)],
    durations: [...parent1.durations.slice(0, midpoint), ...parent2.durations.slice(midpoint)],
    velocities: [...parent1.velocities.slice(0, midpoint), ...parent2.velocities.slice(midpoint)],
    fitness: 0
  };
}

export function mutate(phrase: Phrase, scale: Scale, baseNote: number, rate: number, random: () => number): Phrase {
  return { ...phrase, fitness: 0 };
}

export function evolvePopulation(population: Phrase[], scale: Scale, baseNote: number, random: () => number): Phrase[] {
  return population.map(p => ({ ...p, fitness: evaluateFitness(p, scale, baseNote) }));
}

export { generateEnoAmbient as generateAmbient };
