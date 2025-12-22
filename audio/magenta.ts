"use client";

/**
 * Magenta.js Integration Module
 * 
 * Provides AI-assisted melody generation using MusicRNN models.
 * The model generates melodic variations that fit chord progressions,
 * adding subtle creativity to the procedural music.
 */

import { NoteEvent, ChordProgression, midiToNoteName } from "./gen/pattern";
import { SeededRNG } from "./gen/seed";

// Type declarations for Magenta.js
interface MagentaNoteSequence {
  notes: Array<{
    pitch: number;
    startTime: number;
    endTime: number;
    velocity?: number;
  }>;
  totalTime: number;
  tempos?: Array<{ time: number; qpm: number }>;
}

interface MusicRNNModel {
  initialize(): Promise<void>;
  continueSequence(
    sequence: MagentaNoteSequence,
    steps: number,
    temperature?: number,
    chordProgression?: string[]
  ): Promise<MagentaNoteSequence>;
  dispose(): void;
}

// Magenta model configuration
const MODEL_CHECKPOINT = 
  "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv";

// Cached model instance
let musicRNN: MusicRNNModel | null = null;
let modelLoading: Promise<void> | null = null;
let modelLoaded = false;

/**
 * Initialize the MusicRNN model
 * Called during engine initialization, runs asynchronously
 */
export async function initMagentaModel(): Promise<void> {
  if (modelLoaded) return;
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    try {
      // Dynamically import Magenta
      const magenta = await import("@magenta/music");
      
      // Create MusicRNN instance
      musicRNN = new magenta.MusicRNN(MODEL_CHECKPOINT) as unknown as MusicRNNModel;
      await musicRNN.initialize();
      
      modelLoaded = true;
      console.log("Magenta MusicRNN model loaded successfully");
    } catch (e) {
      console.warn("Failed to load Magenta model:", e);
      // Don't throw - we can fall back to procedural generation
    }
  })();

  return modelLoading;
}

/**
 * Check if the model is ready
 */
export function isMagentaReady(): boolean {
  return modelLoaded && musicRNN !== null;
}

/**
 * Convert our NoteEvents to Magenta NoteSequence format
 */
function toMagentaSequence(events: NoteEvent[], tempo: number): MagentaNoteSequence {
  const secondsPerBeat = 60 / tempo;
  
  return {
    notes: events.map(e => ({
      pitch: e.midi,
      startTime: e.time * secondsPerBeat,
      endTime: (e.time + e.duration) * secondsPerBeat,
      velocity: e.velocity,
    })),
    totalTime: Math.max(...events.map(e => (e.time + e.duration) * secondsPerBeat)),
    tempos: [{ time: 0, qpm: tempo }],
  };
}

/**
 * Convert Magenta NoteSequence back to our NoteEvents
 */
function fromMagentaSequence(sequence: MagentaNoteSequence, tempo: number): NoteEvent[] {
  const secondsPerBeat = 60 / tempo;
  
  return sequence.notes.map(note => ({
    midi: note.pitch,
    time: note.startTime / secondsPerBeat,
    duration: (note.endTime - note.startTime) / secondsPerBeat,
    velocity: note.velocity ?? 64,
  }));
}

/**
 * Convert chord progression to Magenta chord symbols
 */
function toChordSymbols(progression: ChordProgression): string[] {
  const symbols: string[] = [];
  
  for (const chord of progression.chords) {
    // Get root note name
    const root = midiToNoteName(chord.notes[0] % 12 + 60).replace(/\d+$/, "");
    
    // Determine quality suffix
    let suffix = "";
    if (chord.quality === "minor") suffix = "m";
    else if (chord.quality === "dim") suffix = "dim";
    else if (chord.quality === "aug") suffix = "aug";
    else if (chord.quality === "sus4") suffix = "sus4";
    
    symbols.push(root + suffix);
  }
  
  return symbols;
}

/**
 * Generate a melodic continuation/variation using Magenta
 * 
 * @param seedEvents - Existing notes to base the continuation on
 * @param chordProgression - Chord progression for harmonic context
 * @param steps - Number of steps (16th notes) to generate
 * @param tempo - Tempo in BPM
 * @param temperature - Randomness (0.1-2.0, higher = more random)
 */
