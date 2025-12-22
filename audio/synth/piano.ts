"use client";

/**
 * Piano Synthesizer Module
 * 
 * Wraps js-synthesizer (FluidSynth WASM) for piano playback.
 * Handles SoundFont loading and MIDI-style note triggering.
 */

// Type declarations for js-synthesizer
declare const JSSynth: {
  Synthesizer: new () => FluidSynthInstance;
};

interface FluidSynthInstance {
  init(sampleRate: number): void;
  loadSFont(data: ArrayBuffer): Promise<number>;
  midiProgramSelect(channel: number, sfontId: number, bank: number, preset: number): void;
  midiNoteOn(channel: number, note: number, velocity: number): void;
  midiNoteOff(channel: number, note: number): void;
  midiAllNotesOff(channel: number): void;
  midiAllSoundsOff(channel: number): void;
  setGain(gain: number): void;
  createAudioNode(ctx: AudioContext, frameCount?: number): AudioNode;
  close(): void;
}

export const PIANO_CHANNEL = 0;

// SoundFont configuration
const SOUNDFONT_CONFIG = {
  piano: {
    // Free piano SoundFont URLs (prioritized)
    urls: [
      "/soundfonts/piano.sf2",  // Local bundled version
      "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3.sf2",
    ],
    bank: 0,
    preset: 0,  // Acoustic Grand Piano
  },
};

export class PianoSynth {
  private synth: FluidSynthInstance | null = null;
  private audioNode: AudioNode | null = null;
  private sfontId: number = -1;
  private initialized: boolean = false;
  private activeNotes: Set<number> = new Set();

  /**
   * Initialize the synthesizer with an AudioContext
   */
  async init(audioContext: AudioContext): Promise<AudioNode> {
    if (this.initialized && this.audioNode) {
      return this.audioNode;
    }

    // Dynamically import js-synthesizer
    try {
      await import("js-synthesizer");
    } catch {
      console.warn("js-synthesizer not available, using fallback");
      throw new Error("js-synthesizer failed to load");
    }

    // Create synthesizer instance
    this.synth = new JSSynth.Synthesizer();
    this.synth.init(audioContext.sampleRate);

    // Create audio node (using larger buffer for stability)
    this.audioNode = this.synth.createAudioNode(audioContext, 8192);
    
    // Set initial gain
    this.synth.setGain(0.5);
    
    this.initialized = true;
    return this.audioNode;
  }

  /**
   * Load the piano SoundFont
   */
  async loadSoundFont(): Promise<void> {
    if (!this.synth) {
      throw new Error("Synthesizer not initialized");
    }

    // Try loading from configured URLs
    let sfData: ArrayBuffer | null = null;
    
    for (const url of SOUNDFONT_CONFIG.piano.urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          sfData = await response.arrayBuffer();
          console.log(`Loaded piano SoundFont from: ${url}`);
          break;
        }
      } catch (e) {
        console.warn(`Failed to load SoundFont from ${url}:`, e);
      }
    }

    if (!sfData) {
      throw new Error("Failed to load piano SoundFont from any source");
    }

    // Load into synthesizer
    this.sfontId = await this.synth.loadSFont(sfData);
    
    // Select piano program on channel
    this.synth.midiProgramSelect(
      PIANO_CHANNEL,
      this.sfontId,
      SOUNDFONT_CONFIG.piano.bank,
      SOUNDFONT_CONFIG.piano.preset
    );
  }

  /**
   * Play a piano note
   */
  noteOn(midiNote: number, velocity: number): void {
    if (!this.synth || !this.initialized) return;
    
    // Clamp values
    const note = Math.max(0, Math.min(127, Math.round(midiNote)));
    const vel = Math.max(1, Math.min(127, Math.round(velocity)));
    
    this.synth.midiNoteOn(PIANO_CHANNEL, note, vel);
    this.activeNotes.add(note);
  }

  /**
   * Stop a piano note
   */
  noteOff(midiNote: number): void {
    if (!this.synth || !this.initialized) return;
    
    const note = Math.max(0, Math.min(127, Math.round(midiNote)));
    this.synth.midiNoteOff(PIANO_CHANNEL, note);
    this.activeNotes.delete(note);
  }

  /**
   * Play a note with automatic release after duration
   */
  playNote(midiNote: number, velocity: number, durationMs: number): void {
    this.noteOn(midiNote, velocity);
    setTimeout(() => this.noteOff(midiNote), durationMs);
  }

  /**
   * Stop all piano notes
   */
  allNotesOff(): void {
    if (!this.synth) return;
    
    this.synth.midiAllNotesOff(PIANO_CHANNEL);
    this.synth.midiAllSoundsOff(PIANO_CHANNEL);
    this.activeNotes.clear();
  }

  /**
   * Set piano volume (0-1)
   */
  setVolume(volume: number): void {
    if (!this.synth) return;
    this.synth.setGain(Math.max(0, Math.min(1, volume)));
  }

  /**
   * Get the audio output node
   */
  getOutputNode(): AudioNode | null {
    return this.audioNode;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.allNotesOff();
    if (this.synth) {
      this.synth.close();
      this.synth = null;
    }
    this.audioNode = null;
    this.initialized = false;
  }
}

// Singleton instance
let pianoInstance: PianoSynth | null = null;

export function getPianoSynth(): PianoSynth {
  if (!pianoInstance) {
    pianoInstance = new PianoSynth();
  }
  return pianoInstance;
}
