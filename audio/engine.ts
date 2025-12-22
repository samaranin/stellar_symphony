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
  noteOffset?: number; // octave offset applied when composing phrases
  paletteName?: string;
  harmonyShift?: number;
  fastNoteOffset?: number; // offset used for fast / plucked notes (guitar, quick arps)
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

// Human-pleasing chord palettes (voicings). Each palette is a list of voicings
// (intervals relative to chord root) that are known to sound pleasant together.
// We'll use these as base voicings and apply small per-star shifts.
const CHORD_PALETTES: Record<string, number[][]> = {
  warm: [
    [0, 4, 7, 11],    // add major 7 - lush
    [0, 3, 7, 10],    // minor7
    [0, 5, 9, 12],    // suspended-add9
  ],
  airy: [
    [0, 7, 12, 16],   // open fifth + octave + ninth
    [0, 4, 9, 14],    // add9 voicing
    [0, 2, 7, 11],    // sus2 + maj7
  ],
  consonant: [
    [0, 4, 7],        // basic triad
    [0, 3, 7],        // minor triad
    [0, 7, 12],       // power/spacey
  ],
  modern: [
    [0, 4, 7, 14],    // add9 extension
    [0, 3, 7, 13],    // minor add9
    [0, 5, 7, 12],    // quartal-ish
  ],
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
  padHP: any;
  reverb: any;
  delay: any;
  filter: any;
  compressor: any;
  masterGain: any;
  transport: any;
  loopId?: any;
  
  // Musical state
  currentPhrase: number;
  motif: number[];
}

