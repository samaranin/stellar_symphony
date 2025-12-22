"use client";

/**
 * Effects Chain Module
 * 
 * Creates and manages audio effects for ambient sound:
 * - Reverb (convolver or algorithmic)
 * - Filtering/EQ
 * - Stereo spread
 * - Delay (optional)
 * - Limiter
 * 
 * All effects use Web Audio API nodes, orchestrated via Tone.js where beneficial.
 */

// Effect parameters interface
export interface EffectParams {
  reverbDecay: number;     // 0-1, maps to decay time
  reverbWet: number;       // 0-1, wet/dry mix
  filterCutoff: number;    // Hz, low-pass filter
  filterQ: number;         // Filter resonance
  delayTime: number;       // Seconds
  delayFeedback: number;   // 0-1
  stereoWidth: number;     // 0-1
  masterGain: number;      // 0-1
}

// Default ambient-friendly settings
export const DEFAULT_EFFECT_PARAMS: EffectParams = {
  reverbDecay: 0.7,       // Long decay for spaciousness
  reverbWet: 0.4,         // Moderate wet mix
  filterCutoff: 4000,     // Gentle high cut
  filterQ: 0.5,           // Low resonance
  delayTime: 0.4,         // Quarter note at ~60 BPM
  delayFeedback: 0.2,     // Subtle echo
  stereoWidth: 0.6,       // Wide but not extreme
  masterGain: 0.7,        // Leave headroom
};

export class EffectsChain {
  private ctx: AudioContext | null = null;
  private initialized: boolean = false;

  // Audio nodes
  private inputGain: GainNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private convolver: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private delay: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayWet: GainNode | null = null;
  private stereoWidener: StereoPannerNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private output: GainNode | null = null;

  private params: EffectParams = { ...DEFAULT_EFFECT_PARAMS };

  /**
   * Initialize the effects chain
   */
  async init(audioContext: AudioContext): Promise<void> {
    if (this.initialized) return;
    
    this.ctx = audioContext;

    // Create all nodes
    this.inputGain = this.ctx.createGain();
    this.inputGain.gain.value = 1.0;

    // Filters
    this.lowpassFilter = this.ctx.createBiquadFilter();
    this.lowpassFilter.type = "lowpass";
    this.lowpassFilter.frequency.value = this.params.filterCutoff;
    this.lowpassFilter.Q.value = this.params.filterQ;

    this.highpassFilter = this.ctx.createBiquadFilter();
    this.highpassFilter.type = "highpass";
    this.highpassFilter.frequency.value = 40; // Remove sub-bass rumble
    this.highpassFilter.Q.value = 0.5;

    // Reverb (convolver with generated impulse response)
    this.convolver = this.ctx.createConvolver();
    await this.generateImpulseResponse(this.params.reverbDecay);

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = this.params.reverbWet;

    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1 - this.params.reverbWet;

    // Delay
    this.delay = this.ctx.createDelay(2.0);
    this.delay.delayTime.value = this.params.delayTime;

    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = this.params.delayFeedback;

    this.delayWet = this.ctx.createGain();
    this.delayWet.gain.value = 0.15; // Subtle delay

    // Stereo (simple panner for now)
    this.stereoWidener = this.ctx.createStereoPanner();
    this.stereoWidener.pan.value = 0; // Center, width handled differently

    // Limiter (compressor set as limiter)
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;

    // Master output
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.params.masterGain;

    this.output = this.ctx.createGain();
    this.output.gain.value = 1.0;

    // Connect the chain
    this.connectChain();

    this.initialized = true;
  }

  /**
   * Connect all nodes in the effects chain
   */
  private connectChain(): void {
    if (!this.inputGain || !this.lowpassFilter || !this.highpassFilter ||
        !this.convolver || !this.reverbGain || !this.dryGain ||
        !this.delay || !this.delayFeedback || !this.delayWet ||
        !this.limiter || !this.masterGain || !this.output) {
      return;
    }

    // Input → Highpass → Lowpass
    this.inputGain.connect(this.highpassFilter);
    this.highpassFilter.connect(this.lowpassFilter);

    // Parallel dry/wet reverb paths
    // Dry path
    this.lowpassFilter.connect(this.dryGain);
    this.dryGain.connect(this.masterGain);

    // Wet path (through reverb)
    this.lowpassFilter.connect(this.convolver);
    this.convolver.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    // Delay path (from filtered signal)
    this.lowpassFilter.connect(this.delay);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay); // Feedback loop
    this.delay.connect(this.delayWet);
    this.delayWet.connect(this.masterGain);

