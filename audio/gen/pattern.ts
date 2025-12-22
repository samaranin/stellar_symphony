"use client";

import { StarRecord } from "@/lib/types";
import { SeededRNG } from "./seed";

/**
 * Pattern Generator Module
 * 
 * Generates musical patterns (chords, melodies, motifs) based on star data
 * and random seed. Implements music theory concepts like scales, modes,
 * chord progressions, and melodic patterns.
 */

// ============================================================================
// TYPES
// ============================================================================

export type Scale = {
  name: string;
  intervals: number[];
};

export type ChordVoicing = {
  notes: number[];  // MIDI note numbers
  quality: "major" | "minor" | "sus4" | "dim" | "aug";
};

export type ChordProgression = {
  chords: ChordVoicing[];
  durations: number[];  // in beats
};

export type Motif = {
  notes: number[];     // MIDI note numbers
  durations: number[]; // in beats
  velocities: number[]; // 0-127
};

export type NoteEvent = {
  midi: number;
  time: number;    // in beats
  duration: number; // in beats
  velocity: number; // 0-127
};

export type PatternConfig = {
  scale: Scale;
  baseNote: number;
  mode: string;
  tempo: number;
  phraseLength: number;
  density: number;
};

// ============================================================================
// SCALES AND MODES
// ============================================================================

