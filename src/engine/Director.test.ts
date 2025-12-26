import { describe, it, expect, vi } from "vitest";
import { Director } from "./Director";
import { SpawnPoint, Enemy, EnemyType } from "../shared/types";
import { PRNG } from "../shared/PRNG";

describe("Director", () => {
  it("should not spawn enemies before turn duration (45s)", () => {
    const spawnPoints: SpawnPoint[] = [
      { id: "sp1", pos: { x: 5, y: 5 }, radius: 1 },
    ];
    const onSpawn = vi.fn();
    const prng = new PRNG(123);
    const director = new Director(spawnPoints, prng, onSpawn);

    // Update 44.9s
    director.update(44900);
    expect(onSpawn).not.toHaveBeenCalled();
  });

  it("should spawn wave at 45s (Turn 1)", () => {
    const spawnPoints: SpawnPoint[] = [
      { id: "sp1", pos: { x: 5, y: 5 }, radius: 1 },
    ];
    const onSpawn = vi.fn();
    const prng = new PRNG(123);
    const director = new Director(spawnPoints, prng, onSpawn);

    // Update 45s
    director.update(45000);
    
    // Turn 1 starts. Wave Size = 1 (base) + 1 (Turn 1) = 2.
    // Wait, let's check my logic in implementation.
    // scalingTurn = Math.min(turn, 10).
    // At update(45000), turn increments to 1.
    // spawnWave() called.
    // count = 1 + scalingTurn = 1 + 1 = 2.
    expect(onSpawn).toHaveBeenCalledTimes(2);
  });

  it("should increase threat level linearly", () => {
    const spawnPoints: SpawnPoint[] = [
      { id: "sp1", pos: { x: 0, y: 0 }, radius: 1 },
    ];
    const onSpawn = vi.fn();
    const prng = new PRNG(123);
    const director = new Director(spawnPoints, prng, onSpawn);

    // Turn 0, Time 0 -> Threat 0
    expect(director.getThreatLevel()).toBe(0);

    // Turn 0, Time 22.5s -> Threat 5
    director.update(22500);
    expect(director.getThreatLevel()).toBeCloseTo(5);

    // Turn 0, Time 45s (Tick) -> Turn 1, Time 0 -> Threat 10
    director.update(22500); 
    expect(director.getThreatLevel()).toBe(10);
  });

  it("should increase wave size with turns", () => {
    const spawnPoints: SpawnPoint[] = [
      { id: "sp1", pos: { x: 0, y: 0 }, radius: 1 },
    ];
    const onSpawn = vi.fn();
    const prng = new PRNG(123);
    const director = new Director(spawnPoints, prng, onSpawn);

    // Turn 1 Spawn (45s) -> Size 2 (Base 1 + Turn 1)
    director.update(45000);
    expect(onSpawn).toHaveBeenCalledTimes(2);
    onSpawn.mockClear();

    // Turn 2 Spawn (90s) -> Size 3 (Base 1 + Turn 2)
    director.update(45000);
    expect(onSpawn).toHaveBeenCalledTimes(3);
  });

  it("should cap threat and wave size at turn 10", () => {
    const spawnPoints: SpawnPoint[] = [
      { id: "sp1", pos: { x: 0, y: 0 }, radius: 1 },
    ];
    const onSpawn = vi.fn();
    const prng = new PRNG(123);
    const director = new Director(spawnPoints, prng, onSpawn);

    // Advance to Turn 10 (10 * 45s = 450s)
    for(let i=0; i<10; i++) {
        director.update(45000);
    }
    // Now at Turn 10, Time 0. Threat should be 100.
    expect(director.getThreatLevel()).toBe(100);

    // Advance more -> Turn 11. Threat still 100.
    director.update(45000);
    expect(director.getThreatLevel()).toBe(100);

    // Turn 11 Spawn check
    // Logic: scalingTurn = min(11, 10) = 10.
    // Count = 1 + 10 = 11.
    // Total calls in this update loop = 11.
    onSpawn.mockClear();
    director.update(45000); // Trigger Turn 12 spawn
    expect(onSpawn).toHaveBeenCalledTimes(11);
  });
});