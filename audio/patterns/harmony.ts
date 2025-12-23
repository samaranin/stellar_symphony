export type Mode = "ionian" | "dorian" | "lydian" | "mixolydian" | "aeolian";

export interface HarmonicPattern {
  name: string;
  scale: Mode;
  // Each chord is defined as semitone offsets from the pattern root.
  // Use extended, ambient-friendly voicings (maj7, add9, sus, etc.).
  chords: number[][];
}

export const HARMONIC_PATTERNS: HarmonicPattern[] = [
  {
    name: "Lydian Sunrise",
    scale: "lydian",
    chords: [
      [0, 4, 7, 11],      // Cmaj7
      [2, 6, 11, 14],     // Dmaj7(#11)
      [4, 7, 10, 14],     // Em7
      [0, 4, 7, 11],      // return to Cmaj7
    ],
  },
  {
    name: "Dorian Mist",
    scale: "dorian",
    chords: [
      [0, 3, 7, 10],      // Dm7
      [5, 9, 14],         // Gadd9
      [9, 12, 16],        // Am7
      [0, 3, 7, 10],      // Dm7
    ],
  },
  {
    name: "Ionian Bloom",
    scale: "ionian",
    chords: [
      [0, 4, 7, 11],      // Fmaj7
      [-3, 2, 5, 9],      // Dm7 (vi)
      [-10, -3, 1, 5],    // Bbmaj7
      [0, 4, 7, 11],      // Fmaj7
    ],
  },
  {
    name: "Suspended Serenity",
    scale: "mixolydian",
    chords: [
      [0, 2, 7],          // Asus2
      [7, 12, 14],        // Esus4 (relative to A root)
      [0, 2, 7],          // Asus2
    ],
  },
  {
    name: "Endless Voyage",
    scale: "ionian",
    chords: [
      [9, 12, 16, 21],    // F#m7 (vi in A)
      [2, 6, 11, 14],     // Dmaj7
      [0, 4, 7, 11],      // Amaj7
      [7, 9, 14],         // Esus4
    ],
  },
  {
    name: "Starlit Lydian",
    scale: "lydian",
    chords: [
      [0, 4, 11, 18],     // Fmaj7(#11)
      [2, 7, 11, 14],     // Gadd9
      [-1, 2, 7, 10],     // Em7
      [0, 4, 11, 18],     // Fmaj7(#11)
    ],
  },
  {
    name: "Celestial Dawn",
    scale: "ionian",
    chords: [
      [0, 4, 7, 14],      // Gmaj9
      [5, 9, 12, 16],     // Cmaj7
    ],
  },
  {
    name: "Melancholic Moon",
    scale: "aeolian",
    chords: [
      [0, 3, 7, 10],      // Am7
      [-2, 2, 7, 14],     // Gadd9
      [-5, -1, 4, 11],    // Fmaj7
      [0, 3, 7, 10],      // Am7
    ],
  },
  {
    name: "Nostalgic Daydream",
    scale: "ionian",
    chords: [
      [0, 4, 7, 14],      // Cmaj9
      [4, 7, 10, 14],     // Em7
      [5, 9, 12, 17],     // Fmaj9
      [0, 4, 7, 14],      // Cmaj9
    ],
  },
  {
    name: "Emerald Dorian",
    scale: "dorian",
    chords: [
      [0, 3, 7, 10],      // Em7
      [5, 9, 14],         // Aadd9
      [0, 3, 7, 10],      // Em7
    ],
  },
  {
    name: "Winter Solace",
    scale: "aeolian",
    chords: [
      [0, 3, 7, 14],      // Bm9
      [-2, 2, 7, 14],     // Aadd9
      [-5, -1, 4, 11],    // Gmaj7
      [0, 3, 7, 14],      // Bm9
    ],
  },
];
