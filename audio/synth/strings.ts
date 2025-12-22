"use client";

/**
 * String Pad Synthesizer Module
 * 
 * Wraps js-synthesizer (FluidSynth WASM) for string/pad playback.
 * Uses a separate channel from piano for independent control.
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
  midiControlChange(channel: number, controller: number, value: number): void;
  setGain(gain: number): void;
  createAudioNode(ctx: AudioContext, frameCount?: number): AudioNode;
  close(): void;
}

export const STRINGS_CHANNEL = 1;

// MIDI CC numbers
const CC_VOLUME = 7;
const CC_EXPRESSION = 11;
const CC_REVERB = 91;

// SoundFont configuration
const SOUNDFONT_CONFIG = {
  strings: {
    urls: [
      "/soundfonts/strings.sf2",  // Local bundled version
      "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/string_ensemble_1-mp3.sf2",
    ],
    bank: 0,
    preset: 48,  // String Ensemble (GM preset 48)
  },
};

export class StringsSynth {
  private synth: FluidSynthInstance | null = null;
  private audioNode: AudioNode | null = null;
  private sfontId: number = -1;
  private initialized: boolean = false;
  private activeNotes: Map<number, { velocity: number; startTime: number }> = new Map();

  /**
   * Initialize the synthesizer with an AudioContext
   * Note: Can share synth instance with piano for efficiency
   */
  async init(audioContext: AudioContext, sharedSynth?: FluidSynthInstance): Promise<AudioNode | null> {
    if (this.initialized && this.audioNode) {
      return this.audioNode;
    }

    if (sharedSynth) {
      // Use shared synthesizer (piano and strings on same instance, different channels)
      this.synth = sharedSynth;
      this.audioNode = null; // Audio node managed by piano
      this.initialized = true;
      return null;
    }

    // Create separate synthesizer instance
    try {
      await import("js-synthesizer");
    } catch {
      console.warn("js-synthesizer not available for strings");
      throw new Error("js-synthesizer failed to load");
    }

    this.synth = new JSSynth.Synthesizer();
    this.synth.init(audioContext.sampleRate);
    this.audioNode = this.synth.createAudioNode(audioContext, 8192);
    this.synth.setGain(0.4); // Strings slightly quieter than piano
    
    this.initialized = true;
    return this.audioNode;
  }

  /**
   * Load the strings SoundFont
   */
  async loadSoundFont(): Promise<void> {
    if (!this.synth) {
      throw new Error("Synthesizer not initialized");
    }

    // Try loading from configured URLs
    let sfData: ArrayBuffer | null = null;
    
    for (const url of SOUNDFONT_CONFIG.strings.urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          sfData = await response.arrayBuffer();
          console.log(`Loaded strings SoundFont from: ${url}`);
          break;
        }
      } catch (e) {
        console.warn(`Failed to load SoundFont from ${url}:`, e);
      }
    }

    if (!sfData) {
      throw new Error("Failed to load strings SoundFont from any source");
    }

    // Load into synthesizer
    this.sfontId = await this.synth.loadSFont(sfData);
    
    // Select strings program on channel
    this.synth.midiProgramSelect(
      STRINGS_CHANNEL,
      this.sfontId,
      SOUNDFONT_CONFIG.strings.bank,
      SOUNDFONT_CONFIG.strings.preset
    );

    // Set initial expression and reverb
    this.synth.midiControlChange(STRINGS_CHANNEL, CC_EXPRESSION, 100);
    this.synth.midiControlChange(STRINGS_CHANNEL, CC_REVERB, 80);
  }

  /**
   * Set the synthesizer instance (for shared usage)
   */
  setSynthInstance(synth: FluidSynthInstance, sfontId: number): void {
    this.synth = synth;
    this.sfontId = sfontId;
    this.initialized = true;
    
    // Select strings preset
    this.synth.midiProgramSelect(
      STRINGS_CHANNEL,
      sfontId,
      SOUNDFONT_CONFIG.strings.bank,
      SOUNDFONT_CONFIG.strings.preset
    );
  }

  /**
   * Play a string note
   */
  noteOn(midiNote: number, velocity: number): void {
    if (!this.synth || !this.initialized) return;
    
    const note = Math.max(0, Math.min(127, Math.round(midiNote)));
    const vel = Math.max(1, Math.min(127, Math.round(velocity)));
    
    this.synth.midiNoteOn(STRINGS_CHANNEL, note, vel);
    this.activeNotes.set(note, { velocity: vel, startTime: Date.now() });
  }

  /**
   * Stop a string note
   */
  noteOff(midiNote: number): void {
    if (!this.synth || !this.initialized) return;
    
    const note = Math.max(0, Math.min(127, Math.round(midiNote)));
    this.synth.midiNoteOff(STRINGS_CHANNEL, note);
    this.activeNotes.delete(note);
  }

  /**
   * Play a chord (multiple notes simultaneously)
   */
  playChord(midiNotes: number[], velocity: number): void {
    for (const note of midiNotes) {
      this.noteOn(note, velocity);
    }
  }

  /**
   * Stop a chord
   */
  stopChord(midiNotes: number[]): void {
    for (const note of midiNotes) {
      this.noteOff(note);
    }
  }

  /**
   * Play a note/chord with automatic release after duration
   */
  playWithDuration(midiNotes: number | number[], velocity: number, durationMs: number): void {
    const notes = Array.isArray(midiNotes) ? midiNotes : [midiNotes];
    this.playChord(notes, velocity);
    setTimeout(() => this.stopChord(notes), durationMs);
  }

  /**
   * Stop all string notes
   */
  allNotesOff(): void {
    if (!this.synth) return;
    
    this.synth.midiAllNotesOff(STRINGS_CHANNEL);
    this.synth.midiAllSoundsOff(STRINGS_CHANNEL);
    this.activeNotes.clear();
  }

  /**
   * Set strings volume (0-127 MIDI range)
   */
  setVolume(volume: number): void {
    if (!this.synth) return;
    const v = Math.max(0, Math.min(127, Math.round(volume * 127)));
    this.synth.midiControlChange(STRINGS_CHANNEL, CC_VOLUME, v);
  }

  /**
   * Set expression (dynamics, 0-127)
   */
  setExpression(value: number): void {
    if (!this.synth) return;
    const v = Math.max(0, Math.min(127, Math.round(value)));
    this.synth.midiControlChange(STRINGS_CHANNEL, CC_EXPRESSION, v);
  }

  /**
   * Get active notes
   */
  getActiveNotes(): number[] {
    return Array.from(this.activeNotes.keys());
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
    if (this.audioNode && this.synth) {
      this.synth.close();
      this.synth = null;
    }
    this.audioNode = null;
    this.initialized = false;
    this.activeNotes.clear();
  }
}

// Singleton instance
let stringsInstance: StringsSynth | null = null;

export function getStringsSynth(): StringsSynth {
  if (!stringsInstance) {
    stringsInstance = new StringsSynth();
  }
  return stringsInstance;
}
