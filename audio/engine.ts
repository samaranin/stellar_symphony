"use client";

import { mapStarToTone } from "./mappings";
import { 
  generateProceduralMusic, 
  midiToNoteName as proceduralMidiToNote, 
  buildChordNotes,
  Phrase,
  ChordProgression,
  GeneratorConfig
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
    envelope: { attack: 2.5, decay: 1.5, sustain: 0.7, release: 3.5 }
  });

  const shimmerSynth = new PolySynth(Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.4, decay: 1.4, sustain: 0.4, release: 3.5 }
  });

  const particleSynth = new Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.8 }
  });

  const reverb = new Reverb({ decay: 6, wet: 0.3 });
  if (typeof reverb.generate === "function") {
    await reverb.generate();
  }
  const filter = new Filter(800, "lowpass");
  const delay = FeedbackDelay ? new FeedbackDelay("8n", 0.25) : null;
  const lfo = LFO ? new LFO({ frequency: 0.06, min: 400, max: 3200 }) : null;
  if (lfo) lfo.connect(filter.frequency).start();

  const gain = new Gain(0.2);

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

  // Use the new procedural generation system (Markov chains + Genetic Algorithm)
  const proceduralData = generateProceduralMusic(star, seed);
  const { melody, harmony, bassline, chords, config } = proceduralData;

  // Also get the original mappings for effects parameters
  const params = mapStarToTone(star);
  state.lastBaseGain = params.gain;
  const targetGain = Math.max(0.001, Math.min(0.9, state.lastBaseGain * state.userVolume));
  state.gain.gain.linearRampToValueAtTime(targetGain, (state._Transport?.seconds ?? 0) + 0.2);
  state.filter.frequency.linearRampToValueAtTime(
    Math.max(120, Math.min(8000, params.filterCutoff)),
    (state._Transport?.seconds ?? 0) + 0.4
  );
  state.reverb.wet.linearRampToValueAtTime(
    Math.max(0, Math.min(0.7, params.reverbWet)),
    (state._Transport?.seconds ?? 0) + 0.5
  );

  // Build initial chord from the evolved progression
  const initialChordNotes = buildChordNotes(chords.roots[0], chords.qualities[0]);
  const shimmerNotes = buildShimmerVoicing(config.baseNote + 12);

  state.padSynth.triggerAttackRelease(initialChordNotes, "2m");
  state.shimmerSynth?.triggerAttackRelease(shimmerNotes, "4m");

  disposeLoop();

  const LoopCtor = state._LoopCtor;
  const Transport = state._Transport;
  if (!LoopCtor || !Transport) {
    throw new Error("Audio transport not initialized");
  }

  // Track playback state for evolved phrases
  let step = 0;
  let chordIndex = 0;
  let melodyIndex = 0;
  let harmonyIndex = 0;
  let bassIndex = 0;
  const stepsPerBeat = 2; // 8th notes
  
  state.loop = new LoopCtor((time: number) => {
    const beat = step / stepsPerBeat;
    
    // Play evolved melody notes (particle synth)
    if (melodyIndex < melody.notes.length) {
      const note = midiToNoteName(melody.notes[melodyIndex]);
      const velocity = melody.velocities[melodyIndex];
      const duration = `${Math.max(0.125, melody.durations[melodyIndex] / 2)}n`;
      
      // Trigger on appropriate subdivisions based on duration
      if (step % Math.max(1, Math.round(melody.durations[melodyIndex] * stepsPerBeat)) === 0) {
        state.particleSynth!.triggerAttackRelease(note, duration, time, velocity * 0.8);
        melodyIndex = (melodyIndex + 1) % melody.notes.length;
      }
    }

    // Play harmony layer (shimmer synth) - slower, every 4 beats
    if (step % (stepsPerBeat * 4) === 0 && harmonyIndex < harmony.notes.length) {
      const note = midiToNoteName(harmony.notes[harmonyIndex]);
      const velocity = harmony.velocities[harmonyIndex];
      state.shimmerSynth?.triggerAttackRelease(note, "2n", time + 0.02, velocity * 0.5);
      harmonyIndex = (harmonyIndex + 1) % harmony.notes.length;
    }

    // Play bass notes - every 2 beats
    if (step % (stepsPerBeat * 2) === 0 && bassIndex < bassline.notes.length) {
      const note = midiToNoteName(bassline.notes[bassIndex]);
      const velocity = bassline.velocities[bassIndex];
      // Bass through pad synth with long release
      const bassNotes = [note];
      state.padSynth!.triggerAttackRelease(bassNotes, "1n", time, velocity * 0.6);
      bassIndex = (bassIndex + 1) % bassline.notes.length;
    }

    // Change chords based on progression - every 8 beats (2 bars)
    if (step % (stepsPerBeat * 8) === 0) {
      chordIndex = (chordIndex + 1) % chords.roots.length;
      const chordNotes = buildChordNotes(chords.roots[chordIndex], chords.qualities[chordIndex]);
      state.padSynth!.triggerAttackRelease(chordNotes, "2m", time + 0.01, 0.7);
      
      // Also trigger shimmer on chord changes
      const shimmer = buildShimmerVoicing(chords.roots[chordIndex] + 12);
      state.shimmerSynth?.triggerAttackRelease(shimmer, "4m", time + 0.02, 0.5);
    }

    step++;
  }, "8n");

  state.loop.start(0);
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
  const intervals = [0, 7, 14];
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
