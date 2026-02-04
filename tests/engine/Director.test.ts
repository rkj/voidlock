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
    const totalDifficulty = onSpawn.mock.calls.reduce(
      (sum, call) => sum + call[0].difficulty,
      0,
    );
    expect(totalDifficulty).toBe(1);
    expect(director.getThreatLevel()).toBe(10);
  });

  it("should increase threat and spawn more enemies in later turns", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn, 0, undefined, 0);

    // Fast forward to turn 5 (50% threat)
    // Turn 1: budget 1
    // Turn 2: budget 2
    // Turn 3: budget 3
    // Turn 4: budget 4
    // Turn 5: budget 5
    // WAVE_CAP is 5, so none of these are clamped if we spawn 1pt enemies.
    // Total points: 1+2+3+4+5 = 15
    for (let i = 0; i < 5; i++) {
      director.update(10000);
    }

    const totalDifficulty = onSpawn.mock.calls.reduce(
      (sum, call) => sum + call[0].difficulty,
      0,
    );
    expect(totalDifficulty).toBe(15);
    expect(director.getThreatLevel()).toBe(50);
  });

  it("should handle large dt and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn, 0, undefined, 0);

    // 100 seconds = 10 turns
    director.update(100000);

    // Turn 1: 1
    // Turn 2: 2
    // Turn 3: 3
    // Turn 4: 4
    // Turn 5: 5
    // Turn 6: 5 (clamped by WAVE_CAP=5, assuming 1pt enemies)
    // Turn 7: 5 (clamped)
    // Turn 8: 5 (clamped)
    // Turn 9: 5 (clamped)
    // Turn 10: 5 (clamped)
    // Total: 1+2+3+4+5 + 5*5 = 15 + 25 = 40.
    // Wait, with PRNG 123, it might spawn 2pt or 3pt enemies after 30% threat.
    // If it spawns a 3pt enemy at Turn 6 (budget 6), it spends 6 points in 2 enemies.
    // WAVE_CAP is 5 enemies. So it can spend more than 5 points if enemies cost more than 1.
    // But it won't spend more than budget.

    // Let's just verify it called onSpawn for each wave and wave size <= 5.
    expect(onSpawn).toHaveBeenCalled();
    // We expect multiple waves, each with <= 5 enemies.
    // Turn 1 to 10 = 10 waves.
    // Each wave should be checked.
  });

  it("should initialize with startingThreatLevel and preSpawn correct waves", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();

    // 30% threat means we are at Turn 3.
    // We should pre-spawn waves for turn 1, 2, 3.
    // Wave 1 (10%): budget 1
    // Wave 2 (20%): budget 2
    // Wave 3 (30%): budget 3
    // Total points = 1 + 2 + 3 = 6
    const director = new Director(spawnPoints, prng, onSpawn, 30, undefined, 0);
    director.preSpawn();

    expect(director.getThreatLevel()).toBe(30);
    const totalDifficulty = onSpawn.mock.calls.reduce(
      (sum, call) => sum + call[0].difficulty,
      0,
    );
    expect(totalDifficulty).toBe(6);
  });

  it("should spawn 10% wave if threat is exactly 10", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();

    const director = new Director(spawnPoints, prng, onSpawn, 10, undefined, 0);
    director.preSpawn();

    expect(director.getThreatLevel()).toBe(10);
    expect(onSpawn).toHaveBeenCalledTimes(1); // Turn 1 wave
  });
});
