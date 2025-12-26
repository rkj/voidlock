import { describe, it, expect, vi } from "vitest";
import { Director } from "./Director";
import { PRNG } from "../shared/PRNG";
import { Enemy, EnemyType } from "../shared/types";

describe("Director", () => {
  it("should spawn enemies after turnDuration", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn);

    // Initial state
    expect(onSpawn).not.toHaveBeenCalled();
    expect(director.getThreatLevel()).toBe(0);

    // Update with dt < turnDuration
    director.update(10000);
    expect(onSpawn).not.toHaveBeenCalled();
    expect(director.getThreatLevel()).toBeGreaterThan(0);
    expect(director.getThreatLevel()).toBeLessThan(10);

    // Update to reach turnDuration (30s)
    director.update(20000);
    expect(onSpawn).toHaveBeenCalled();
    // At Turn 1, count = 1 + 1 = 2
    expect(onSpawn).toHaveBeenCalledTimes(2);
    expect(director.getThreatLevel()).toBe(10);
  });

  it("should increase threat and spawn more enemies in later turns", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn);

    // Fast forward to turn 5
    // Turn 1: 2
    // Turn 2: 3
    // Turn 3: 4
    // Turn 4: 5
    // Turn 5: 6
    // Total: 2+3+4+5+6 = 20
    for (let i = 0; i < 5; i++) {
        director.update(30000);
    }

    expect(onSpawn).toHaveBeenCalledTimes(20);
    expect(director.getThreatLevel()).toBe(50);
  });

  it("should handle large dt", () => {
     const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
     const prng = new PRNG(123);
     const onSpawn = vi.fn();
     const director = new Director(spawnPoints, prng, onSpawn);

     // 100 seconds
     director.update(100000);

     // Turn 1 (30s): 2 enemies
     // Turn 2 (60s): 3 enemies
     // Turn 3 (90s): 4 enemies
     // Total should be 2 + 3 + 4 = 9
     expect(onSpawn).toHaveBeenCalledTimes(9);
  });
});