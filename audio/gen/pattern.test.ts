import { describe, it, expect } from "vitest";
import {
  SCALES,
  spectralClassToMode,
  temperatureToParams,
  starToBaseNote,
  buildChord,
  openVoicing,
  generateChordProgression,
  generateMotif,
  generatePianoSequence,
  generateStringPadSequence,
  generatePatternFromStar,
  midiToNoteName,
  noteNameToMidi,
} from "./pattern";
import { SeededRNG } from "./seed";
import { StarRecord } from "@/lib/types";

describe("Pattern Generation Module", () => {
  const testStar: StarRecord = {
    id: "test_star",
    ra: 100.5,
    dec: 45.2,
    mag: 1.5,
    temp: 6000,
    dist: 50,
    spec: "G2V",
  };

  describe("Scale Definitions", () => {
    it("has all expected scales", () => {
      expect(SCALES.ionian).toBeDefined();
      expect(SCALES.dorian).toBeDefined();
      expect(SCALES.phrygian).toBeDefined();
      expect(SCALES.lydian).toBeDefined();
      expect(SCALES.mixolydian).toBeDefined();
      expect(SCALES.aeolian).toBeDefined();
      expect(SCALES.pentatonic).toBeDefined();
    });

    it("has correct interval counts", () => {
      expect(SCALES.ionian.intervals.length).toBe(7);
      expect(SCALES.pentatonic.intervals.length).toBe(5);
    });

    it("all scales start on root (0)", () => {
      for (const scale of Object.values(SCALES)) {
        expect(scale.intervals[0]).toBe(0);
      }
    });
  });

  describe("spectralClassToMode", () => {
    it("maps hot stars to bright modes", () => {
      expect(spectralClassToMode("O5")).toBe("lydian");
      expect(spectralClassToMode("B2")).toBe("ionian");
    });

    it("maps cool stars to darker modes", () => {
      expect(spectralClassToMode("K5")).toBe("aeolian");
      expect(spectralClassToMode("M2")).toBe("phrygian");
    });

    it("maps G-type to dorian", () => {
      expect(spectralClassToMode("G2V")).toBe("dorian");
    });

    it("handles missing spec gracefully", () => {
      expect(spectralClassToMode(undefined)).toBe("dorian");
      expect(spectralClassToMode("")).toBe("dorian");
    });
  });

  describe("temperatureToParams", () => {
    it("maps hot temperatures to high brightness", () => {
      const params = temperatureToParams(20000);
      expect(params.brightness).toBeGreaterThan(0.5);
      expect(params.warmth).toBeLessThan(0.5);
    });

    it("maps cool temperatures to high warmth", () => {
      const params = temperatureToParams(3500);
      expect(params.warmth).toBeGreaterThan(0.5);
      expect(params.brightness).toBeLessThan(0.5);
    });

    it("handles missing temperature", () => {
      const params = temperatureToParams(undefined);
      expect(params.brightness).toBeGreaterThan(0);
      expect(params.brightness).toBeLessThan(1);
    });
  });

  describe("starToBaseNote", () => {
    it("produces MIDI notes in valid range", () => {
      const hotStar: StarRecord = { id: "hot", ra: 0, dec: 0, mag: 1, temp: 20000 };
      const coolStar: StarRecord = { id: "cool", ra: 0, dec: 0, mag: 1, temp: 3500 };

      const hotNote = starToBaseNote(hotStar);
      const coolNote = starToBaseNote(coolStar);

      expect(hotNote).toBeGreaterThanOrEqual(36);
      expect(hotNote).toBeLessThanOrEqual(60);
      expect(coolNote).toBeGreaterThanOrEqual(36);
      expect(coolNote).toBeLessThanOrEqual(60);
    });

    it("hotter stars produce higher base notes", () => {
      const hotStar: StarRecord = { id: "hot", ra: 0, dec: 0, mag: 1, temp: 15000 };
      const coolStar: StarRecord = { id: "cool", ra: 0, dec: 0, mag: 1, temp: 4000 };

      expect(starToBaseNote(hotStar)).toBeGreaterThan(starToBaseNote(coolStar));
    });
  });

  describe("buildChord", () => {
    it("builds major chord correctly", () => {
      const chord = buildChord(60, "major");
      expect(chord.notes).toEqual([60, 64, 67]); // C, E, G
      expect(chord.quality).toBe("major");
    });

    it("builds minor chord correctly", () => {
      const chord = buildChord(60, "minor");
      expect(chord.notes).toEqual([60, 63, 67]); // C, Eb, G
      expect(chord.quality).toBe("minor");
    });

    it("builds sus4 chord correctly", () => {
      const chord = buildChord(60, "sus4");
      expect(chord.notes).toEqual([60, 65, 67]); // C, F, G
    });

    it("builds diminished chord correctly", () => {
      const chord = buildChord(60, "dim");
      expect(chord.notes).toEqual([60, 63, 66]); // C, Eb, Gb
    });
  });

  describe("openVoicing", () => {
    it("spreads chord notes across octaves", () => {
      const chord = buildChord(0, "major"); // C major (relative)
      const voicing = openVoicing(chord, 3);

      // Should have notes spread out
      expect(voicing.length).toBe(3);
      
      // Notes should be at least an octave apart between some
      const range = Math.max(...voicing) - Math.min(...voicing);
      expect(range).toBeGreaterThan(12);
    });
  });

  describe("generateChordProgression", () => {
    it("generates 2-4 chords", () => {
      const rng = new SeededRNG(42);
      const prog = generateChordProgression(SCALES.dorian, 48, rng);

      expect(prog.chords.length).toBeGreaterThanOrEqual(2);
      expect(prog.chords.length).toBeLessThanOrEqual(4);
      expect(prog.durations.length).toBe(prog.chords.length);
    });

    it("is deterministic with same seed", () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const prog1 = generateChordProgression(SCALES.dorian, 48, rng1);
      const prog2 = generateChordProgression(SCALES.dorian, 48, rng2);

      expect(prog1.chords.length).toBe(prog2.chords.length);
      expect(prog1.durations).toEqual(prog2.durations);
    });
  });

  describe("generateMotif", () => {
    it("generates motif of requested length", () => {
      const rng = new SeededRNG(42);
      const motif = generateMotif(SCALES.pentatonic, 48, rng, 4);

      expect(motif.notes.length).toBe(4);
      expect(motif.durations.length).toBe(4);
      expect(motif.velocities.length).toBe(4);
    });

    it("generates valid MIDI notes", () => {
      const rng = new SeededRNG(42);
      const motif = generateMotif(SCALES.dorian, 48, rng, 3);

      for (const note of motif.notes) {
        expect(note).toBeGreaterThanOrEqual(24);
        expect(note).toBeLessThanOrEqual(96);
      }
    });

    it("generates velocities in ambient range", () => {
      const rng = new SeededRNG(42);
      const motif = generateMotif(SCALES.dorian, 48, rng, 5);

      for (const vel of motif.velocities) {
        expect(vel).toBeGreaterThanOrEqual(20);
        expect(vel).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("generatePianoSequence", () => {
    it("generates sparse note events", () => {
      const rng = new SeededRNG(42);
      const chord = buildChord(48, "major");
      const events = generatePianoSequence(SCALES.dorian, 48, chord, 4, rng);

      // Sparse means not too many notes per measure
      expect(events.length).toBeLessThanOrEqual(16);
    });

    it("generates events with valid timing", () => {
      const rng = new SeededRNG(42);
      const chord = buildChord(48, "major");
      const events = generatePianoSequence(SCALES.dorian, 48, chord, 4, rng);

      for (const event of events) {
        expect(event.time).toBeGreaterThanOrEqual(0);
        expect(event.duration).toBeGreaterThan(0);
        expect(event.velocity).toBeGreaterThan(0);
      }
    });
  });

  describe("generateStringPadSequence", () => {
    it("generates events for each chord", () => {
      const rng = new SeededRNG(42);
      const prog = generateChordProgression(SCALES.dorian, 48, rng);
      
      const rng2 = new SeededRNG(42);
      const events = generateStringPadSequence(prog, rng2);

      // Should have at least 3 notes per chord (triad voicing)
      expect(events.length).toBeGreaterThanOrEqual(prog.chords.length * 3);
    });

    it("generates soft velocities for pad", () => {
      const rng = new SeededRNG(42);
      const prog = generateChordProgression(SCALES.dorian, 48, rng);
      
      const rng2 = new SeededRNG(42);
      const events = generateStringPadSequence(prog, rng2);

      for (const event of events) {
        expect(event.velocity).toBeLessThanOrEqual(70);
      }
    });
  });

  describe("generatePatternFromStar", () => {
    it("generates complete pattern", () => {
      const pattern = generatePatternFromStar(testStar, 42);

      expect(pattern.pianoEvents).toBeDefined();
      expect(pattern.stringEvents).toBeDefined();
      expect(pattern.config).toBeDefined();
      expect(pattern.chordProgression).toBeDefined();
      expect(pattern.cycleDuration).toBeGreaterThan(0);
    });

    it("is deterministic with same seed", () => {
      const pattern1 = generatePatternFromStar(testStar, 42);
      const pattern2 = generatePatternFromStar(testStar, 42);

      expect(pattern1.cycleDuration).toBe(pattern2.cycleDuration);
      expect(pattern1.config.tempo).toBe(pattern2.config.tempo);
    });

    it("varies with different seeds", () => {
      const pattern1 = generatePatternFromStar(testStar, 42);
      const pattern2 = generatePatternFromStar(testStar, 999);

      // At least some aspect should differ
      const identical = 
        pattern1.cycleDuration === pattern2.cycleDuration &&
        pattern1.pianoEvents.length === pattern2.pianoEvents.length;

      expect(identical).toBe(false);
    });

    it("generates appropriate tempo for star", () => {
      const pattern = generatePatternFromStar(testStar, 42);

      // Ambient tempo should be slow (55-80 BPM per spec)
      expect(pattern.config.tempo).toBeGreaterThanOrEqual(55);
      expect(pattern.config.tempo).toBeLessThanOrEqual(85);
    });
  });

  describe("MIDI Utilities", () => {
    it("midiToNoteName converts correctly", () => {
      expect(midiToNoteName(60)).toBe("C4");
      expect(midiToNoteName(69)).toBe("A4");
      expect(midiToNoteName(48)).toBe("C3");
      expect(midiToNoteName(61)).toBe("C#4");
      expect(midiToNoteName(36)).toBe("C2");
    });

    it("noteNameToMidi converts correctly", () => {
      expect(noteNameToMidi("C4")).toBe(60);
      expect(noteNameToMidi("A4")).toBe(69);
      expect(noteNameToMidi("C3")).toBe(48);
      expect(noteNameToMidi("C#4")).toBe(61);
    });

    it("round-trips correctly", () => {
      for (let midi = 24; midi <= 96; midi++) {
        const name = midiToNoteName(midi);
        expect(noteNameToMidi(name)).toBe(midi);
      }
    });
  });
});
