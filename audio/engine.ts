"use client";

/**
 * Stellar Symphony Ambient Music Engine
 * 
 * Generates continuous, neoclassical ambient soundscapes for an interactive star map.
 * Inspired by artists like Stars of the Lid and Ólafur Arnalds.
 * 
 * Architecture:
 * - Tone.js for scheduling and effects
 * - Procedural pattern generation with optional Magenta.js AI assistance
 * - Star parameters drive musical characteristics (mode, tempo, density)
 * 
 * This engine runs entirely client-side with no server processing.
 */

import { StarRecord } from "@/lib/types";
import { clamp } from "@/lib/astro";

// ============================================================================
// TYPES
// ============================================================================

export interface StarMusicParams {
  baseNote: number;
  scale: Scale;
  tempo: number;
  warmth: number;
  spaciousness: number;
  density: number;
}

export interface Scale {
  name: string;
  intervals: number[];
}

export interface NoteEvent {
  midi: number;
  time: number;     // beats
  duration: number; // beats
  velocity: number; // 0-127
}

export interface VoiceLoop {
  notes: string[];
  cycleDuration: number;
  notePositions: number[];
  velocity: number;
}

export interface GenerativeConfig {
  voices: VoiceLoop[];
  bpm: number;
  warmth: number;
  spaciousness: number;
}

// ============================================================================
// SCALES
// ============================================================================

