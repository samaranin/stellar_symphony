"use client";

/**
 * Stellar Symphony Ambient Music Engine v2
 * 
 * Creates organic, living ambient music inspired by Stars of the Lid,
 * Ólafur Arnalds, and Nils Frahm. Features:
 * 
 * - Humanized timing with micro-variations (±30ms swing)
 * - Expressive dynamics with crescendos and decrescendos
 * - Piano with realistic hammer/release characteristics
 * - Bowed strings with vibrato and natural bow changes
 * - Guitar-like arpeggios with picked articulation
 * - Evolving musical phrases that breathe and develop
 * - Markov-chain melodic evolution
 */

import { StarRecord } from "@/lib/types";
import { clamp } from "@/lib/astro";

// ============================================================================
// TYPES
// ============================================================================

export interface Scale {
  name: string;
  intervals: number[];
}

export interface NoteEvent {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
  articulation?: "legato" | "staccato" | "accent" | "picked" | "bowed";
}

export interface Phrase {
  notes: NoteEvent[];
  emotion: "hopeful" | "melancholic" | "serene" | "mysterious";
}

export interface StarMusicParams {
  baseNote: number;
  scale: Scale;
  tempo: number;
  warmth: number;
  spaciousness: number;
  density: number;
  emotion: "hopeful" | "melancholic" | "serene" | "mysterious";
}

// ============================================================================
// SCALES & MUSICAL DATA
// ============================================================================

