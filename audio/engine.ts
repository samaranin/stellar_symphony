import * as Tone from "tone";
import { mapStarToTone } from "./mappings";
import { StarRecord } from "@/lib/types";

type EngineState = {
  initialized: boolean;
  padSynth?: Tone.PolySynth;
  particleSynth?: Tone.Synth;
  reverb?: Tone.Reverb;
  filter?: Tone.Filter;
  gain?: Tone.Gain;
  loop?: Tone.Loop;
};

const state: EngineState = {
  initialized: false
};

export async function initAudio() {
  if (state.initialized) return;
  await Tone.start();

  const padSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 2.5, decay: 1.5, sustain: 0.7, release: 3.5 }
  });

  const particleSynth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.8 }
  });

  const reverb = new Tone.Reverb({ decay: 6, wet: 0.3 });
  const filter = new Tone.Filter(800, "lowpass");
  const gain = new Tone.Gain(0.2);

  padSynth.chain(filter, reverb, gain, Tone.Destination);
  particleSynth.chain(filter, reverb, gain, Tone.Destination);

  state.padSynth = padSynth;
  state.particleSynth = particleSynth;
  state.reverb = reverb;
  state.filter = filter;
  state.gain = gain;
  state.initialized = true;
}

export async function playForStar(star: StarRecord, seed = Math.random()) {
  await initAudio();
  if (!state.padSynth || !state.particleSynth || !state.filter || !state.reverb || !state.gain) {
    throw new Error("Audio not initialized");
  }

  const params = mapStarToTone(star);
  state.gain.gain.rampTo(params.gain, 0.2);
  state.filter.frequency.rampTo(params.filterCutoff, 0.4);
  state.reverb.wet.rampTo(params.reverbWet, 0.5);

  const padNotes = buildPadChord(params.baseNote);
  const partNotes = buildParticleSequence(params.baseNote, seed, params.particleDensity);

  state.padSynth.triggerAttackRelease(padNotes, "2n");

  if (state.loop) {
    state.loop.dispose();
  }

  state.loop = new Tone.Loop((time) => {
    const choice = partNotes[Math.floor(Math.random() * partNotes.length)];
    state.particleSynth!.triggerAttackRelease(choice, "8n", time);
  }, `${Math.max(4 - params.particleDensity * 6, 0.5)}n`);

  state.loop.start(0);
  await Tone.Transport.start();
}

export function stopAudio() {
  if (state.loop) {
    state.loop.stop();
  }
  Tone.Transport.stop();
}

export function isRunning() {
  return Tone.Transport.state === "started";
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
