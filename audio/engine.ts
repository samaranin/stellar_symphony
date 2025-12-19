"use client";

import { mapStarToTone } from "./mappings";
import { StarRecord } from "@/lib/types";

type EngineState = {
  initialized: boolean;
  padSynth?: any;
  particleSynth?: any;
  reverb?: any;
  filter?: any;
  gain?: any;
  loop?: any;
  userVolume: number;
  lastBaseGain: number;
  _Transport?: any;
  _LoopCtor?: any;
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
  const Reverb = Tone.Reverb;
  const Filter = Tone.Filter;
  const Gain = Tone.Gain;
  const Loop = Tone.Loop;
  const Destination =
    Tone.Destination ?? Tone.getDestination?.() ?? Tone.DestinationNode ?? Tone.context?.destination;

  if (!Transport || !PolySynth || !Synth || !Reverb || !Filter || !Gain || !Loop || !Destination) {
    throw new Error("Tone.js exports unavailable; check Tone namespace unwrap (default vs module).");
  }

  const padSynth = new PolySynth(Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 2.5, decay: 1.5, sustain: 0.7, release: 3.5 }
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
  const gain = new Gain(0.2);

  padSynth.chain(filter, reverb, gain, Destination);
  particleSynth.chain(filter, reverb, gain, Destination);

  state.padSynth = padSynth;
  state.particleSynth = particleSynth;
  state.reverb = reverb;
  state.filter = filter;
  state.gain = gain;
  state.initialized = true;

  // store dynamic constructs for later reuse
  state._Transport = Transport;
  state._LoopCtor = Loop;
}

export async function playForStar(star: StarRecord, seed = Math.random()) {
  await initAudio();
  if (!state.padSynth || !state.particleSynth || !state.filter || !state.reverb || !state.gain) {
    throw new Error("Audio not initialized");
  }

  const params = mapStarToTone(star);
  state.lastBaseGain = params.gain;
  const targetGain = state.lastBaseGain * state.userVolume;
  state.gain.gain.rampTo(targetGain, 0.2);
  state.filter.frequency.rampTo(params.filterCutoff, 0.4);
  state.reverb.wet.rampTo(params.reverbWet, 0.5);

  const padNotes = buildPadChord(params.baseNote);
  const partNotes = buildParticleSequence(params.baseNote, seed, params.particleDensity);

  state.padSynth.triggerAttackRelease(padNotes, "2n");

  disposeLoop();

  const LoopCtor = state._LoopCtor;
  const Transport = state._Transport;
  if (!LoopCtor || !Transport) {
    throw new Error("Audio transport not initialized");
  }

  state.loop = new LoopCtor((time: number) => {
    const choice = partNotes[Math.floor(Math.random() * partNotes.length)];
    state.particleSynth!.triggerAttackRelease(choice, "8n", time);
  }, `${Math.max(4 - params.particleDensity * 6, 0.5)}n`);

  state.loop.start(0);
  await Transport.start();
}

export function stopAudio() {
  disposeLoop();
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
}
