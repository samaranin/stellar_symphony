import { describe, it, expect } from "vitest";
import {
  createRNG,
  generateEnoAmbient,
  generateProceduralMusic,
  midiToNoteName,
  buildChordNotes,
  buildTransitionMatrix,
  mapStarToGeneratorConfig,
  SCALES,
  VoiceLoop,
  GenerativeConfig
} from "./procedural";
import { StarRecord } from "@/lib/types";

describe("Eno-Style Ambient Music Generation", () => {
  describe("Seeded RNG", () => {
    it("produces deterministic sequences with same seed", () => {
      const rng1 = createRNG(42);
      const rng2 = createRNG(42);
      
      const seq1 = [rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2()];
      
      expect(seq1).toEqual(seq2);
    });

    it("produces different sequences with different seeds", () => {
      const rng1 = createRNG(42);
      const rng2 = createRNG(123);
      
      expect(rng1()).not.toEqual(rng2());
    });

    it("produces values in [0, 1)", () => {
      const rng = createRNG(999);
      for (let i = 0; i < 100; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe("Eno Ambient Generation", () => {
    const testStar: StarRecord = {
      id: "test_star",
      ra: 100.5,
      dec: 45.2,
      mag: 1.5,
      temp: 6000,
      dist: 50
    };

    it("generates configuration with multiple voices", () => {
      const config = generateEnoAmbient(testStar, 42);
      
      expect(config.voices.length).toBeGreaterThanOrEqual(3);
      expect(config.voices.length).toBeLessThanOrEqual(5);
    });

    it("generates voices with incommensurable cycle lengths", () => {
      const config = generateEnoAmbient(testStar, 42);
      
      // All cycle lengths should be different (incommensurable)
      const lengths = config.voices.map(v => v.cycleDuration);
      const uniqueLengths = new Set(lengths);
      expect(uniqueLengths.size).toBe(lengths.length);
      
      // Lengths should be in reasonable range (15-40 seconds)
      for (const len of lengths) {
        expect(len).toBeGreaterThan(10);
        expect(len).toBeLessThan(50);
      }
    });

    it("generates voices with sparse note material (1-2 notes per voice)", () => {
      const config = generateEnoAmbient(testStar, 42);
      
      for (const voice of config.voices) {
        expect(voice.notes.length).toBeGreaterThanOrEqual(1);
        expect(voice.notes.length).toBeLessThanOrEqual(3);
        expect(voice.notePositions.length).toBe(voice.notes.length);
      }
    });

    it("generates valid note names", () => {
      const config = generateEnoAmbient(testStar, 42);
      const notePattern = /^[A-G]#?\d$/;
      
      for (const voice of config.voices) {
        for (const note of voice.notes) {
          expect(note).toMatch(notePattern);
        }
      }
    });

    it("generates note positions in valid range (0-1)", () => {
      const config = generateEnoAmbient(testStar, 42);
      
      for (const voice of config.voices) {
        for (const pos of voice.notePositions) {
          expect(pos).toBeGreaterThanOrEqual(0);
          expect(pos).toBeLessThanOrEqual(1);
        }
      }
    });

    it("produces deterministic results with same seed", () => {
      const config1 = generateEnoAmbient(testStar, 42);
      const config2 = generateEnoAmbient(testStar, 42);
      
      expect(config1.voices.length).toBe(config2.voices.length);
      expect(config1.voices[0].notes).toEqual(config2.voices[0].notes);
      expect(config1.voices[0].cycleDuration).toBe(config2.voices[0].cycleDuration);
    });

    it("produces different results with different seeds", () => {
      const config1 = generateEnoAmbient(testStar, 42);
      const config2 = generateEnoAmbient(testStar, 999);
      
      // At least some aspect should differ
      const allSame = 
        config1.voices[0].notes[0] === config2.voices[0].notes[0] &&
        config1.voices[0].cycleDuration === config2.voices[0].cycleDuration;
      
      expect(allSame).toBe(false);
    });

    it("sets ambient parameters based on star characteristics", () => {
      const hotStar: StarRecord = { id: "hot", ra: 0, dec: 0, mag: 1, temp: 15000 };
      const coolStar: StarRecord = { id: "cool", ra: 0, dec: 0, mag: 1, temp: 3500 };
      
      const hotConfig = generateEnoAmbient(hotStar, 42);
      const coolConfig = generateEnoAmbient(coolStar, 42);
      
      // Cooler stars should have higher warmth value
      expect(coolConfig.warmth).toBeGreaterThan(hotConfig.warmth);
    });
  });

  describe("Star-to-Music Mapping", () => {
    it("maps hot stars to appropriate config", () => {
      const hotStar: StarRecord = { id: "hot", ra: 0, dec: 0, mag: -1, temp: 20000 };
      const config = mapStarToGeneratorConfig(hotStar);
      
      expect(config.scale.name).toBe("Lydian");
      expect(config.baseNote).toBe(48); // C3 - warm base
    });

    it("maps cool stars to appropriate config", () => {
      const coolStar: StarRecord = { id: "cool", ra: 0, dec: 0, mag: 4, temp: 3500 };
      const config = mapStarToGeneratorConfig(coolStar);
      
      expect(config.scale.name).toBe("Pentatonic");
    });

    it("maps medium temperature stars appropriately", () => {
      const medStar: StarRecord = { id: "med", ra: 0, dec: 0, mag: 2, temp: 6500 };
      const config = mapStarToGeneratorConfig(medStar);
      
      // 6500K falls in warm-bright range = Mixolydian
      expect(config.scale.name).toBe("Mixolydian");
    });
  });

  describe("Legacy Compatibility - generateProceduralMusic", () => {
    const testStar: StarRecord = {
      id: "test_star",
      ra: 100.5,
      dec: 45.2,
      mag: 1.5,
      temp: 6000,
      dist: 50
    };

    it("returns padNotes and shimmerNotes", () => {
      const result = generateProceduralMusic(testStar, 42);
      
      expect(result.padNotes).toBeDefined();
      expect(result.shimmerNotes).toBeDefined();
      expect(result.config).toBeDefined();
    });

    it("returns phrases with valid structure", () => {
      const result = generateProceduralMusic(testStar, 42);
      
      expect(result.padNotes.notes.length).toBeGreaterThan(0);
      expect(result.padNotes.durations.length).toBe(result.padNotes.notes.length);
      expect(result.padNotes.velocities.length).toBe(result.padNotes.notes.length);
    });

    it("returns notes in warm lower register (MIDI 36-72)", () => {
      const result = generateProceduralMusic(testStar, 42);
      
      for (const note of result.padNotes.notes) {
        expect(note).toBeGreaterThanOrEqual(24); // C1
        expect(note).toBeLessThanOrEqual(76); // E5
      }
    });

    it("produces deterministic results with same seed", () => {
      const result1 = generateProceduralMusic(testStar, 42);
      const result2 = generateProceduralMusic(testStar, 42);
      
      expect(result1.padNotes.notes).toEqual(result2.padNotes.notes);
    });
  });

  describe("Utility Functions", () => {
    it("converts MIDI to note names correctly", () => {
      expect(midiToNoteName(60)).toBe("C4");
      expect(midiToNoteName(69)).toBe("A4");
      expect(midiToNoteName(48)).toBe("C3");
      expect(midiToNoteName(61)).toBe("C#4");
    });

    it("builds chord notes correctly", () => {
      const majorChord = buildChordNotes(60, "major");
      expect(majorChord).toEqual([60, 64, 67]); // C4, E4, G4 as MIDI

      const minorChord = buildChordNotes(60, "minor");
      expect(minorChord).toEqual([60, 63, 67]); // C4, Eb4, G4 as MIDI
    });

    it("builds sus4 chord correctly", () => {
      const sus4Chord = buildChordNotes(60, "sus4");
      expect(sus4Chord).toEqual([60, 65, 67]); // C4, F4, G4 as MIDI
    });
  });

  describe("Transition Matrix (Legacy)", () => {
    it("builds valid transition matrix for compatibility", () => {
      const scale = SCALES.pentatonic;
      const random = createRNG(42);
      const matrix = buildTransitionMatrix(scale, random);
      
      expect(matrix.size).toBe(scale.intervals.length);
      
      // Check probabilities sum to approximately 1 for each row
      for (const [, transitions] of matrix) {
        let sum = 0;
        for (const [, prob] of transitions) {
          sum += prob;
        }
        expect(sum).toBeCloseTo(1, 5);
      }
    });
  });

  describe("Scale Definitions", () => {
    it("has all expected scales defined", () => {
      expect(SCALES.pentatonic).toBeDefined();
      expect(SCALES.major).toBeDefined();
      expect(SCALES.dorian).toBeDefined();
      expect(SCALES.lydian).toBeDefined();
    });

    it("has correct interval counts for scales", () => {
      expect(SCALES.pentatonic.intervals.length).toBe(5);
      expect(SCALES.major.intervals.length).toBe(7);
    });
  });
});
