# SoundFont Files

This directory contains SoundFont (.sf2) files for high-quality instrument sounds.

## Included Files

- **piano.sf2** (308KB) - VintageDreamsWaves v2, a small retro-style SoundFont

## Optional: Higher Quality SoundFonts

For better audio quality, download one of these larger SoundFonts:

### FluidR3 GM (~140MB)
```bash
# From MuseScore
curl -L -o FluidR3_GM.sf2 "https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General.sf2"
```

### GeneralUser GS (~30MB)
Download manually from: https://schristiancollins.com/generaluser.php

## Configuration

The audio engine automatically detects SoundFonts in this directory.
Priority order:
1. `FluidR3_GM.sf2` (if present)
2. `MuseScore_General.sf2` (if present)
3. `piano.sf2` (bundled default)

If no SoundFont loads, the engine falls back to Tone.js synthesizers.
