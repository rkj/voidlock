import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";

describe("Director", () => {
  it("should spawn enemies after turnDuration", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn);

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
    // At Turn 1, count = (3 + 0*1) + 1 = 4
    expect(onSpawn).toHaveBeenCalledTimes(4);
    expect(director.getThreatLevel()).toBe(10);
  });

  it("should increase threat and spawn more enemies in later turns", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn);

    // Fast forward to turn 5
    // Turn 1: 4
    // Turn 2: 5
    // Turn 3: 6
    // Turn 4: 7
    // Turn 5: 8
    // Total: 4+5+6+7+8 = 30
    for (let i = 0; i < 5; i++) {
      director.update(10000);
    }

    expect(onSpawn).toHaveBeenCalledTimes(30);
    expect(director.getThreatLevel()).toBe(50);
  });

  it("should handle large dt", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn);

    // 100 seconds
    director.update(100000);

    // Turn 1 (10s): 4
    // Turn 2 (20s): 5
    // ...
    // Turn 10 (100s): 13
    // Total: 4+5+6+7+8+9+10+11+12+13 = 85
    expect(onSpawn).toHaveBeenCalledTimes(85);
  });

  it("should exceed 100% threat", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn);

    // 110 seconds = Turn 11
    director.update(110000);

    expect(director.getThreatLevel()).toBe(110);
    // At turn 11, scalingTurn is capped at 10, so count is 13.
    // Total for turn 11 should be previous 85 + 13 = 98.
    expect(onSpawn).toHaveBeenCalledTimes(98);
  });

  it("should initialize with startingThreatLevel and preSpawn enemies", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();

    // 30% threat means we are at Turn 3 start.
    // Completed turns: 0, 1, 2.
    // Wave 0: 3 enemies (turn 0)
    // Wave 1: 4 enemies (turn 1)
    // Wave 2: 5 enemies (turn 2)
    // Total pre-spawn = 3 + 4 + 5 = 12
    const director = new Director(spawnPoints, prng, onSpawn, 30);
    director.preSpawn();

    expect(director.getThreatLevel()).toBe(30);
    expect(onSpawn).toHaveBeenCalledTimes(12);
  });

  it("should not preSpawn if threat <= 10", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();

    const director = new Director(spawnPoints, prng, onSpawn, 10);
    director.preSpawn();

    expect(director.getThreatLevel()).toBe(10);
    expect(onSpawn).not.toHaveBeenCalled();
  });
});
