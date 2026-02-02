import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";

describe("Director - Point-Based Spawning (ew59/3sqa)", () => {
  it("should calculate wave size based on startingPoints and turn", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn, 0, 3, 1, 0, undefined, 20);

    // Initial state: threat 0
    // Fast forward to turn 1 (10s)
    director.update(10000);
    
    // Wave budget = floor(20 + (10/10 * 1)) = 21
    expect(onSpawn).toHaveBeenCalledTimes(21);
  });

  it("should increase budget over time", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn, 0, 3, 1, 0, undefined, 20);

    // Turn 1: 21
    director.update(10000);
    onSpawn.mockClear();

    // Fast forward to turn 2 (20s total)
    director.update(10000);
    
    // Wave budget = floor(20 + (20/10 * 1)) = 22
    expect(onSpawn).toHaveBeenCalledTimes(22);
  });
});