export const SCALES: Record<string, Scale> = {
  ionian:     { name: "Ionian (Major)",     intervals: [0, 2, 4, 5, 7, 9, 11] },
  dorian:     { name: "Dorian",             intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian:   { name: "Phrygian",           intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian:     { name: "Lydian",             intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: "Mixolydian",         intervals: [0, 2, 4, 5, 7, 9, 10] },
  aeolian:    { name: "Aeolian (Minor)",    intervals: [0, 2, 3, 5, 7, 8, 10] },
  locrian:    { name: "Locrian",            intervals: [0, 1, 3, 5, 6, 8, 10] },
  pentatonic: { name: "Pentatonic Major",   intervals: [0, 2, 4, 7, 9] },
  pentatonicMinor: { name: "Pentatonic Minor", intervals: [0, 3, 5, 7, 10] },
};

/**
 * Map star spectral class to musical mode
 * Hot stars → bright modes, Cool stars → darker modes
 */
export function spectralClassToMode(spec?: string): string {
  if (!spec) return "dorian";
  
  const letter = spec.charAt(0).toUpperCase();
  const modeMap: Record<string, string> = {
    "O": "lydian",      // Hottest - brightest mode (raised 4th)
    "B": "ionian",      // Hot - major mode
    "A": "mixolydian",  // Bright - major with flat 7
    "F": "dorian",      // Moderate - minor with raised 6
    "G": "dorian",      // Sun-like - balanced
    "K": "aeolian",     // Cool - natural minor
    "M": "phrygian",    // Coolest - dark, Spanish flavor
  };
  
  return modeMap[letter] ?? "dorian";
}

/**
 * Map star temperature to musical parameters
 */
export function temperatureToParams(temp?: number): { brightness: number; warmth: number } {
  const t = temp ?? 5500;
  // Normalize temperature to 0-1 range (3000K - 30000K)
  const normalized = Math.max(0, Math.min(1, (t - 3000) / (30000 - 3000)));
  
  return {
    brightness: normalized,     // Higher temp = brighter sound
    warmth: 1 - normalized,     // Lower temp = warmer sound
  };
}

/**
 * Derive a base MIDI note from star properties
 */
export function starToBaseNote(star: StarRecord): number {
  const temp = star.temp ?? specToTemp(star.spec);
  // Map temperature to MIDI range 36-60 (C2-C4)
  // Hotter stars = higher base note
  const normalized = Math.max(0, Math.min(1, (temp - 3000) / (12000 - 3000)));
  return Math.round(36 + normalized * 24);
}

function specToTemp(spec?: string): number {
  if (!spec) return 5800;
  const letter = spec.charAt(0).toUpperCase();
  const map: Record<string, number> = {
    O: 30000, B: 20000, A: 10000, F: 7500, G: 5800, K: 4500, M: 3200
  };
  return map[letter] ?? 5800;
}

// ============================================================================
// CHORD GENERATION
// ============================================================================

/**
 * Build a chord voicing from root and quality
 */
export function buildChord(root: number, quality: ChordVoicing["quality"]): ChordVoicing {
  const intervals: Record<string, number[]> = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    sus4:  [0, 5, 7],
    dim:   [0, 3, 6],
    aug:   [0, 4, 8],
  };
  
  return {
    notes: intervals[quality].map(i => root + i),
    quality,
  };
}

/**
 * Create an open voicing by spreading notes across octaves
 * This creates the spacious sound characteristic of ambient music
 */
export function openVoicing(chord: ChordVoicing, baseOctave: number = 3): number[] {
  const root = chord.notes[0];
  const third = chord.notes[1];
  const fifth = chord.notes[2];
  
  // Spread across two octaves for openness
  // Root in bass, fifth an octave up, third higher still
  return [
    root + (baseOctave - 1) * 12,   // Bass root
    fifth + baseOctave * 12,         // Middle fifth
    third + (baseOctave + 1) * 12,   // Upper third
  ];
}

/**
 * Generate ambient chord progression
 * Progressions are simple (2-3 chords) for meditative quality
 */
export function generateChordProgression(
  scale: Scale,
  baseNote: number,
  rng: SeededRNG
): ChordProgression {
  // Ambient progressions - simple, cyclic, meditative
  const progressionTypes = [
    // Type 1: I - IV (simple, open)
    [{ degree: 0, quality: "major" as const }, { degree: 3, quality: "major" as const }],
    // Type 2: i - VI (minor to relative major)
    [{ degree: 0, quality: "minor" as const }, { degree: 5, quality: "major" as const }],
    // Type 3: I - vi - IV (common ambient)
    [{ degree: 0, quality: "major" as const }, { degree: 5, quality: "minor" as const }, { degree: 3, quality: "major" as const }],
    // Type 4: i - iv (all minor, darker)
    [{ degree: 0, quality: "minor" as const }, { degree: 3, quality: "minor" as const }],
  ];
  
  const progType = rng.pick(progressionTypes);
  const chords: ChordVoicing[] = [];
  const durations: number[] = [];
  
  for (const step of progType) {
    const scaleIndex = step.degree % scale.intervals.length;
    const rootInterval = scale.intervals[scaleIndex];
    const root = baseNote + rootInterval;
    
    chords.push(buildChord(root, step.quality));
    durations.push(rng.nextFloat(4, 8)); // 4-8 beats per chord
  }
  
  return { chords, durations };
}

// ============================================================================
// MELODY GENERATION
// ============================================================================

/**
 * Generate a short melodic motif (2-4 notes)
 * Motifs are the building blocks of the piano melody
 */
export function generateMotif(
  scale: Scale,
  baseNote: number,
  rng: SeededRNG,
  length: number = 3
): Motif {
  const notes: number[] = [];
  const durations: number[] = [];
  const velocities: number[] = [];
  
  // Start on a consonant note (root, third, or fifth)
  const startWeights = [4, 1, 2.5, 1, 2, 1, 1]; // Favor root, third, fifth
  const weights = startWeights.slice(0, scale.intervals.length);
  let currentIdx = rng.weightedPick(
    scale.intervals.map((_, i) => i),
    weights
  );
  
  for (let i = 0; i < length; i++) {
    // Get current note
    const interval = scale.intervals[currentIdx];
    const octaveShift = rng.next() < 0.3 ? 12 : 0; // Occasionally octave up
    notes.push(baseNote + interval + octaveShift);
    
    // Duration: favor longer notes for ambient feel
    const dur = rng.weightedPick([2, 3, 4, 6], [1, 2, 2, 1]);
    durations.push(dur);
    
    // Velocity: gentle, with slight variation
    velocities.push(rng.nextInt(40, 70));
    
    // Move to next note (prefer stepwise motion)
    const direction = rng.next() < 0.5 ? -1 : 1;
    const step = rng.next() < 0.7 ? 1 : 2;
    currentIdx = (currentIdx + direction * step + scale.intervals.length) % scale.intervals.length;
  }
  
  return { notes, durations, velocities };
}

/**
 * Generate a sequence of note events for the piano
 * Creates sparse, contemplative piano lines
 */
export function generatePianoSequence(
  scale: Scale,
  baseNote: number,
  chord: ChordVoicing,
  measureCount: number,
  rng: SeededRNG
): NoteEvent[] {
  const events: NoteEvent[] = [];
  const beatsPerMeasure = 4;
  const totalBeats = measureCount * beatsPerMeasure;
  
  // Generate 1-3 motifs to fill the section
  const motifCount = rng.nextInt(1, 2);
  const motifs: Motif[] = [];
  for (let i = 0; i < motifCount; i++) {
    motifs.push(generateMotif(scale, baseNote + 12, rng)); // Piano an octave up
  }
  
  // Place motifs sparsely across the measures
  let currentBeat = rng.nextFloat(0, 2); // Start with some space
  
  for (const motif of motifs) {
    for (let i = 0; i < motif.notes.length; i++) {
      if (currentBeat >= totalBeats) break;
      
      events.push({
        midi: motif.notes[i],
        time: currentBeat,
        duration: motif.durations[i],
        velocity: motif.velocities[i],
      });
      
      currentBeat += motif.durations[i] + rng.nextFloat(0.5, 2); // Add space between notes
    }
    
    // Large gap between motifs
    currentBeat += rng.nextFloat(4, 8);
  }
  
  return events;
}

// ============================================================================
// STRING PAD PATTERNS
// ============================================================================

/**
 * Generate string pad note events for sustained chords
 */
export function generateStringPadSequence(
  chordProg: ChordProgression,
  rng: SeededRNG
): NoteEvent[] {
  const events: NoteEvent[] = [];
  let currentBeat = 0;
  
  for (let i = 0; i < chordProg.chords.length; i++) {
    const chord = chordProg.chords[i];
    const duration = chordProg.durations[i];
    
    // Create open voicing for spacious sound
    const voicedNotes = openVoicing(chord, 2);
    
    // Stagger note entries slightly for natural feel
    for (let j = 0; j < voicedNotes.length; j++) {
      const stagger = j * rng.nextFloat(0.1, 0.3);
      events.push({
        midi: voicedNotes[j],
        time: currentBeat + stagger,
        duration: duration - stagger + rng.nextFloat(0, 1), // Overlap slightly
        velocity: rng.nextInt(35, 55), // Soft pad
      });
    }
    
    currentBeat += duration;
  }
  
  return events;
}

// ============================================================================
// FULL PATTERN GENERATION
// ============================================================================

export type GeneratedPattern = {
  pianoEvents: NoteEvent[];
  stringEvents: NoteEvent[];
  config: PatternConfig;
  chordProgression: ChordProgression;
  cycleDuration: number; // Total loop length in beats
};

/**
 * Generate a complete musical pattern from star data
 */
export function generatePatternFromStar(
  star: StarRecord,
  seed: number
): GeneratedPattern {
  const rng = new SeededRNG(seed);
  
  // Derive musical parameters from star
  const mode = spectralClassToMode(star.spec);
  const scale = SCALES[mode] ?? SCALES.dorian;
  const baseNote = starToBaseNote(star);
  const { brightness } = temperatureToParams(star.temp);
  
  // Brightness affects tempo and density
  const tempo = 60 + brightness * 20; // 60-80 BPM
  const density = 0.3 + brightness * 0.3; // 0.3-0.6
  
  // Generate chord progression (2-3 chords)
  const chordProgression = generateChordProgression(scale, baseNote, rng);
  
  // Calculate total cycle duration
  const cycleDuration = chordProgression.durations.reduce((a, b) => a + b, 0);
  const measureCount = Math.ceil(cycleDuration / 4);
  
  // Generate patterns
  const pianoEvents = generatePianoSequence(
    scale,
    baseNote,
    chordProgression.chords[0],
    measureCount,
    rng
  );
  
  const stringEvents = generateStringPadSequence(chordProgression, rng);
  
  return {
    pianoEvents,
    stringEvents,
    config: {
      scale,
      baseNote,
      mode,
      tempo,
      phraseLength: measureCount * 4,
      density,
    },
    chordProgression,
    cycleDuration,
  };
}

// ============================================================================
// MIDI UTILITIES
// ============================================================================

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function noteNameToMidi(noteName: string): number {
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60; // Default to middle C
  
  const [, note, octaveStr] = match;
  const noteIndex = NOTE_NAMES.indexOf(note);
  const octave = parseInt(octaveStr, 10);
  
  return (octave + 1) * 12 + noteIndex;
}