export async function generateMelodyWithRNN(
  seedEvents: NoteEvent[],
  chordProgression: ChordProgression,
  steps: number = 32,
  tempo: number = 72,
  temperature: number = 1.0
): Promise<NoteEvent[]> {
  if (!isMagentaReady() || !musicRNN) {
    console.warn("Magenta not ready, returning empty");
    return [];
  }

  try {
    // Convert to Magenta format
    const seedSequence = toMagentaSequence(seedEvents, tempo);
    const chordSymbols = toChordSymbols(chordProgression);

    // Generate continuation
    const generated = await musicRNN.continueSequence(
      seedSequence,
      steps,
      temperature,
      chordSymbols
    );

    // Convert back to our format
    const result = fromMagentaSequence(generated, tempo);
    
    // Filter out the seed notes (Magenta includes them)
    const seedEndTime = Math.max(...seedEvents.map(e => e.time + e.duration));
    return result.filter(e => e.time >= seedEndTime);
  } catch (e) {
    console.warn("Magenta generation failed:", e);
    return [];
  }
}

/**
 * Generate a completely new melody based on chord progression
 * Uses a minimal seed and lets the RNN do most of the work
 */
export async function generateFreshMelody(
  chordProgression: ChordProgression,
  measures: number = 4,
  tempo: number = 72,
  temperature: number = 1.0
): Promise<NoteEvent[]> {
  if (!isMagentaReady() || !musicRNN) {
    console.warn("Magenta not ready, returning empty");
    return [];
  }

  try {
    // Create minimal seed (just a root note)
    const rootNote = chordProgression.chords[0].notes[0] + 12; // Octave up for melody
    const seedSequence: MagentaNoteSequence = {
      notes: [{
        pitch: rootNote,
        startTime: 0,
        endTime: 0.5,
        velocity: 64,
      }],
      totalTime: 0.5,
      tempos: [{ time: 0, qpm: tempo }],
    };

    const chordSymbols = toChordSymbols(chordProgression);
    const steps = measures * 16; // 16 steps per measure (16th notes)

    const generated = await musicRNN.continueSequence(
      seedSequence,
      steps,
      temperature,
      chordSymbols
    );

    return fromMagentaSequence(generated, tempo).slice(1); // Remove seed note
  } catch (e) {
    console.warn("Magenta fresh melody generation failed:", e);
    return [];
  }
}

/**
 * Create a variation of existing melody
 * Takes some notes and embellishes them with RNN
 */
export async function createMelodyVariation(
  original: NoteEvent[],
  chordProgression: ChordProgression,
  tempo: number = 72,
  variationAmount: number = 0.5 // 0-1, how much to change
): Promise<NoteEvent[]> {
  if (!isMagentaReady() || original.length === 0) {
    // Fall back to simple transposition variation
    return createProceduralVariation(original, variationAmount);
  }

  // Use part of original as seed, generate rest
  const seedLength = Math.max(1, Math.floor(original.length * (1 - variationAmount)));
  const seed = original.slice(0, seedLength);
  
  const temperature = 0.8 + variationAmount * 0.4; // 0.8-1.2
  const stepsToGenerate = Math.floor((original.length - seedLength) * 4);
  
  const generated = await generateMelodyWithRNN(
    seed,
    chordProgression,
    stepsToGenerate,
    tempo,
    temperature
  );

  return [...seed, ...generated];
}

/**
 * Simple procedural variation fallback
 * Used when Magenta is not available
 */
function createProceduralVariation(
  original: NoteEvent[],
  amount: number,
  seed: number = Date.now()
): NoteEvent[] {
  const rng = new SeededRNG(seed);
  
  return original.map(event => {
    if (rng.next() > amount) {
      return event; // Keep original
    }
    
    // Apply random variation
    const pitchShift = rng.nextInt(-2, 2);
    const velocityChange = rng.nextInt(-10, 10);
    
    return {
      ...event,
      midi: event.midi + pitchShift,
      velocity: Math.max(20, Math.min(100, event.velocity + velocityChange)),
    };
  });
}

/**
 * Clean up model resources
 */
export function disposeMagenta(): void {
  if (musicRNN) {
    try {
      musicRNN.dispose();
    } catch {
      // Ignore disposal errors
    }
    musicRNN = null;
  }
  modelLoaded = false;
  modelLoading = null;
}
