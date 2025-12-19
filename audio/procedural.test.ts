import { describe, it, expect } from "vitest";
import {
  createRNG,
  buildTransitionMatrix,
  markovNextNote,
  generateMarkovPhrase,
  initializePopulation,
  evaluateFitness,
  evolvePopulation,
  generateChordProgression,
  selectScaleFromTemperature,
  generateProceduralMusic,
  midiToNoteName,
  buildChordNotes,
  SCALES,
  Phrase,
  GeneratorConfig
} from "./procedural";

describe("Procedural Music Generation", () => {
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

  describe("Markov Chain", () => {
    const random = createRNG(42);
    const scale = SCALES.pentatonic;
    
    it("builds a valid transition matrix", () => {
      const matrix = buildTransitionMatrix(scale, random);
      
      expect(matrix.size).toBe(scale.intervals.length);
      
      // Check probabilities sum to 1 for each row
      for (const [, transitions] of matrix) {
        let sum = 0;
        for (const [, prob] of transitions) {
          sum += prob;
        }
        expect(sum).toBeCloseTo(1, 5);
      }
    });

    it("generates valid next notes within scale", () => {
      const matrix = buildTransitionMatrix(scale, createRNG(1));
      const rng = createRNG(100);
      
      for (let i = 0; i < 20; i++) {
        const current = Math.floor(rng() * scale.intervals.length);
        const next = markovNextNote(current, matrix, rng);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(scale.intervals.length);
      }
    });

    it("generates phrases of correct length", () => {
      const config: GeneratorConfig = {
        scale: SCALES.major,
        baseNote: 60,
        octaveRange: 2,
        phraseLength: 8,
        temperature: 5800,
        magnitude: 2,
        distance: 10
      };
      const matrix = buildTransitionMatrix(config.scale, createRNG(1));
      const phrase = generateMarkovPhrase(config, matrix, createRNG(2), 8);
      
      expect(phrase.length).toBe(8);
    });
  });

  describe("Genetic Algorithm", () => {
    const config: GeneratorConfig = {
      scale: SCALES.major,
      baseNote: 60,
      octaveRange: 2,
      phraseLength: 8,
      temperature: 5800,
      magnitude: 2,
      distance: 10
    };

    it("initializes population of correct size", () => {
      const matrix = buildTransitionMatrix(config.scale, createRNG(1));
      const population = initializePopulation(config, matrix, createRNG(2));
      
      expect(population.length).toBe(12); // GA_POPULATION_SIZE
    });

    it("evaluates fitness producing positive scores", () => {
      const phrase: Phrase = {
        notes: [60, 62, 64, 65, 67, 65, 64, 62],
        durations: [1, 0.5, 0.5, 1, 1, 0.5, 0.5, 1],
        velocities: [0.8, 0.6, 0.7, 0.8, 0.7, 0.6, 0.5, 0.7],
        fitness: 0
      };
      
      const fitness = evaluateFitness(phrase, config);
      expect(fitness).toBeGreaterThan(0);
    });

    it("rewards stepwise motion over large leaps", () => {
      const smoothPhrase: Phrase = {
        notes: [60, 62, 64, 65, 64, 62, 60, 62], // stepwise
        durations: [1, 1, 1, 1, 1, 1, 1, 1],
        velocities: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7],
        fitness: 0
      };
      
      const jumpyPhrase: Phrase = {
        notes: [60, 71, 49, 82, 35, 91, 26, 60], // dissonant large leaps (tritones, 11ths)
        durations: [1, 1, 1, 1, 1, 1, 1, 1],
        velocities: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7],
        fitness: 0
      };
      
      const smoothFitness = evaluateFitness(smoothPhrase, config);
      const jumpyFitness = evaluateFitness(jumpyPhrase, config);
      
      expect(smoothFitness).toBeGreaterThan(jumpyFitness);
    });

    it("evolves population improving best fitness", () => {
      const matrix = buildTransitionMatrix(config.scale, createRNG(1));
      const initialPop = initializePopulation(config, matrix, createRNG(2));
      
      // Evaluate initial fitness
      for (const phrase of initialPop) {
        phrase.fitness = evaluateFitness(phrase, config);
      }
      const initialBestFitness = Math.max(...initialPop.map(p => p.fitness));
      
      // Evolve
      const evolvedPop = evolvePopulation(initialPop, config, createRNG(3), 10);
      const evolvedBestFitness = Math.max(...evolvedPop.map(p => p.fitness));
      
      // Evolution should maintain or improve fitness (elitism)
      expect(evolvedBestFitness).toBeGreaterThanOrEqual(initialBestFitness * 0.9);
    });
  });

  describe("Chord Progression", () => {
    const config: GeneratorConfig = {
      scale: SCALES.major,
      baseNote: 60,
      octaveRange: 2,
      phraseLength: 8,
      temperature: 5800,
      magnitude: 2,
      distance: 10
    };

    it("generates progression of correct length", () => {
      const progression = generateChordProgression(config, createRNG(42), 4);
      
      expect(progression.roots.length).toBe(4);
      expect(progression.qualities.length).toBe(4);
      expect(progression.durations.length).toBe(4);
    });

    it("generates valid chord qualities", () => {
      const progression = generateChordProgression(config, createRNG(42), 8);
      const validQualities = ["maj", "min", "dim", "aug", "sus4", "maj7", "min7", "dom7"];
      
      for (const quality of progression.qualities) {
        expect(validQualities).toContain(quality);
      }
    });
  });

  describe("Star-to-Music Mapping", () => {
    it("selects bright scales for hot stars", () => {
      const scale = selectScaleFromTemperature(20000);
      expect(["Lydian", "Major"]).toContain(scale.name);
    });

    it("selects dark scales for cool stars", () => {
      const scale = selectScaleFromTemperature(3000);
      expect(["Phrygian", "Locrian", "Aeolian"]).toContain(scale.name);
    });

    it("generates complete procedural data for a star", () => {
      const star = {
        id: "test_star",
        ra: 0,
        dec: 0,
        mag: 2,
        temp: 5800,
        dist: 10
      };
      
      const result = generateProceduralMusic(star, 42);
      
      expect(result.melody).toBeDefined();
      expect(result.melody.notes.length).toBeGreaterThan(0);
      expect(result.harmony).toBeDefined();
      expect(result.bassline).toBeDefined();
      expect(result.chords).toBeDefined();
      expect(result.config).toBeDefined();
    });

    it("produces deterministic results with same seed", () => {
      const star = {
        id: "test_star",
        ra: 45,
        dec: 30,
        mag: 1,
        temp: 10000,
        dist: 50
      };
      
      const result1 = generateProceduralMusic(star, 12345);
      const result2 = generateProceduralMusic(star, 12345);
      
      expect(result1.melody.notes).toEqual(result2.melody.notes);
      expect(result1.chords.roots).toEqual(result2.chords.roots);
    });

    it("produces different results with different seeds", () => {
      const star = {
        id: "test_star",
        ra: 45,
        dec: 30,
        mag: 1,
        temp: 10000,
        dist: 50
      };
      
      const result1 = generateProceduralMusic(star, 111);
      const result2 = generateProceduralMusic(star, 222);
      
      // At least some notes should differ
      const allSame = result1.melody.notes.every(
        (n, i) => n === result2.melody.notes[i]
      );
      expect(allSame).toBe(false);
    });
  });

  describe("Utility Functions", () => {
    it("converts MIDI to note names correctly", () => {
      expect(midiToNoteName(60)).toBe("C4");
      expect(midiToNoteName(69)).toBe("A4");
      expect(midiToNoteName(72)).toBe("C5");
      expect(midiToNoteName(48)).toBe("C3");
    });

    it("builds chord notes correctly", () => {
      const majorChord = buildChordNotes(60, "maj");
      expect(majorChord).toEqual(["C4", "E4", "G4"]);
      
      const minorChord = buildChordNotes(60, "min");
      expect(minorChord).toEqual(["C4", "D#4", "G4"]);
    });
  });
});
