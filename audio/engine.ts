"use client";

import { mapStarToTone } from "./mappings";
import { 
  generateEnoAmbient,
  generateProceduralMusic,
  VoiceLoop,
  GenerativeConfig
} from "./procedural";
import { StarRecord } from "@/lib/types";

type EngineState = {
  initialized: boolean;
  padSynth?: any;
  particleSynth?: any;
  shimmerSynth?: any;
  noise?: any;
  delay?: any;
  reverb?: any;
  filter?: any;
  lfo?: any;
  gain?: any;
  loop?: any;
  arpLoop?: any;
  userVolume: number;
  lastBaseGain: number;
  _Transport?: any;
  _LoopCtor?: any;
  _LFO?: any;
};

const state: EngineState = {
  initialized: false,
  userVolume: 0.8,
  lastBaseGain: 0.2
};

type ToneNamespace = any;
let tone: ToneNamespace | null = null;

function pickToneNamespace(mod: any): ToneNamespace | null {
  const candidates = [mod, mod?.default, mod?.Tone, (globalThis as any)?.Tone].filter(Boolean);
  return (
    candidates.find(
      (c) =>
        typeof c.start === "function" ||
        typeof c.getContext === "function" ||
        !!c.Transport ||
        !!c.Destination
    ) ?? null
  );
}

async function importTone(): Promise<ToneNamespace> {
  if (tone) return tone;

  // Some bundlers expose Tone only via side-effect on globalThis.Tone
  const mod: any = await import("tone");
  const ns = pickToneNamespace(mod);

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[tone mod type]", typeof mod, mod);
    // eslint-disable-next-line no-console
    console.log("[tone default type]", typeof mod?.default, mod?.default);
    // eslint-disable-next-line no-console
    console.log("[globalThis.Tone exists]", !!(globalThis as any)?.Tone);
  }

  if (!ns) {
    throw new Error(
      "Tone loaded but namespace not found. In this bundler Tone may attach to globalThis.Tone, but it's missing."
    );
  }

  tone = ns;
  return ns;
}

export async function initAudio() {
  if (state.initialized) return;
  const Tone = await importTone();

  if (typeof Tone.start === "function") {
    await Tone.start();
  } else if (typeof Tone.getContext === "function") {
    const ctx = Tone.getContext();
    if (ctx?.state === "suspended" && typeof ctx.resume === "function") {
      await ctx.resume();
    }
  } else if (Tone.context?.state === "suspended" && typeof Tone.context.resume === "function") {
    await Tone.context.resume();
  } else {
    throw new Error("Tone namespace found, but cannot start/resume AudioContext.");
  }

  const Transport = Tone.Transport ?? Tone.getTransport?.();
  const PolySynth = Tone.PolySynth;
  const Synth = Tone.Synth;
  const Noise = Tone.Noise;
  const Reverb = Tone.Reverb;
  const Filter = Tone.Filter;
  const Gain = Tone.Gain;
  const Loop = Tone.Loop;
  const LFO = Tone.LFO;
  const FeedbackDelay = Tone.FeedbackDelay;
  const Destination =
    Tone.Destination ?? Tone.getDestination?.() ?? Tone.DestinationNode ?? Tone.context?.destination;

  if (!Transport || !PolySynth || !Synth || !Reverb || !Filter || !Gain || !Loop || !Destination) {
    throw new Error("Tone.js exports unavailable; check Tone namespace unwrap (default vs module).");
  }

  const padSynth = new PolySynth(Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 1.5, decay: 1.5, sustain: 0.7, release: 3.0 } // Faster attack, audible
  });

  const shimmerSynth = new PolySynth(Synth, {
    oscillator: { type: "triangle" }, // Triangle for shimmer
    envelope: { attack: 0.8, decay: 1.5, sustain: 0.5, release: 3.0 } // Faster attack
  });

  const particleSynth = new Synth({
    oscillator: { type: "sine" }, // Sine for softer tone
    envelope: { attack: 0.3, decay: 0.8, sustain: 0.3, release: 2.0 } // Slower, organic
  });

  const reverb = new Reverb({ decay: 5, wet: 0.35 }); // Moderate reverb
  if (typeof reverb.generate === "function") {
    await reverb.generate();
  }
  const filter = new Filter(1200, "lowpass"); // Higher cutoff for clarity
  const delay = FeedbackDelay ? new FeedbackDelay("4n", 0.3) : null; // Slower delay
  const lfo = LFO ? new LFO({ frequency: 0.03, min: 250, max: 1200 }) : null; // Slower, lower range
  if (lfo) lfo.connect(filter.frequency).start();

  const gain = new Gain(0.5); // Audible base gain

  padSynth.chain(filter, reverb, delay ?? gain, gain, Destination);
  shimmerSynth.chain(filter, reverb, delay ?? gain, gain, Destination);
  particleSynth.chain(filter, reverb, delay ?? gain, gain, Destination);

  const noise = Noise ? new Noise("pink") : null;
  const noiseGain = noise ? new Gain(0.02) : null;
  if (noise && noiseGain) {
    noise.connect(noiseGain);
    if (delay) noiseGain.chain(delay, gain, Destination);
    else noiseGain.chain(reverb, gain, Destination);
    noise.start();
  }

  state.padSynth = padSynth;
  state.particleSynth = particleSynth;
  state.shimmerSynth = shimmerSynth;
  state.noise = noise;
  state.delay = delay;
  state.reverb = reverb;
  state.filter = filter;
  state.lfo = lfo;
  state.gain = gain;
  state.initialized = true;

  // store dynamic constructs for later reuse
  state._Transport = Transport;
  state._LoopCtor = Loop;
  state._LFO = LFO;
}