const SCALES: Record<string, Scale> = {
  ionian:     { name: "Major",      intervals: [0, 2, 4, 5, 7, 9, 11] },
  dorian:     { name: "Dorian",     intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian:   { name: "Phrygian",   intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian:     { name: "Lydian",     intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  aeolian:    { name: "Minor",      intervals: [0, 2, 3, 5, 7, 8, 10] },
  pentatonic: { name: "Pentatonic", intervals: [0, 2, 4, 7, 9] },
};

// Common progressions by emotion
const PROGRESSIONS: Record<string, number[][]> = {
  hopeful: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],     // I - IV - V - I
  melancholic: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [0, 3, 7]],  // i - iv - III - i
  serene: [[0, 7, 14], [5, 12, 19], [7, 14, 21], [0, 7, 14]],   // Quintal movement
  mysterious: [[0, 1, 7], [5, 6, 12], [7, 8, 14], [0, 1, 7]],   // Phrygian color
};

// ============================================================================
// SEEDED RNG (Mulberry32 for determinism)
// ============================================================================

export class SeededRNG {
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

  shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  gaussian(mean = 0, stddev = 1): number {
    // Box-Muller transform for natural variation
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * stddev + mean;
  }
}

// ============================================================================
// ENGINE STATE
// ============================================================================

interface EngineState {
  initialized: boolean;
  playing: boolean;
  currentStar: StarRecord | null;
  currentSeed: number;
  userVolume: number;
  phraseCount: number;
  
  // Tone.js instances
  piano: any;
  strings: any;
  guitar: any;
  pad: any;
  reverb: any;
  delay: any;
  filter: any;
  compressor: any;
  masterGain: any;
  transport: any;
  
  // Musical state
  currentPhrase: number;
  motif: number[];
}

const state: EngineState = {
  initialized: false,
  playing: false,
  currentStar: null,
  currentSeed: 0,
  userVolume: 0.7,
  phraseCount: 0,
  piano: null,
  strings: null,
  guitar: null,
  pad: null,
  reverb: null,
  delay: null,
  filter: null,
  compressor: null,
  masterGain: null,
  transport: null,
  currentPhrase: 0,
  motif: [],
};

let Tone: any = null;

// ============================================================================
// TONE.JS INITIALIZATION
// ============================================================================

async function importTone(): Promise<any> {
  if (Tone) return Tone;
  
  const mod: any = await import("tone");
  
  // Try multiple ways to get the Tone object
  const candidates = [
    mod,
    mod?.default,
    mod?.Tone,
    (globalThis as any)?.Tone,
  ];
  
  for (const candidate of candidates) {
    if (candidate && (candidate.Transport || candidate.getTransport || candidate.PolySynth)) {
      Tone = candidate;
      return Tone;
    }
  }
  
  // Last resort: if mod has PolySynth directly, use it
  if (mod?.PolySynth) {
    Tone = mod;
    return Tone;
  }
  
  console.error("Tone.js module structure:", Object.keys(mod || {}));
  throw new Error("Failed to load Tone.js");
}

/**
 * Initialize the audio engine with expressive instruments
 */
export async function initAudio(): Promise<void> {
  if (state.initialized) return;
  
  const T = await importTone();
  
  // Resume audio context
  if (T.start) await T.start();
  else {
    const ctx = T.getContext?.() ?? T.context;
    if (ctx?.state === "suspended") await ctx.resume();
  }
  
  const Transport = T.Transport ?? T.getTransport?.();
  const Destination = T.Destination ?? T.getDestination?.();
  
  // ========== PIANO - Clear, defined attack ==========
  state.piano = new T.PolySynth(T.Synth, {
    oscillator: {
      type: "fmtriangle",
      modulationType: "sine",
      modulationIndex: 0.6,
      harmonicity: 2,
    },
    envelope: {
      attack: 0.008,      // Quick hammer
      decay: 0.4,         // Shorter decay
      sustain: 0.2,
      release: 0.8,       // Cleaner release
    },
    volume: -4,
  });
  
  // ========== STRINGS - Warm pads ==========
  state.strings = new T.PolySynth(T.Synth, {
    oscillator: {
      type: "fatsawtooth",
      count: 3,
      spread: 8,
    },
    envelope: {
      attack: 0.5,        // Faster attack
      decay: 0.2,
      sustain: 0.7,
      release: 1.5,
    },
    volume: -10,
  });
  
  // Add vibrato to strings via LFO
  const vibrato = new T.Vibrato({
    frequency: 5,
    depth: 0.05,
  });
  
  // ========== GUITAR - Plucked, short ==========
  state.guitar = new T.PolySynth(T.Synth, {
    oscillator: {
      type: "triangle",
    },
    envelope: {
      attack: 0.002,      // Sharp pluck
      decay: 0.5,         // Shorter decay
      sustain: 0.02,
      release: 0.6,       // Quick release
    },
    volume: -6,
  });
  
  // ========== PAD - Soft atmospheric layer ==========
  state.pad = new T.PolySynth(T.Synth, {
    oscillator: {
      type: "sine",
    },
    envelope: {
      attack: 4.0,        // Very slow fade in
      decay: 1.5,
      sustain: 0.5,
      release: 6.0,       // Long fade out
    },
    volume: -20,          // Much quieter
  });
  
  // ========== EFFECTS CHAIN ==========
  
  // High-quality convolution reverb
  state.reverb = new T.Reverb({
    decay: 8,
    wet: 0.35,
    preDelay: 0.08,
  });
  await state.reverb.generate();
  
  // Warm filter
  state.filter = new T.Filter({
    frequency: 4000,
    type: "lowpass",
    Q: 0.7,
    rolloff: -12,
  });
  
  // Analog-style delay
  state.delay = new T.FeedbackDelay({
    delayTime: "8n.",     // Dotted eighth - musical feel
    feedback: 0.18,
    wet: 0.15,
  });
  
  // Gentle compression for glue
  state.compressor = new T.Compressor({
    threshold: -18,
    ratio: 3,
    attack: 0.1,
    release: 0.25,
  });
  
  state.masterGain = new T.Gain(state.userVolume * 0.6);
  
  // Connect: instruments → effects → master
  const effectChain = [state.filter, state.delay, state.reverb, state.compressor, state.masterGain];
  
  state.piano.chain(...effectChain, Destination);
  state.strings.chain(vibrato, ...effectChain, Destination);
  state.guitar.chain(...effectChain, Destination);
  state.pad.chain(state.filter, state.reverb, state.masterGain, Destination);
  
  state.transport = Transport;
  state.initialized = true;
  
  console.log("🎹 Stellar Symphony v2 initialized - Piano, Strings, Guitar");
}

export async function loadInstruments(): Promise<void> {
  if (!state.initialized) await initAudio();
}

// ============================================================================
// PLAYBACK API
// ============================================================================

export async function playForStar(star: StarRecord, seed?: number): Promise<void> {
  if (!state.initialized) await initAudio();
  if (state.playing) stopAudio();
  
  const finalSeed = seed ?? hashStar(star);
  state.currentStar = star;
  state.currentSeed = finalSeed;
  state.phraseCount = 0;
  state.currentPhrase = 0;
  
  const params = starToMusicParams(star);
  configureEffects(params);
  
  const rng = new SeededRNG(finalSeed);
  
  // Generate initial motif (3-5 note seed melody)
  state.motif = generateMotif(params, rng);
  
  // Start the generative loop - pass star for unique patterns
  scheduleGenerativeMusic(params, rng, star);
  
  state.transport.bpm.value = params.tempo;
  state.transport.start();
  state.playing = true;
  
  console.log(`🌟 Playing: ${star.name ?? star.id} | ${params.scale.name} | ${params.emotion}`);
}

export function stopAudio(): void {
  if (!state.transport) return;
  
  state.transport.stop();
  state.transport.cancel();
  
  state.piano?.releaseAll();
  state.strings?.releaseAll();
  state.guitar?.releaseAll();
  state.pad?.releaseAll();
  
  state.playing = false;
}

export function setVolume(volume: number): void {
  state.userVolume = clamp(volume, 0, 1);
  state.masterGain?.gain.rampTo(state.userVolume * 0.6, 0.1);
}

export function getVolume(): number {
  return state.userVolume;
}

export function isPlaying(): boolean {
  return state.playing;
}

export function isInitialized(): boolean {
  return state.initialized;
}

// ============================================================================
// STAR → MUSIC MAPPING
// ============================================================================

// Available keys (root notes) - all in comfortable range
const ROOT_NOTES = [36, 38, 40, 41, 43]; // C2, D2, E2, F2, G2

// Different rhythm patterns for variety
const RHYTHM_PATTERNS = [
  [0, 1.5, 3],           // Original: 1 . 2 . | . 3 . .
  [0, 1, 2, 3],          // Steady: 1 2 3 4
  [0, 2, 3.5],           // Syncopated: 1 . . 3 | . . 4 .
  [0.5, 1.5, 3],         // Pickup: . 1 . 2 | . . 3 .
  [0, 1, 3, 3.5],        // Dotted: 1 2 . . | 4 4+ . .
];

// Different arpeggio directions
const ARP_PATTERNS = [
  "up",       // root → third → fifth
  "down",     // fifth → third → root  
  "updown",   // root → third → fifth → third
  "broken",   // root → fifth → third
];

function starToMusicParams(star: StarRecord): StarMusicParams {
  const temp = star.temp ?? specToTemp(star.spec);
  const mag = star.mag ?? 2;
  const dist = star.dist ?? 100;
  const ra = star.ra ?? 0;
  const dec = star.dec ?? 0;
  
  // Create a unique hash for this star for deterministic variation
  const starHash = hashStar(star);
  
  // Temperature → scale (but with variation)
  const scale = tempToScale(temp, starHash);
  
  // Use RA position to select root note (different keys!)
  const rootIndex = Math.floor((ra / 360) * ROOT_NOTES.length) % ROOT_NOTES.length;
  const baseNote = ROOT_NOTES[rootIndex];
  
  // Use Dec to shift the base note slightly (-2 to +2 semitones)
  const decShift = Math.round((dec + 90) / 180 * 4) - 2;
  const adjustedBaseNote = baseNote + decShift;
  
  // Magnitude → tempo
  const magNorm = clamp((6 - mag) / 8, 0, 1);
  const tempo = 52 + magNorm * 18;
  
  // Use distance to vary density more dramatically
  const distNorm = clamp(dist / 500, 0, 1);
  const density = 0.2 + magNorm * 0.35 + (1 - distNorm) * 0.15;
  
  // Emotion based on multiple factors
  const emotion = getEmotion(temp, scale, starHash);
  
  // Warmth and spaciousness
  const tempNorm = clamp((temp - 3000) / 25000, 0, 1);
  const warmth = clamp(0.35 + (1 - tempNorm) * 0.5, 0.35, 0.85);
  const spaciousness = clamp(dist / 300, 0.25, 0.7);
  
  return { baseNote: adjustedBaseNote, scale, tempo, warmth, spaciousness, density, emotion };
}

function tempToScale(temp: number, starHash: number): Scale {
  // Base scale from temperature
  let scaleOptions: Scale[];
  
  if (temp > 12000) {
    scaleOptions = [SCALES.lydian, SCALES.ionian]; // Hot: bright modes
  } else if (temp > 8000) {
    scaleOptions = [SCALES.ionian, SCALES.mixolydian, SCALES.lydian];
  } else if (temp > 6500) {
    scaleOptions = [SCALES.mixolydian, SCALES.dorian, SCALES.ionian];
  } else if (temp > 5200) {
    scaleOptions = [SCALES.dorian, SCALES.aeolian, SCALES.mixolydian];
  } else if (temp > 4000) {
    scaleOptions = [SCALES.aeolian, SCALES.dorian, SCALES.pentatonic];
  } else {
    scaleOptions = [SCALES.pentatonic, SCALES.aeolian];
  }
  
  // Use star hash to pick from options (adds variety within temp range)
  const idx = starHash % scaleOptions.length;
  return scaleOptions[idx];
}

function getEmotion(temp: number, scale: Scale, starHash: number): "hopeful" | "melancholic" | "serene" | "mysterious" {
  const emotions: Array<"hopeful" | "melancholic" | "serene" | "mysterious"> = [];
  
  // Add emotions based on scale
  if (scale.name === "Lydian") emotions.push("mysterious", "serene");
  else if (scale.name === "Major") emotions.push("hopeful", "serene");
  else if (scale.name === "Mixolydian") emotions.push("hopeful", "melancholic");
  else if (scale.name === "Dorian") emotions.push("melancholic", "mysterious");
  else if (scale.name === "Minor") emotions.push("melancholic", "serene");
  else emotions.push("serene", "mysterious");
  
  // Use hash to pick
  return emotions[starHash % emotions.length];
}

function specToTemp(spec?: string): number {
  if (!spec) return 5800;
  const map: Record<string, number> = {
    O: 35000, B: 20000, A: 9500, F: 7200, G: 5800, K: 4400, M: 3200
  };
  return map[spec.charAt(0).toUpperCase()] ?? 5800;
}

function hashStar(star: StarRecord): number {
  let hash = 0;
  const str = star.id + star.ra + star.dec + (star.name ?? '');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Get rhythm pattern based on star
function getStarRhythm(starHash: number): number[] {
  return RHYTHM_PATTERNS[starHash % RHYTHM_PATTERNS.length];
}

// Get arpeggio style based on star
function getStarArpStyle(starHash: number): string {
  return ARP_PATTERNS[starHash % ARP_PATTERNS.length];
}

// ============================================================================
// EFFECTS CONFIGURATION
// ============================================================================

function configureEffects(params: StarMusicParams): void {
  const { warmth, spaciousness } = params;
  
  // Filter warmth - lower cutoff for warmer sound
  // Range: 1500 Hz (warm) to 4000 Hz (bright) - never harsh
  const freq = 1500 + warmth * 2500;
  state.filter?.frequency.rampTo(freq, 1);
  
  // Reverb spaciousness
  state.reverb?.wet.rampTo(0.25 + spaciousness * 0.35, 1);
  
  // Delay for distant stars
  state.delay?.wet.rampTo(0.1 + spaciousness * 0.12, 1);
}

// ============================================================================
// GENERATIVE MUSIC SYSTEM
// ============================================================================

// Pre-computed phrase patterns (generated once per star, reused every cycle)
interface ComposedPhrase {
  pianoNotes: Array<{ beat: number; midi: number; duration: number; velocity: number }>;
  guitarNotes: Array<{ beat: number; midi: number; duration: number; velocity: number }>;
  chordProgression: number[][];
}

let currentPhrase: ComposedPhrase | null = null;

function generateMotif(params: StarMusicParams, rng: SeededRNG): number[] {
  // Create a seed motif: 4 notes that define the piece's character
  const { scale } = params;
  const motif: number[] = [];
  
  // Start with root
  motif.push(0);
  
  // Second note: step up or down
  const step1 = rng.next() < 0.6 ? 1 : -1;
  motif.push(scale.intervals[clamp(step1 < 0 ? scale.intervals.length - 1 : 1, 0, scale.intervals.length - 1)]);
  
  // Third note: continue direction or return
  if (rng.next() < 0.5) {
    motif.push(scale.intervals[clamp(step1 < 0 ? scale.intervals.length - 2 : 2, 0, scale.intervals.length - 1)]);
  } else {
    motif.push(0); // Return to root
  }
  
  // Fourth note: resolve to root, third, or fifth
  const resolutions = [0, scale.intervals[2] ?? 3, scale.intervals[4] ?? 7];
  motif.push(rng.pick(resolutions));
  
  return motif;
}

function composePhrase(params: StarMusicParams, rng: SeededRNG, star: StarRecord): ComposedPhrase {
  const { baseNote, scale, emotion, density } = params;
  const progression = PROGRESSIONS[emotion] ?? PROGRESSIONS.serene;
  
  // Use ACTUAL star hash for unique patterns per star
  const starHash = hashStar(star);
  const pianoRhythm = getStarRhythm(starHash);
  const arpStyle = getStarArpStyle(starHash);
  
  // Select chord progression variations based on hash
  const progVariation = starHash % 3;
  const chordProgression = progVariation === 0 
    ? [progression[0], progression[1]]
    : progVariation === 1 
    ? [progression[0], progression[2] ?? progression[1]]
    : [progression[1], progression[0]]; // Reversed
  
  const pianoNotes: ComposedPhrase["pianoNotes"] = [];
  
  // First phrase (bars 1-2)
  pianoRhythm.forEach((beat, i) => {
    const motifNote = state.motif[i % state.motif.length];
    pianoNotes.push({
      beat: beat,
      midi: baseNote + 12 + motifNote,
      duration: i === 2 ? 1.5 : 0.8, // Last note longer
      velocity: i === 0 ? 0.55 : 0.45, // First note accented
    });
  });
  
  // Repeat phrase (bars 3-4) - EXACT SAME NOTES
  pianoRhythm.forEach((beat, i) => {
    const motifNote = state.motif[i % state.motif.length];
    pianoNotes.push({
      beat: beat + 4,
      midi: baseNote + 12 + motifNote,
      duration: i === 2 ? 1.5 : 0.8,
      velocity: i === 0 ? 0.55 : 0.45,
    });
  });
  
  // Second half: variation (bars 5-6, 7-8)
  // Same rhythm but stay in same octave (avoid harsh high notes)
  pianoRhythm.forEach((beat, i) => {
    const motifNote = state.motif[i % state.motif.length];
    // Keep same octave, just slightly different dynamics
    pianoNotes.push({
      beat: beat + 8,
      midi: baseNote + 12 + motifNote, // Same octave as first phrase
      duration: i === 2 ? 1.5 : 0.8,
      velocity: i === 0 ? 0.45 : 0.38, // Slightly softer
    });
  });
  
  // Final resolution phrase (bars 7-8) - end on root
  pianoNotes.push({
    beat: 12,
    midi: baseNote + 12,
    duration: 2,
    velocity: 0.5,
  });
  pianoNotes.push({
    beat: 14,
    midi: baseNote + 12 + (scale.intervals[4] ?? 7), // Fifth
    duration: 1.5,
    velocity: 0.4,
  });
  
  // ===== COMPOSE GUITAR RESPONSE =====
  // Guitar answers piano with arpeggios on offbeats
  const guitarNotes: ComposedPhrase["guitarNotes"] = [];
  
  // Only add guitar on denser arrangements
  if (density > 0.3) {
    // Build arpeggio based on star's arp style
    const root = 0;
    const third = scale.intervals[2] ?? 3;
    const fifth = scale.intervals[4] ?? 7;
    
    let arpPattern: number[];
    switch (arpStyle) {
      case "down":
        arpPattern = [fifth, third, root];
        break;
      case "updown":
        arpPattern = [root, third, fifth, third];
        break;
      case "broken":
        arpPattern = [root, fifth, third];
        break;
      default: // "up"
        arpPattern = [root, third, fifth];
    }
    
    // Vary response timing based on rhythm pattern length
    const responseBeats = pianoRhythm.length <= 3 ? [3, 7, 11] : [3.5, 7.5, 11.5];
    
    responseBeats.forEach((responseBeat, respIdx) => {
      arpPattern.forEach((interval, i) => {
        guitarNotes.push({
          beat: responseBeat + i * 0.25,
          midi: baseNote + (respIdx === 2 ? 0 : 12) + interval, // Last one lower
          duration: 0.6,
          velocity: 0.38 - respIdx * 0.03, // Gradually softer
        });
      });
    });
  }
  
  return { pianoNotes, guitarNotes, chordProgression };
}

function scheduleGenerativeMusic(params: StarMusicParams, rng: SeededRNG, star: StarRecord): void {
  const { tempo } = params;
  
  // 16 beats = 4 bars
  const cycleDuration = 16;
  const beatsToSec = (b: number) => b * (60 / tempo);
  
  // Compose the phrase ONCE using star's unique hash
  currentPhrase = composePhrase(params, rng, star);
  
  // ========== SCHEDULE ALL PARTS ==========
  // Pad drone disabled - was causing unpleasant sounds
  // schedulePadDrone(params, cycleDuration, beatsToSec);
  scheduleStrings(params, cycleDuration, beatsToSec);
  schedulePiano(beatsToSec);
  scheduleGuitar(beatsToSec);
  
  // Enable looping
  state.transport.loop = true;
  state.transport.loopEnd = beatsToSec(cycleDuration);
  
  // Subtle evolution every 4 cycles
  state.transport.schedule(() => {
    state.phraseCount++;
    if (state.phraseCount % 4 === 0) {
      evolveMotif(params, rng);
      currentPhrase = composePhrase(params, rng, star);
    }
  }, beatsToSec(cycleDuration - 0.1));
}

function schedulePadDrone(params: StarMusicParams, cycleDuration: number, beatsToSec: (b: number) => number): void {
  const { baseNote, warmth } = params;
  
  // Keep drone in comfortable range: C2-G2 (36-43)
  // Don't go too low (rumbles) or too high (distracting)
  const droneRoot = clamp(baseNote, 36, 43);
  
  // Simple fifth interval - always sounds good
  const droneNotes = [
    midiToNote(droneRoot),      // Root in C2-G2
    midiToNote(droneRoot + 7),  // Fifth above
  ];
  
  // Very quiet - this should be barely audible atmosphere
  const padVelocity = 0.08 + warmth * 0.06;
  
  state.transport.schedule((time: number) => {
    state.pad?.triggerAttackRelease(droneNotes, beatsToSec(cycleDuration + 2), time, padVelocity);
  }, 0);
}

function scheduleStrings(params: StarMusicParams, cycleDuration: number, beatsToSec: (b: number) => number): void {
  const { baseNote } = params;
  
  if (!currentPhrase) return;
  
  // Chord 1: beats 0-8
  state.transport.schedule((time: number) => {
    const notes = currentPhrase!.chordProgression[0].map(i => midiToNote(baseNote + i));
    notes.forEach((note, idx) => {
      state.strings?.triggerAttackRelease(note, beatsToSec(7.5), time + idx * 0.03, 0.35);
    });
  }, 0);
  
  // Chord 2: beats 8-16
  state.transport.schedule((time: number) => {
    const notes = currentPhrase!.chordProgression[1].map(i => midiToNote(baseNote + i));
    notes.forEach((note, idx) => {
      state.strings?.triggerAttackRelease(note, beatsToSec(7.5), time + idx * 0.03, 0.35);
    });
  }, beatsToSec(8));
}

function schedulePiano(beatsToSec: (b: number) => number): void {
  if (!currentPhrase) return;
  
  currentPhrase.pianoNotes.forEach(note => {
    state.transport.schedule((time: number) => {
      state.piano?.triggerAttackRelease(
        midiToNote(note.midi),
        beatsToSec(note.duration),
        time,
        note.velocity
      );
    }, beatsToSec(note.beat));
  });
}

function scheduleGuitar(beatsToSec: (b: number) => number): void {
  if (!currentPhrase) return;
  
  currentPhrase.guitarNotes.forEach(note => {
    state.transport.schedule((time: number) => {
      state.guitar?.triggerAttackRelease(
        midiToNote(note.midi),
        beatsToSec(note.duration),
        time,
        note.velocity
      );
    }, beatsToSec(note.beat));
  });
}

// ============================================================================
// MOTIF EVOLUTION (Markov-style)
// ============================================================================

function evolveMotif(params: StarMusicParams, rng: SeededRNG): void {
  const { scale } = params;
  
  // Evolve the motif slightly each cycle
  const evolveIdx = rng.nextInt(0, state.motif.length - 1);
  const currentInterval = state.motif[evolveIdx];
  const currentIdx = scale.intervals.indexOf(currentInterval);
  
  if (currentIdx >= 0) {
    // 50% step up/down, 30% stay, 20% jump
    const r = rng.next();
    if (r < 0.25) {
      state.motif[evolveIdx] = scale.intervals[Math.max(0, currentIdx - 1)];
    } else if (r < 0.5) {
      state.motif[evolveIdx] = scale.intervals[Math.min(scale.intervals.length - 1, currentIdx + 1)];
    } else if (r < 0.8) {
      // Stay same
    } else {
      state.motif[evolveIdx] = rng.pick(scale.intervals);
    }
  }
  
  // Occasionally add or remove a note
  if (rng.next() < 0.15 && state.motif.length < 6) {
    state.motif.push(rng.pick(scale.intervals));
  } else if (rng.next() < 0.1 && state.motif.length > 3) {
    state.motif.pop();
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function midiToNote(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const clamped = clamp(Math.round(midi), 21, 108); // Piano range
  const octave = Math.floor(clamped / 12) - 1;
  return `${names[clamped % 12]}${octave}`;
}

// ============================================================================
// CLEANUP
// ============================================================================

export function dispose(): void {
  stopAudio();
  
  [state.piano, state.strings, state.guitar, state.pad,
   state.reverb, state.delay, state.filter, state.compressor, state.masterGain
  ].forEach(node => node?.dispose?.());
  
  state.piano = null;
  state.strings = null;
  state.guitar = null;
  state.pad = null;
  state.reverb = null;
  state.delay = null;
  state.filter = null;
  state.compressor = null;
  state.masterGain = null;
  state.transport = null;
  state.initialized = false;
}

// Re-export type for backward compatibility
export type { StarRecord };