const SCALES: Record<string, Scale> = {
  ionian:     { name: "Ionian (Major)",     intervals: [0, 2, 4, 5, 7, 9, 11] },
  dorian:     { name: "Dorian",             intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian:   { name: "Phrygian",           intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian:     { name: "Lydian",             intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: "Mixolydian",         intervals: [0, 2, 4, 5, 7, 9, 10] },
  aeolian:    { name: "Aeolian (Minor)",    intervals: [0, 2, 3, 5, 7, 8, 10] },
  pentatonic: { name: "Pentatonic",         intervals: [0, 2, 4, 7, 9] },
};

// ============================================================================
// ENGINE STATE
// ============================================================================

interface EngineState {
  initialized: boolean;
  playing: boolean;
  currentStar: StarRecord | null;
  currentSeed: number;
  userVolume: number;
  baseGain: number;
  loopCount: number;
  
  // Tone.js instances
  pianoSynth: any;
  stringSynth: any;
  shimmerSynth: any;
  reverb: any;
  filter: any;
  delay: any;
  masterGain: any;
  transport: any;
  
  // Loop tracking
  loop: any;
  scheduledIds: number[];
}

const state: EngineState = {
  initialized: false,
  playing: false,
  currentStar: null,
  currentSeed: 0,
  userVolume: 0.7,
  baseGain: 0.5,
  loopCount: 0,
  pianoSynth: null,
  stringSynth: null,
  shimmerSynth: null,
  reverb: null,
  filter: null,
  delay: null,
  masterGain: null,
  transport: null,
  loop: null,
  scheduledIds: [],
};

// Tone.js module reference
let Tone: any = null;

// ============================================================================
// SEEDED RNG
// ============================================================================

class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = Math.floor(Math.abs(seed) * 0xffffffff) || 1;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  weightedPick<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

// ============================================================================
// TONE.JS IMPORT
// ============================================================================

async function importTone(): Promise<any> {
  if (Tone) return Tone;
  
  const mod: any = await import("tone");
  
  // Handle different export patterns
  const candidates = [mod, mod?.default, mod?.Tone, (globalThis as any)?.Tone];
  Tone = candidates.find(c => c && (c.Transport || c.getTransport));
  
  if (!Tone) {
    throw new Error("Failed to load Tone.js");
  }
  
  return Tone;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize the audio engine
 * Must be called on user gesture (click) due to browser autoplay policies
 */
export async function initAudio(): Promise<void> {
  if (state.initialized) return;
  
  const T = await importTone();
  
  // Resume audio context (required for autoplay policy)
  if (typeof T.start === "function") {
    await T.start();
  } else {
    const ctx = T.getContext?.() ?? T.context;
    if (ctx?.state === "suspended") {
      await ctx.resume();
    }
  }
  
  const Transport = T.Transport ?? T.getTransport?.();
  const Destination = T.Destination ?? T.getDestination?.() ?? T.context?.destination;
  
  if (!Transport || !Destination) {
    throw new Error("Tone.js not properly loaded");
  }
  
  // Create piano synth (triangle wave for soft attack)
  state.pianoSynth = new T.PolySynth(T.Synth, {
    oscillator: { type: "triangle" },
    envelope: {
      attack: 0.02,
      decay: 0.4,
      sustain: 0.3,
      release: 2.0
    }
  });
  
  // Create string pad synth (sine wave for warmth)
  state.stringSynth = new T.PolySynth(T.Synth, {
    oscillator: { type: "sine" },
    envelope: {
      attack: 1.5,
      decay: 0.5,
      sustain: 0.8,
      release: 4.0
    }
  });
  
  // Create shimmer synth for upper harmonics
  state.shimmerSynth = new T.PolySynth(T.Synth, {
    oscillator: { type: "sine" },
    envelope: {
      attack: 2.0,
      decay: 1.0,
      sustain: 0.4,
      release: 5.0
    }
  });
  
  // Effects chain
  state.reverb = new T.Reverb({ decay: 6, wet: 0.4, preDelay: 0.1 });
  await state.reverb.generate();
  
  state.filter = new T.Filter({ frequency: 3500, type: "lowpass", Q: 0.5 });
  
  if (T.FeedbackDelay) {
    state.delay = new T.FeedbackDelay({ delayTime: "4n", feedback: 0.15, wet: 0.12 });
  }
  
  state.masterGain = new T.Gain(state.userVolume * state.baseGain);
  
  // Connect chain: synths → filter → delay → reverb → master → destination
  const chain = [state.filter, state.delay, state.reverb, state.masterGain].filter(Boolean);
  
  state.pianoSynth.chain(...chain, Destination);
  state.stringSynth.chain(...chain, Destination);
  state.shimmerSynth.chain(...chain, Destination);
  
  state.transport = Transport;
  state.initialized = true;
  
  console.log("Stellar Symphony engine initialized");
}

/**
 * Load instruments (placeholder for SoundFont loading)
 */
export async function loadInstruments(): Promise<void> {
  if (!state.initialized) {
    await initAudio();
  }
  // Currently using Tone.js synths - no additional loading needed
}

/**
 * Play music for a star
 */
export async function playForStar(star: StarRecord, seed?: number): Promise<void> {
  if (!state.initialized) {
    await initAudio();
  }
  
  // Stop current playback
  if (state.playing) {
    stopAudio();
  }
  
  // Generate seed from star if not provided
  const finalSeed = seed ?? hashStar(star);
  state.currentStar = star;
  state.currentSeed = finalSeed;
  state.loopCount = 0;
  
  // Generate music parameters from star
  const params = starToMusicParams(star);
  
  // Configure effects
  configureEffects(params);
  
  // Generate and schedule pattern
  const pattern = generatePattern(star, finalSeed, params);
  schedulePattern(pattern, params);
  
  // Play immediate chord for instant feedback
  playImmediateChord(params);
  
  // Start transport
  state.transport.start();
  state.playing = true;
  
  console.log(`Playing music for ${star.name ?? star.id}`);
}

/**
 * Stop audio playback
 */
export function stopAudio(): void {
  if (!state.transport) return;
  
  state.transport.stop();
  state.transport.cancel();
  
  // Release all notes
  state.pianoSynth?.releaseAll();
  state.stringSynth?.releaseAll();
  state.shimmerSynth?.releaseAll();
  
  state.playing = false;
  state.scheduledIds = [];
}

/**
 * Set master volume (0-1)
 */
export function setVolume(volume: number): void {
  state.userVolume = clamp(volume, 0, 1);
  
  if (state.masterGain) {
    const target = state.userVolume * state.baseGain;
    state.masterGain.gain.rampTo(target, 0.1);
  }
}

/**
 * Get current volume
 */
export function getVolume(): number {
  return state.userVolume;
}

/**
 * Check if playing
 */
export function isPlaying(): boolean {
  return state.playing;
}

/**
 * Check if initialized
 */
export function isInitialized(): boolean {
  return state.initialized;
}

// ============================================================================
// STAR → MUSIC PARAMETER MAPPING
// ============================================================================

function starToMusicParams(star: StarRecord): StarMusicParams {
  const temp = star.temp ?? specToTemp(star.spec);
  const mag = star.mag ?? 1;
  const dist = star.dist ?? 100;
  
  // Temperature → scale/mode
  const scale = tempToScale(temp);
  
  // Temperature → base note (hotter = higher)
  const tempNorm = clamp((temp - 3000) / (12000 - 3000), 0, 1);
  const baseNote = Math.round(36 + tempNorm * 24); // C2 to C4
  
  // Magnitude → tempo and density (brighter = more active)
  const magNorm = clamp((6 - mag) / 8, 0, 1); // Invert: brighter stars have lower mag
  const tempo = 55 + magNorm * 25; // 55-80 BPM
  const density = 0.2 + magNorm * 0.4; // 0.2-0.6
  
  // Temperature → warmth
  const warmth = clamp((8000 - temp) / 5000, 0.2, 0.8);
  
  // Distance → spaciousness
  const spaciousness = clamp(dist / 400, 0.2, 0.7);
  
  return { baseNote, scale, tempo, warmth, spaciousness, density };
}

function tempToScale(temp: number): Scale {
  if (temp > 10000) return SCALES.lydian;      // Hot blue - bright, ethereal
  if (temp > 7500)  return SCALES.ionian;      // White - major, open
  if (temp > 6000)  return SCALES.mixolydian;  // Yellow-white - slightly flat 7
  if (temp > 5000)  return SCALES.dorian;      // Yellow/orange - minor with raised 6
  if (temp > 4000)  return SCALES.aeolian;     // Orange - natural minor
  return SCALES.pentatonic;                     // Red - simple, warm
}

function specToTemp(spec?: string): number {
  if (!spec) return 5800;
  const map: Record<string, number> = {
    O: 30000, B: 20000, A: 10000, F: 7500, G: 5800, K: 4500, M: 3200
  };
  return map[spec.charAt(0).toUpperCase()] ?? 5800;
}

function hashStar(star: StarRecord): number {
  let hash = 0;
  const str = star.id + star.ra + star.dec;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ============================================================================
// EFFECTS CONFIGURATION
// ============================================================================

function configureEffects(params: StarMusicParams): void {
  if (!state.filter || !state.reverb) return;
  
  // Filter: warmth affects cutoff
  const filterFreq = 1500 + (1 - params.warmth) * 4000;
  state.filter.frequency.rampTo(filterFreq, 0.5);
  
  // Reverb: spaciousness affects wet mix
  state.reverb.wet.rampTo(0.25 + params.spaciousness * 0.35, 0.5);
  
  // Delay: spaciousness affects feedback
  if (state.delay) {
    state.delay.wet.rampTo(0.08 + params.spaciousness * 0.12, 0.5);
  }
  
  // Base gain from magnitude
  state.baseGain = 0.4 + params.density * 0.3;
  if (state.masterGain) {
    state.masterGain.gain.rampTo(state.userVolume * state.baseGain, 0.3);
  }
}

// ============================================================================
// PATTERN GENERATION
// ============================================================================

interface Pattern {
  pianoNotes: NoteEvent[];
  stringNotes: NoteEvent[];
  shimmerNotes: NoteEvent[];
  cycleDuration: number;
}

function generatePattern(star: StarRecord, seed: number, params: StarMusicParams): Pattern {
  const rng = new SeededRNG(seed);
  const { scale, baseNote, density } = params;
  
  // Generate chord progression (2 chords for A/B sections)
  const chords = generateChords(scale, baseNote, rng);
  
  // Determine cycle duration (4-8 measures)
  const measures = 4 + rng.nextInt(0, 4);
  const beatsPerMeasure = 4;
  const cycleDuration = measures * beatsPerMeasure;
  
  // Generate piano melody (sparse)
  const pianoNotes = generatePianoMelody(scale, baseNote + 12, cycleDuration, density, rng);
  
  // Generate string pad (sustained chords)
  const stringNotes = generateStringPad(chords, cycleDuration, rng);
  
  // Generate shimmer layer (high, sparse)
  const shimmerNotes = generateShimmer(scale, baseNote + 24, cycleDuration, density * 0.5, rng);
  
  return { pianoNotes, stringNotes, shimmerNotes, cycleDuration };
}

function generateChords(scale: Scale, baseNote: number, rng: SeededRNG): number[][] {
  // Simple I - IV or i - VI progression
  const root1 = baseNote;
  const root2 = baseNote + scale.intervals[3]; // Fourth degree
  
  // Build triads with open voicing
  const chord1 = [root1, root1 + scale.intervals[2], root1 + scale.intervals[4]];
  const chord2 = [root2, root2 + scale.intervals[2] - scale.intervals[3] + 12, root2 + scale.intervals[4] - scale.intervals[3] + 12];
  
  return [chord1, chord2];
}

function generatePianoMelody(
  scale: Scale,
  baseNote: number,
  cycleDuration: number,
  density: number,
  rng: SeededRNG
): NoteEvent[] {
  const events: NoteEvent[] = [];
  const noteCount = Math.floor(3 + density * 5); // 3-8 notes
  
  // Weights favoring consonant intervals (root, third, fifth)
  const weights = scale.intervals.map((_, i) => {
    if (i === 0) return 4; // Root
    if (i === 2) return 2.5; // Third
    if (i === 4) return 3; // Fifth
    return 1;
  });
  
  let currentBeat = rng.nextFloat(0.5, 2);
  let lastInterval = 0;
  
  for (let i = 0; i < noteCount && currentBeat < cycleDuration - 2; i++) {
    // Pick note (favor stepwise motion)
    const intervalIdx = rng.weightedPick(
      scale.intervals.map((_, i) => i),
      weights.map((w, idx) => w * (Math.abs(idx - lastInterval) <= 1 ? 2 : 1))
    );
    lastInterval = intervalIdx;
    
    const interval = scale.intervals[intervalIdx];
    const octaveShift = rng.next() < 0.2 ? 12 : 0;
    
    events.push({
      midi: baseNote + interval + octaveShift,
      time: currentBeat,
      duration: rng.nextFloat(1.5, 4),
      velocity: rng.nextInt(45, 75),
    });
    
    // Space between notes
    currentBeat += rng.nextFloat(2, 5);
  }
  
  return events;
}

function generateStringPad(
  chords: number[][],
  cycleDuration: number,
  rng: SeededRNG
): NoteEvent[] {
  const events: NoteEvent[] = [];
  const halfCycle = cycleDuration / 2;
  
  // First chord (first half)
  for (const note of chords[0]) {
    const stagger = rng.nextFloat(0, 0.3);
    events.push({
      midi: note,
      time: stagger,
      duration: halfCycle + rng.nextFloat(0.5, 1.5),
      velocity: rng.nextInt(35, 55),
    });
  }
  
  // Second chord (second half)
  for (const note of chords[1]) {
    const stagger = rng.nextFloat(0, 0.3);
    events.push({
      midi: note,
      time: halfCycle + stagger,
      duration: halfCycle + rng.nextFloat(0.5, 1.5),
      velocity: rng.nextInt(35, 55),
    });
  }
  
  return events;
}

function generateShimmer(
  scale: Scale,
  baseNote: number,
  cycleDuration: number,
  density: number,
  rng: SeededRNG
): NoteEvent[] {
  const events: NoteEvent[] = [];
  const noteCount = Math.floor(1 + density * 3);
  
  let currentBeat = rng.nextFloat(2, 6);
  
  for (let i = 0; i < noteCount && currentBeat < cycleDuration - 3; i++) {
    const interval = rng.pick(scale.intervals);
    
    events.push({
      midi: baseNote + interval,
      time: currentBeat,
      duration: rng.nextFloat(4, 8),
      velocity: rng.nextInt(25, 45), // Very soft
    });
    
    currentBeat += rng.nextFloat(6, 12);
  }
  
  return events;
}

// ============================================================================
// SCHEDULING
// ============================================================================

function schedulePattern(pattern: Pattern, params: StarMusicParams): void {
  if (!state.transport) return;
  
  const { tempo } = params;
  state.transport.bpm.value = tempo;
  
  const beatsToSeconds = (beats: number) => beats * (60 / tempo);
  
  // Schedule piano
  for (const event of pattern.pianoNotes) {
    state.transport.schedule((time: number) => {
      const noteName = midiToNoteName(event.midi);
      state.pianoSynth?.triggerAttackRelease(
        noteName,
        beatsToSeconds(event.duration),
        time,
        event.velocity / 127
      );
    }, beatsToSeconds(event.time));
  }
  
  // Schedule strings
  for (const event of pattern.stringNotes) {
    state.transport.schedule((time: number) => {
      const noteName = midiToNoteName(event.midi);
      state.stringSynth?.triggerAttackRelease(
        noteName,
        beatsToSeconds(event.duration),
        time,
        event.velocity / 127 * 0.7
      );
    }, beatsToSeconds(event.time));
  }
  
  // Schedule shimmer
  for (const event of pattern.shimmerNotes) {
    state.transport.schedule((time: number) => {
      const noteName = midiToNoteName(event.midi);
      state.shimmerSynth?.triggerAttackRelease(
        noteName,
        beatsToSeconds(event.duration),
        time,
        event.velocity / 127 * 0.5
      );
    }, beatsToSeconds(event.time));
  }
  
  // Schedule loop restart
  state.transport.schedule(() => {
    state.loopCount++;
    // Could add evolution logic here
  }, beatsToSeconds(pattern.cycleDuration - 0.1));
  
  // Enable looping
  state.transport.loop = true;
  state.transport.loopEnd = beatsToSeconds(pattern.cycleDuration);
}

function playImmediateChord(params: StarMusicParams): void {
  if (!state.stringSynth) return;
  
  const { scale, baseNote } = params;
  const notes = [
    midiToNoteName(baseNote),
    midiToNoteName(baseNote + scale.intervals[2]),
    midiToNoteName(baseNote + scale.intervals[4]),
  ];
  
  state.stringSynth.triggerAttackRelease(notes, 3, "+0.1", 0.35);
}

// ============================================================================
// UTILITIES
// ============================================================================

function midiToNoteName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const clamped = Math.max(0, Math.min(127, Math.round(midi)));
  const octave = Math.floor(clamped / 12) - 1;
  return `${names[clamped % 12]}${octave}`;
}

// ============================================================================
// CLEANUP
// ============================================================================

export function dispose(): void {
  stopAudio();
  
  [state.pianoSynth, state.stringSynth, state.shimmerSynth,
   state.reverb, state.filter, state.delay, state.masterGain].forEach(node => {
    if (node?.dispose) node.dispose();
  });
  
  state.pianoSynth = null;
  state.stringSynth = null;
  state.shimmerSynth = null;
  state.reverb = null;
  state.filter = null;
  state.delay = null;
  state.masterGain = null;
  state.transport = null;
  state.initialized = false;
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

export { SeededRNG };
export type { StarRecord };
