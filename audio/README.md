# Stellar Symphony Audio Engine

## Overview

The Stellar Symphony Audio Engine generates continuous, neoclassical ambient soundscapes for an interactive star map. It produces live-sounding ambient music inspired by artists like Stars of the Lid and Ólafur Arnalds.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Star Parameters                         │
│        (magnitude, temperature, distance, spectral type)     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Pattern Generator                           │
│     audio/gen/pattern.ts + audio/gen/seed.ts                 │
│  • Star → scale/mode mapping (temp → lydian/dorian/etc)     │
│  • Chord progression generation (I-IV, i-VI patterns)        │
│  • Sparse piano motifs with stepwise motion                  │
│  • Incommensurable cycle lengths (never repeat exactly)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Piano Synth  │  │ String Synth │  │ Shimmer Synth│
│  (triangle)  │  │   (sine)     │  │   (sine)     │
│ Fast attack  │  │ Slow attack  │  │  Very slow   │
│ Med release  │  │ Long release │  │ Long release │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Effects Chain                           │
│                  audio/fx/reverb.ts                          │
│  • Low-pass filter (warmth control: 1.5kHz - 5.5kHz)        │
│  • Feedback delay (subtle echoes)                            │
│  • Convolution reverb (6s decay, spaciousness control)       │
│  • Master gain with limiter                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    Audio Output
```

## File Structure

```
audio/
├── engine.ts           # Main orchestration, public API
├── magenta.ts          # AI melody generation (optional)
├── mappings.ts         # Star → audio parameter mapping
├── procedural.ts       # Legacy procedural generation
├── gen/
│   ├── seed.ts         # Seeded RNG, star hashing
│   ├── seed.test.ts    # Tests for seed module
│   ├── pattern.ts      # Pattern/chord/melody generation
│   └── pattern.test.ts # Tests for pattern module
├── synth/
│   ├── piano.ts        # Piano synth (js-synthesizer wrapper)
│   └── strings.ts      # String pad synth wrapper
└── fx/
    └── reverb.ts       # Effects chain (filter, delay, reverb)
```

## Public API

```typescript
// Initialize the engine (call on user gesture)
await initAudio(): Promise<void>

// Load instruments (optional, for SoundFont mode)
await loadInstruments(): Promise<void>

// Play music for a star
await playForStar(star: StarRecord, seed?: number): Promise<void>

// Stop playback
stopAudio(): void

// Volume control (0-1)
setVolume(volume: number): void
```

## Star → Music Mapping

| Star Property | Musical Parameter | Mapping |
|---------------|-------------------|---------|
| Temperature | Scale/Mode | Hot (>10kK) → Lydian, Medium → Dorian, Cool (<4kK) → Pentatonic |
| Temperature | Filter Cutoff | Hot → Open (5.5kHz), Cool → Warm (1.5kHz) |
| Temperature | Base Note | Hot → Higher (C4), Cool → Lower (C2) |
| Magnitude | Tempo | Bright (-1) → 80 BPM, Dim (+6) → 55 BPM |
| Magnitude | Density | Bright → More notes, Dim → Sparser |
| Distance | Reverb | Far → More reverb, Near → Less reverb |

## SoundFont Setup (Optional)

For higher quality instrument sounds, you can add SoundFonts:

1. Download piano SoundFont (e.g., Salamander Grand Piano)
2. Download strings SoundFont (e.g., FluidR3 GM strings)
3. Place in `/public/soundfonts/`:
   ```
   public/soundfonts/
   ├── piano.sf2
   └── strings.sf2
   ```

The engine will automatically use SoundFonts if available, otherwise falls back to Tone.js synthesizers.

## Development

### Running Tests
```bash
npm run test
```

### Test Coverage
- `audio/gen/seed.test.ts` — 17 tests (RNG, hashing)
- `audio/gen/pattern.test.ts` — 33 tests (scales, chords, patterns)
- `audio/procedural.test.ts` — 24 tests (legacy compatibility)
- `audio/mappings.test.ts` — 3 tests (parameter mapping)

Total: 80+ tests

### Adding New Scales

Edit `audio/gen/pattern.ts`:

```typescript
export const SCALES: Record<string, Scale> = {
  // Add your scale
  myScale: { name: "My Scale", intervals: [0, 2, 4, 5, 8, 9, 11] },
  // ...
};
```

### Customizing Star → Mode Mapping

Edit `audio/gen/pattern.ts`:

```typescript
export function spectralClassToMode(spec?: string): string {
  // Customize the mapping
  const modeMap: Record<string, string> = {
    "O": "lydian",
    "B": "ionian",
    // ...
  };
}
```

## Dependencies

- **Tone.js** — Scheduling, effects, synthesis
- **js-synthesizer** — FluidSynth WASM (optional, for SoundFonts)
- **@magenta/music** — AI melody generation (optional)

## Browser Compatibility

- Chrome 66+ (AudioWorklet support)
- Firefox 76+
- Safari 14.1+
- Edge 79+

Note: Audio will not start until user interaction (autoplay policy compliance).

## Performance

- Target: <10% CPU on typical laptop
- Polyphony: ~10-15 simultaneous voices
- Memory: ~50MB with SoundFonts, ~10MB without
- Latency: ~50ms (using AudioWorklet)
