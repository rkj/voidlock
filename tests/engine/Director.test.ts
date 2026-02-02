import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";

describe("Director", () => {
  it("should spawn enemies after turnDuration", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn, 0, undefined, 0);

    // Initial state
    expect(onSpawn).not.toHaveBeenCalled();
    expect(director.getThreatLevel()).toBe(0);

    // Update with dt < turnDuration (10s)
    director.update(5000);
    expect(onSpawn).not.toHaveBeenCalled();
    expect(director.getThreatLevel()).toBe(5);

    // Update to reach turnDuration (10s)
    director.update(5000);
    expect(onSpawn).toHaveBeenCalled();
    // At Turn 1, budget = 0 + (10/10 * 1) = 1
    const totalDifficulty = onSpawn.mock.calls.reduce((sum, call) => sum + call[0].difficulty, 0);
    expect(totalDifficulty).toBe(1);
    expect(director.getThreatLevel()).toBe(10);
  });

  it("should increase threat and spawn more enemies in later turns", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn, 0, undefined, 0);

    // Fast forward to turn 5
    // Turn 1: 1
    // Turn 2: 2
    // Turn 3: 3
    // Turn 4: 4
    // Turn 5: 5
    // Total points: 1+2+3+4+5 = 15
    for (let i = 0; i < 5; i++) {
      director.update(10000);
    }

    const totalDifficulty = onSpawn.mock.calls.reduce((sum, call) => sum + call[0].difficulty, 0);
    expect(totalDifficulty).toBe(15);
    expect(director.getThreatLevel()).toBe(50);
  });

  it("should handle large dt", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn, 0, undefined, 0);

    // 100 seconds
    director.update(100000);

    // Turn 1..10 Total points: 55
    const totalDifficulty = onSpawn.mock.calls.reduce((sum, call) => sum + call[0].difficulty, 0);
    expect(totalDifficulty).toBe(55);
  });

  it("should exceed 100% threat", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn, 0, undefined, 0);

    // 110 seconds = Turn 11
    director.update(110000);

    expect(director.getThreatLevel()).toBe(110);
    // Total for 11 turns: 55 + 11 = 66 points
    const totalDifficulty = onSpawn.mock.calls.reduce((sum, call) => sum + call[0].difficulty, 0);
    expect(totalDifficulty).toBe(66);
  });

  it("should initialize with startingThreatLevel and preSpawn enemies", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();

    // 30% threat means we are at Turn 3 start.
    // Completed turns: 0, 1, 2.
    // Wave 0: 0 (startingPoints=0)
    // Wave 1: 1
    // Wave 2: 2
    // Total pre-spawn = 0 + 1 + 2 = 3 points
    const director = new Director(spawnPoints, prng, onSpawn, 30, undefined, 0);
    director.preSpawn();

    expect(director.getThreatLevel()).toBe(30);
    const totalDifficulty = onSpawn.mock.calls.reduce((sum, call) => sum + call[0].difficulty, 0);
    expect(totalDifficulty).toBe(3);
  });

  it("should not preSpawn if threat <= 10", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();

    const director = new Director(spawnPoints, prng, onSpawn, 10, undefined, 0);
    director.preSpawn();

    expect(director.getThreatLevel()).toBe(10);
    expect(onSpawn).not.toHaveBeenCalled();
  });
});