    // Master → Limiter → Output
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.output);
  }

  /**
   * Generate an impulse response for reverb
   * Creates a decaying noise burst that simulates a reverberant space
   */
  private async generateImpulseResponse(decay: number): Promise<void> {
    if (!this.ctx || !this.convolver) return;

    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * (2 + decay * 4)); // 2-6 seconds
    const impulse = this.ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with slight randomness for natural sound
        const envelope = Math.exp(-3 * i / length);
        channelData[i] = (Math.random() * 2 - 1) * envelope;
      }
    }

    this.convolver.buffer = impulse;
  }

  /**
   * Load an external impulse response file
   */
  async loadImpulseResponse(url: string): Promise<void> {
    if (!this.ctx || !this.convolver) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.convolver.buffer = audioBuffer;
    } catch (e) {
      console.warn(`Failed to load IR from ${url}, using generated:`, e);
      await this.generateImpulseResponse(this.params.reverbDecay);
    }
  }

  /**
   * Get the input node to connect sources to
   */
  getInput(): GainNode | null {
    return this.inputGain;
  }

  /**
   * Get the output node to connect to destination
   */
  getOutput(): GainNode | null {
    return this.output;
  }

  /**
   * Connect to the audio destination
   */
  connectToDestination(): void {
    if (this.output && this.ctx) {
      this.output.connect(this.ctx.destination);
    }
  }

  /**
   * Update effect parameters
   */
  setParams(params: Partial<EffectParams>): void {
    this.params = { ...this.params, ...params };
    this.applyParams();
  }

  /**
   * Apply current parameters to nodes
   */
  private applyParams(): void {
    const now = this.ctx?.currentTime ?? 0;
    const rampTime = 0.1; // 100ms ramp for smooth changes

    if (this.lowpassFilter) {
      this.lowpassFilter.frequency.linearRampToValueAtTime(
        this.params.filterCutoff,
        now + rampTime
      );
      this.lowpassFilter.Q.linearRampToValueAtTime(
        this.params.filterQ,
        now + rampTime
      );
    }

    if (this.reverbGain) {
      this.reverbGain.gain.linearRampToValueAtTime(
        this.params.reverbWet,
        now + rampTime
      );
    }

    if (this.dryGain) {
      this.dryGain.gain.linearRampToValueAtTime(
        1 - this.params.reverbWet,
        now + rampTime
      );
    }

    if (this.delay) {
      this.delay.delayTime.linearRampToValueAtTime(
        this.params.delayTime,
        now + rampTime
      );
    }

    if (this.delayFeedback) {
      this.delayFeedback.gain.linearRampToValueAtTime(
        this.params.delayFeedback,
        now + rampTime
      );
    }

    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.params.masterGain,
        now + rampTime
      );
    }
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(volume: number): void {
    this.params.masterGain = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.params.masterGain,
        this.ctx.currentTime + 0.05
      );
    }
  }

  /**
   * Set reverb amount (0-1)
   */
  setReverb(wet: number): void {
    this.params.reverbWet = Math.max(0, Math.min(1, wet));
    if (this.reverbGain && this.dryGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.reverbGain.gain.linearRampToValueAtTime(this.params.reverbWet, now + 0.05);
      this.dryGain.gain.linearRampToValueAtTime(1 - this.params.reverbWet, now + 0.05);
    }
  }

  /**
   * Set filter cutoff (Hz)
   */
  setFilterCutoff(freq: number): void {
    this.params.filterCutoff = Math.max(100, Math.min(20000, freq));
    if (this.lowpassFilter && this.ctx) {
      this.lowpassFilter.frequency.linearRampToValueAtTime(
        this.params.filterCutoff,
        this.ctx.currentTime + 0.05
      );
    }
  }

  /**
   * Configure effects based on star properties
   */
  configureForStar(warmth: number, spaciousness: number): void {
    // Warmth: lower values = brighter (higher cutoff), higher = warmer (lower cutoff)
    const filterCutoff = 2000 + (1 - warmth) * 6000; // 2kHz - 8kHz

    // Spaciousness: affects reverb amount and decay
    const reverbWet = 0.2 + spaciousness * 0.4; // 0.2 - 0.6

    this.setParams({
      filterCutoff,
      reverbWet,
      delayFeedback: 0.1 + spaciousness * 0.2,
    });
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clean up all nodes
   */
  dispose(): void {
    const nodes = [
      this.inputGain, this.lowpassFilter, this.highpassFilter,
      this.convolver, this.reverbGain, this.dryGain,
      this.delay, this.delayFeedback, this.delayWet,
      this.stereoWidener, this.limiter, this.masterGain, this.output
    ];

    for (const node of nodes) {
      if (node) {
        try {
          node.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }
    }

    this.inputGain = null;
    this.lowpassFilter = null;
    this.highpassFilter = null;
    this.convolver = null;
    this.reverbGain = null;
    this.dryGain = null;
    this.delay = null;
    this.delayFeedback = null;
    this.delayWet = null;
    this.stereoWidener = null;
    this.limiter = null;
    this.masterGain = null;
    this.output = null;
    this.ctx = null;
    this.initialized = false;
  }
}

// Singleton instance
let effectsInstance: EffectsChain | null = null;

export function getEffectsChain(): EffectsChain {
  if (!effectsInstance) {
    effectsInstance = new EffectsChain();
  }
  return effectsInstance;
}
