import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";

describe("Director - Configurable Enemy Density (jx7s)", () => {
  it("should calculate wave size based on baseEnemyCount, missionDepth and turn", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    
    // Campaign Mission 1 (Depth 0), Base 3, Growth 1
    // WaveSize = 3 + (0 * 1) + turn
    const director = new Director(spawnPoints, prng, onSpawn, 0, 3, 1, 0);

    // Turn 1 (10s)
    director.update(10000);
    // count = 3 + 0 + 1 = 4
    expect(onSpawn).toHaveBeenCalledTimes(4);
    
    onSpawn.mockClear();
    
    // Turn 2 (20s)
    director.update(10000);
    // count = 3 + 0 + 2 = 5
    expect(onSpawn).toHaveBeenCalledTimes(5);
  });

  it("should scale with missionDepth", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    
    // Campaign Mission 5 (Depth 4), Base 3, Growth 1
    // WaveSize = 3 + (4 * 1) + turn = 7 + turn
    const director = new Director(spawnPoints, prng, onSpawn, 0, 3, 1, 4);

    // Turn 1 (10s)
    director.update(10000);
    // count = 7 + 1 = 8
    expect(onSpawn).toHaveBeenCalledTimes(8);
  });

  it("should respect configurable growth per mission", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    
    // Depth 2, Base 3, Growth 2
    // WaveSize = 3 + (2 * 2) + turn = 7 + turn
    const director = new Director(spawnPoints, prng, onSpawn, 0, 3, 2, 2);

    // Turn 1 (10s)
    director.update(10000);
    // count = 7 + 1 = 8
    expect(onSpawn).toHaveBeenCalledTimes(8);
  });
});
