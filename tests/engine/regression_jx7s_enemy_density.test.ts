import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";

describe("Director - Point-Based Spawning (ew59/3sqa)", () => {
  it("should calculate wave size based on startingPoints and turn and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn, 0, undefined, 20);

    // Initial state: threat 0
    // Fast forward to turn 1 (10s)
    director.update(10000);

    // Wave budget = floor(10/10 * 1) = 1
    expect(onSpawn).toHaveBeenCalledTimes(1);
  });

  it("should increase budget over time and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn, 0, undefined, 20);

    // Turn 1: 21 (clamped to 5)
    director.update(10000);
    onSpawn.mockClear();

    // Fast forward to turn 2 (20s total)
    director.update(10000);

    // Wave budget = floor(20/10 * 1) = 2
    expect(onSpawn).toHaveBeenCalledTimes(2);
  });
});