const state: EngineState = {
  initialized: false,
  playing: false,
  currentStar: null,
  currentSeed: 0,
  userVolume: 0.2,
  phraseCount: 0,
  piano: null,
  strings: null,
  guitar: null,
  pad: null,
  padHP: null,
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
  // Softer, more pleasing piano-like synth (less aggressive harmonics)
  state.piano = new T.PolySynth(T.Synth, {
    oscillator: {
      type: "triangle",
    },
    envelope: {
      attack: 0.01,
      decay: 0.6,
      sustain: 0.35,
      release: 1.2,
    },
    volume: -8,
  });
  
  // ========== STRINGS - Warm pads ==========
  state.strings = new T.PolySynth(T.Synth, {
    oscillator: {
      type: "fatsawtooth",
      count: 3,
      spread: 6,
    },
    envelope: {
      attack: 0.8,
      decay: 0.6,
      sustain: 0.7,
      release: 2.2,
    },
    volume: -12,
  });
  
  // Add gentler vibrato to strings via LFO
  const vibrato = new T.Vibrato({
    frequency: 4.5,
    depth: 0.025,
  });
  
  // ========== GUITAR - Plucked, short ==========
  state.guitar = new T.PolySynth(T.Synth, {
    oscillator: {
      type: "triangle",
    },
    envelope: {
      attack: 0.004,
      decay: 0.45,
      sustain: 0.06,
      release: 0.9,
    },
    volume: -8,
  });
  
  // ========== PAD - Soft atmospheric layer ==========
  state.pad = new T.PolySynth(T.Synth, {
    oscillator: {
      type: "sine",
    },
    envelope: {
      attack: 4.0,
      decay: 1.5,
      sustain: 0.45,
      release: 6.0,
    },
    volume: -22,
  });

  // Pad high-pass to remove subsonic rumble (keeps background from being too low)
  state.padHP = new T.Filter({
    type: "highpass",
    frequency: 40,
    Q: 0.7,
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
  
  // Master gain follows the user volume directly (20% default)
  state.masterGain = new T.Gain(state.userVolume);
  
  // Connect: instruments → effects → master
  const effectChain = [state.filter, state.delay, state.reverb, state.compressor, state.masterGain];
  
  state.piano.chain(...effectChain, Destination);
  state.strings.chain(vibrato, ...effectChain, Destination);
  state.guitar.chain(...effectChain, Destination);
  // Pad goes through a high-pass first to avoid very low rumble, then the shared effect chain
  state.pad.chain(state.padHP, state.filter, state.reverb, state.masterGain, Destination);
  
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
  if (state.loopId) {
    try { state.transport.clear(state.loopId); } catch (e) {}
    state.loopId = undefined;
  }
  
  state.piano?.releaseAll();
  state.strings?.releaseAll();
  state.guitar?.releaseAll();
  state.pad?.releaseAll();
  
  state.playing = false;
}

export function setVolume(volume: number): void {
  state.userVolume = clamp(volume, 0, 1);
  // Ramp the master gain to the user volume (we use direct mapping)
  state.masterGain?.gain.rampTo(state.userVolume, 0.1);
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

// Fast-note rhythm variants (subdivisions within a response slot) to add variety
const FAST_RHYTHMS: number[][] = [
  [0, 0.25, 0.5],          // quick triplet-like
  [0, 0.5],               // duo
  [0, 0.166, 0.333, 0.5], // sextuplet-ish spread
  [0, 0.3, 0.6],          // syncopated
  [0, 0.125, 0.25],       // very quick double
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
  // For very hot or luminous stars, keep the base musical material lower to avoid piercing highs
  const noteOffset = temp > 15000 ? 0 : 12;
  // But for fast, agile voices (plucks/arps) we want a higher octave for hot stars
  const fastNoteOffset = temp > 15000 ? 12 : noteOffset;
  
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
  
  // Choose a pleasing chord palette based on temperature/emotion/hash
  const paletteKeys = Object.keys(CHORD_PALETTES);
  const paletteName = paletteKeys[starHash % paletteKeys.length] ?? paletteKeys[0];

  // Small harmony shift (-1, 0, +1 semitone) derived deterministically from hash
  const harmonyShift = (starHash % 3) - 1;

  return { baseNote: adjustedBaseNote, scale, tempo, warmth, spaciousness, density, emotion, noteOffset, paletteName, harmonyShift, fastNoteOffset };
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

// Build a voiced chord progression from a base progression and a palette.
function buildVoicedProgression(progression: number[][], paletteName: string | undefined, starHash: number, harmonyShift = 0): number[][] {
  const palette = CHORD_PALETTES[paletteName ?? Object.keys(CHORD_PALETTES)[0]] ?? CHORD_PALETTES.consonant;
  const voiced: number[][] = [];

  progression.forEach((chord, idx) => {
    const chordRoot = chord[0] ?? 0;
    const voicing = palette[(starHash + idx) % palette.length];
    // Map voicing intervals onto the chord root and apply small harmony shift
    const voicedChord = voicing.map(i => chordRoot + i + harmonyShift);
    voiced.push(voicedChord);
  });

  return voiced;
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
  guitarNotes: Array<{ beat: number; midi: number; duration: number; velocity: number; jitter?: number }>;
  chordProgression: number[][];
}

let currentPhrase: ComposedPhrase | null = null;

function generateMotif(params: StarMusicParams, rng: SeededRNG): number[] {
  // Create a seed motif: 4 notes that define the piece's character
  const { scale } = params;
  const motif: number[] = [];
  
  // Start with root
  motif.push(0);
  
  // Second note: choose a nearby scale degree (avoid large jumps)
  const maxDegree = Math.min(4, scale.intervals.length - 1);
  const secondIdx = rng.nextInt(1, Math.max(1, maxDegree));
  motif.push(scale.intervals[secondIdx]);

  // Third note: usually move by a step near the second note, or return to root
  if (rng.next() < 0.6) {
    const dir = rng.next() < 0.6 ? 1 : -1;
    const thirdIdx = clamp(secondIdx + dir, 0, maxDegree);
    motif.push(scale.intervals[thirdIdx]);
  } else {
    motif.push(0);
  }

  // Fourth note: gentle resolution (root, nearby third, or stable fifth)
  const commonFifth = scale.intervals[Math.min(4, scale.intervals.length - 1)] ?? 7;
  const resolutions = [0, motif[1], commonFifth];
  motif.push(rng.pick(resolutions));
  
  return motif;
}

function composePhrase(params: StarMusicParams, rng: SeededRNG, star: StarRecord): ComposedPhrase {
  const { baseNote, scale, emotion, density, noteOffset = 12, paletteName = "consonant", harmonyShift = 0 } = params;
  const progression = PROGRESSIONS[emotion] ?? PROGRESSIONS.serene;

  // Use ACTUAL star hash for unique patterns per star
  const starHash = hashStar(star);
  const pianoRhythm = getStarRhythm(starHash);
  const arpStyle = getStarArpStyle(starHash);

  // Build voiced chord progression from palette
  const chordProgression = buildVoicedProgression(progression, paletteName, starHash, harmonyShift);
  
  const pianoNotes: ComposedPhrase["pianoNotes"] = [];
  
  // First phrase (bars 1-2)
  pianoRhythm.forEach((beat, i) => {
    const motifNote = state.motif[i % state.motif.length];
    pianoNotes.push({
      beat: beat,
      midi: baseNote + noteOffset + motifNote + harmonyShift,
      duration: i === 2 ? 1.5 : 0.8, // Last note longer
      velocity: i === 0 ? 0.55 : 0.45, // First note accented
    });
  });
  
  // Repeat phrase (bars 3-4) - EXACT SAME NOTES
  pianoRhythm.forEach((beat, i) => {
    const motifNote = state.motif[i % state.motif.length];
    pianoNotes.push({
      beat: beat + 4,
      midi: baseNote + noteOffset + motifNote + harmonyShift,
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
      midi: baseNote + noteOffset + motifNote + harmonyShift, // Same octave as first phrase
      duration: i === 2 ? 1.5 : 0.8,
      velocity: i === 0 ? 0.45 : 0.38, // Slightly softer
    });
  });
  
  // Final resolution phrase (bars 7-8) - end on root
  pianoNotes.push({
    beat: 12,
    midi: baseNote + noteOffset + harmonyShift,
    duration: 2,
    velocity: 0.5,
  });
  pianoNotes.push({
    beat: 14,
    midi: baseNote + noteOffset + (scale.intervals[4] ?? 7) + harmonyShift, // Fifth
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
    
    // Choose a fast rhythm variant and small deterministic inversion/rotation for variety
    const fastRhythm = rng.pick(FAST_RHYTHMS);
    const startRot = rng.nextInt(0, Math.max(0, arpPattern.length - 1));
    const octaveJump = rng.next() < 0.25; // occasional octave jump

    responseBeats.forEach((responseBeat, respIdx) => {
      // pick a rhythm pattern variant for this response slot
      const pattern = fastRhythm.map(v => v + (respIdx * 0.03 * (rng.next() - 0.5)));
      pattern.forEach((subOffset, j) => {
        const idx = (startRot + j) % arpPattern.length;
        let interval = arpPattern[idx];
        // optionally octave-shift every other note for sparkle
        if (octaveJump && j % 2 === 1) interval += 12;
        const jitter = Math.max(-0.04, Math.min(0.04, rng.gaussian(0, 0.015)));
        guitarNotes.push({
          beat: responseBeat + subOffset,
          midi: baseNote + (respIdx === 2 ? 0 : (params.fastNoteOffset ?? noteOffset)) + interval + harmonyShift, // Last one lower
          duration: 0.28,
          velocity: clamp(0.38 - respIdx * 0.03 + rng.gaussian(0, 0.03), 0.2, 0.6),
          jitter: jitter,
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
  // Schedule pad drone with per-star safeguards
  schedulePadDrone(params, cycleDuration, beatsToSec, star);
  scheduleStrings(params, cycleDuration, beatsToSec, star);

  // Centralized lightweight scheduler: runs every 16th note and triggers
  // piano + fast guitar notes within a small lookahead window. This reduces
  // per-note `transport.schedule` calls which can cause stuttering under load.
  if (state.loopId) {
    try { state.transport.clear(state.loopId); } catch (e) {}
    state.loopId = undefined;
  }

  const tickNotation = "16n"; // run every 16th note
  state.loopId = state.transport.scheduleRepeat((time: number) => {
    // time is the scheduled callback time in seconds
    // compute current beat (absolute) at this time
    const beatNow = (time * params.tempo) / 60;
    const cycleBeat = beatNow % cycleDuration;
    const lookaheadBeats = 0.26; // slightly larger than 16th to be safe

    const triggerNote = (note: { beat: number; midi: number; duration: number; velocity: number; jitter?: number }) => {
      // compute delta in beats from current cycle position
      let delta = ((note.beat - cycleBeat) + cycleDuration) % cycleDuration;
      if (delta < lookaheadBeats) {
        const eventTime = time + delta * (60 / params.tempo) + (note.jitter ?? 0);
        state.piano?.triggerAttackRelease(midiToNote(note.midi), note.duration * (60 / params.tempo), eventTime, note.velocity);
      }
    };

    // Trigger piano notes
    if (currentPhrase) {
      for (let i = 0; i < currentPhrase.pianoNotes.length; i++) {
        triggerNote(currentPhrase.pianoNotes[i] as any);
      }
      // Trigger fast guitar/arpeggio notes
      for (let i = 0; i < currentPhrase.guitarNotes.length; i++) {
        triggerNote(currentPhrase.guitarNotes[i] as any);
      }
    }
  }, tickNotation);
  
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

function schedulePadDrone(params: StarMusicParams, cycleDuration: number, beatsToSec: (b: number) => number, star: StarRecord): void {
  const { baseNote, warmth } = params;

  // Keep drone in comfortable range: C2-G2 (36-43)
  let droneRoot = clamp(baseNote, 36, 43);

  // Avoid very low background drones that become rumble — raise to at least MIDI 40
  if (droneRoot < 40) droneRoot += 12; // raise an octave if too low

  // For very hot or very distant stars we prefer an octave drone (root + octave)
  // which is less harmonically bright than a perfect fifth stack.
  const isHot = (star.temp ?? specToTemp(star.spec)) > 15000;
  const isDistant = (star.dist ?? 0) > 1500;

  const droneIntervals = isHot || isDistant ? [0, 12] : [0, 7];
  const droneNotes = droneIntervals.map(i => midiToNote(droneRoot + i));

  // Keep drone very quiet and slightly lower for hot/distant stars
  let padVelocity = 0.06 + warmth * 0.05;
  if (isHot) padVelocity *= 0.6;
  if (isDistant) padVelocity *= 0.75;

  // Shorten pad duration for very bright / nearby stars, but do NOT lower the level.
  // Instead we will gently reduce the global filter cutoff during the pad so
  // the sustain sounds less piercing without reducing loudness.
  const mag = star.mag ?? 2;
  const magNorm = clamp((6 - mag) / 8, 0, 1);
  const rawPadBeats = (cycleDuration + 2) * (1 - magNorm * 0.45);
  const padBeats = clamp(rawPadBeats, 4, cycleDuration + 2);

  // Slightly lower the global filter cutoff for hot stars to reduce piercing harmonics
  if (isHot) {
    const lowCut = 1200; // Hz
    state.filter?.frequency.rampTo(Math.min((state.filter?.frequency?.value ?? 4000), lowCut), 0.8);
    state.reverb?.wet.rampTo(0.22, 0.8);
  }

  // For very bright stars, temporarily lower the master lowpass cutoff to
  // make long pad sustains less sharp. We'll restore it after the pad duration.
  const baseFilterFreq = 1500 + warmth * 2500; // same formula as configureEffects
  if (magNorm > 0.45) {
    const reduceBy = Math.min(1200, magNorm * 1800);
    const targetLow = Math.max(600, baseFilterFreq - reduceBy);
    state.filter?.frequency.rampTo(targetLow, 0.9);
    // schedule restore after the pad ends
    state.transport.schedule((t: number) => {
      state.filter?.frequency.rampTo(baseFilterFreq, 1.2);
    }, beatsToSec(padBeats));
  }

  state.transport.schedule((time: number) => {
    state.pad?.triggerAttackRelease(droneNotes, beatsToSec(padBeats), time, padVelocity);
  }, 0);
}

function scheduleStrings(params: StarMusicParams, cycleDuration: number, beatsToSec: (b: number) => number, star: StarRecord): void {
  const { baseNote } = params;

  if (!currentPhrase) return;

  // Shorten string chord sustains for very bright / nearby stars to avoid overwhelming long tones
  const mag = star.mag ?? 2;
  const magNorm = clamp((6 - mag) / 8, 0, 1);
  const chordBeats = clamp(7.5 * (1 - magNorm * 0.4), 3, 7.5);

  // Chord 1: beats 0-8
  state.transport.schedule((time: number) => {
    const notes = currentPhrase!.chordProgression[0].map(i => midiToNote(baseNote + i));
    notes.forEach((note, idx) => {
      state.strings?.triggerAttackRelease(note, beatsToSec(chordBeats), time + idx * 0.03, 0.35);
    });
  }, 0);

  // Chord 2: beats 8-16
  state.transport.schedule((time: number) => {
    const notes = currentPhrase!.chordProgression[1].map(i => midiToNote(baseNote + i));
    notes.forEach((note, idx) => {
      state.strings?.triggerAttackRelease(note, beatsToSec(chordBeats), time + idx * 0.03, 0.35);
    });
  }, beatsToSec(8));
}

function schedulePiano(beatsToSec: (b: number) => number): void {
  // Scheduling is handled by the centralized scheduler (scheduleRepeat).
  // Keep this function as a no-op for backwards compatibility.
  return;
}

function scheduleGuitar(beatsToSec: (b: number) => number): void {
  // Scheduling is handled by the centralized scheduler (scheduleRepeat).
  return;
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
    state.reverb, state.delay, state.filter, state.compressor, state.masterGain, state.padHP
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
