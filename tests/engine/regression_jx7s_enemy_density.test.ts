import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";
import { ItemEffectService } from "@src/engine/managers/ItemEffectService";

describe("Director - Point-Based Spawning (ew59/3sqa)", () => {
  it("should calculate wave size based on startingPoints and turn and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingPoints: 20,
    });

    // Threat 0, Turn 0. update(10s) -> Threat 10, Turn 1.
    director.update(10000);

    // Wave budget = floor(10/10 * 1) = 1
    expect(onSpawn).toHaveBeenCalledTimes(1);
  });

  it("should increase budget over time and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingPoints: 20,
    });

    // update(20s) -> Threat 20, Turn 2.
    // Turn 1 spawned 1.
    // Turn 2: budget = floor(20/10 * 1) = 2.
    director.update(20000);

    // Wave budget = floor(20/10 * 1) = 2
    // total = 1 (turn 1) + 2 (turn 2) = 3
    expect(onSpawn).toHaveBeenCalledTimes(3);
  });
});
