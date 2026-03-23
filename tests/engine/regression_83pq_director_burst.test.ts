import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";
import { ItemEffectService } from "@src/engine/managers/ItemEffectService";
import { DIRECTOR } from "@src/engine/config/GameConstants";

describe("Director Spawning Logic (Regression 83pq)", () => {
  it("should enforce wave cap of 5 enemies during updates", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingPoints: 0,
    });

    // Fast forward to Turn 11 (threat 110)
    // budget = floor(110/10 * 1.0) = 11 points
    for (let i = 0; i < 11; i++) {
      director.update(DIRECTOR.TURN_DURATION_MS);
    }

    // Turn 11 budget = 11. Wave cap = 5.
    // Each onSpawn call is one enemy (difficulty 1 for Mite).
    // So expect EXACTLY 5 enemies spawned in the LAST wave.
    
    // Let's check only the last wave.
    vi.clearAllMocks();
    director.update(DIRECTOR.TURN_DURATION_MS); // Turn 12, threat 120, budget 12, cap 5
    expect(onSpawn.mock.calls.length).toBe(5);
  });

  it("should only spawn at 10% threat increments", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
    });

    // 0 to 5% threat -> No spawn
    director.update(DIRECTOR.TURN_DURATION_MS / 2);
    expect(onSpawn).not.toHaveBeenCalled();

    // 5 to 10% threat -> Trigger
    director.update(DIRECTOR.TURN_DURATION_MS / 2);
    expect(onSpawn).toHaveBeenCalled();

    vi.clearAllMocks();

    // 10 to 15% threat -> No spawn
    director.update(DIRECTOR.TURN_DURATION_MS / 2);
    expect(onSpawn).not.toHaveBeenCalled();

    // 15 to 20% threat -> Trigger
    director.update(DIRECTOR.TURN_DURATION_MS / 2);
    expect(onSpawn).toHaveBeenCalled();
  });
});