export async function playForStar(star: StarRecord, seed = Math.random()) {
  await initAudio();
  if (!state.padSynth || !state.particleSynth || !state.filter || !state.reverb || !state.gain) {
    throw new Error("Audio not initialized");
  }

  // Use Eno-style ambient generation
  const enoConfig = generateEnoAmbient(star, seed);
  const { voices, warmth, spaciousness } = enoConfig;

  // Get effect parameters
  const params = mapStarToTone(star);
  state.lastBaseGain = params.gain;
  const targetGain = Math.max(0.2, Math.min(0.9, state.lastBaseGain * state.userVolume * 1.5));
  state.gain.gain.linearRampToValueAtTime(targetGain, (state._Transport?.seconds ?? 0) + 0.2);
  
  // Filter - keep it open enough to hear
  const filterFreq = 800 + (1 - warmth) * 1200; // 800-2000Hz range
  state.filter.frequency.linearRampToValueAtTime(
    filterFreq,
    (state._Transport?.seconds ?? 0) + 0.4
  );
  
  // Reverb
  state.reverb.wet.linearRampToValueAtTime(
    Math.min(0.5, 0.2 + spaciousness * 0.4),
    (state._Transport?.seconds ?? 0) + 0.5
  );

  disposeLoop();

  const LoopCtor = state._LoopCtor;
  const Transport = state._Transport;
  if (!LoopCtor || !Transport) {
    throw new Error("Audio transport not initialized");
  }

  // Simple approach: schedule notes directly using Transport
  const voiceLoops: any[] = [];
  
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    const synth = i < 2 ? state.padSynth : state.shimmerSynth || state.padSynth;
    const baseVelocity = voice.velocity;
    const cycleDuration = voice.cycleDuration;
    
    // Schedule each note in the voice's cycle, repeating
    const scheduleVoiceCycle = (cycleStart: number) => {
      for (let j = 0; j < voice.notes.length; j++) {
        const note = voice.notes[j];
        const noteTime = cycleStart + voice.notePositions[j] * cycleDuration;
        const velocity = Math.min(1.0, baseVelocity * 1.8); // Strong but not clipping
        const duration = 3 + Math.random() * 2; // 3-5 seconds
        
        Transport.schedule((time: number) => {
          synth.triggerAttackRelease(note, duration, time, velocity);
        }, noteTime);
      }
      
      // Schedule next cycle
      Transport.schedule(() => {
        scheduleVoiceCycle(cycleStart + cycleDuration);
      }, cycleStart + cycleDuration - 0.1);
    };
    
    // Start first cycle immediately
    scheduleVoiceCycle(0);
  }
  
  // Play an immediate chord so user hears something right away
  const firstVoice = voices[0];
  if (firstVoice && firstVoice.notes.length > 0) {
    const immediateNotes = firstVoice.notes.slice(0, 2);
    state.padSynth.triggerAttackRelease(immediateNotes, 4, "+0.1", 0.6);
  }
  
  // Store empty loop for cleanup compatibility  
  state.loop = new LoopCtor(() => {}, "1m");
  state.arpLoop = { 
    stop: () => {},
    dispose: () => {} 
  };

  await Transport.start();
}

export function stopAudio() {
  disposeLoop();
  
  // Release all playing synth notes
  if (state.padSynth) {
    state.padSynth.releaseAll();
  }
  if (state.shimmerSynth) {
    state.shimmerSynth.releaseAll();
  }
  if (state.particleSynth) {
    state.particleSynth.triggerRelease();
  }
  
  const Transport = state._Transport;
  if (Transport) {
    Transport.stop();
    Transport.cancel();
  }
}

export function setVolume(vol: number) {
  state.userVolume = Math.max(0, Math.min(1, vol));
  if (state.gain) {
    const target = state.lastBaseGain * state.userVolume;
    state.gain.gain.rampTo(target, 0.1);
  }
}

function buildPadChord(baseNote: number): string[] {
  const notes = [0, 4, 7, 11].map((interval) => baseNote + interval);
  return notes.map((n) => midiToNoteName(n));
}

function buildProgression(baseNote: number): string[][] {
  const chords = [
    [0, 4, 7, 11],
    [2, 7, 9, 14],
    [-3, 2, 7, 10],
    [0, 5, 9, 12]
  ];
  return chords.map((intervals) => intervals.map((i) => midiToNoteName(baseNote + i)));
}

function buildShimmerVoicing(baseNote: number): string[] {
  const intervals = [0, 5, 7]; // Fourth and fifth - warmer, closer intervals
  return intervals.map((i) => midiToNoteName(baseNote + i));
}

function buildParticleSequence(base: number, seed: number, density: number): string[] {
  const random = mulberry(seed);
  const result: string[] = [];
  const count = Math.max(3, Math.floor(8 * density + 2));
  const intervals = [0, 2, 5, 7, 9, 12];
  for (let i = 0; i < count; i++) {
    const interval = intervals[Math.floor(random() * intervals.length)];
    result.push(midiToNoteName(base + interval));
  }
  return result;
}

function midiToNoteName(midi: number): string {
  const clamped = Math.max(24, Math.min(96, midi));
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(clamped / 12) - 1;
  const name = names[clamped % 12];
  return `${name}${octave}`;
}

function mulberry(seed: number) {
  let t = Math.floor(seed * 0xffffffff);
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function disposeLoop() {
  if (state.loop) {
    state.loop.stop();
    state.loop.dispose();
    state.loop = undefined;
  }
  if (state.arpLoop) {
    state.arpLoop.stop();
    state.arpLoop.dispose();
    state.arpLoop = undefined;
  }
}
