import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";
import { ItemEffectService } from "@src/engine/managers/ItemEffectService";
import { EnemyType } from "@src/shared/types";

describe("Director Wave Budgeting & Tier Locking", () => {
  it("should spawn only 1pt enemies (Xeno-Mites) when threat < 30% and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
    });

    // Wave budget at turn 1 (threat 10): floor(10/10 * 1.0) = 1 point
    director.update(10000);
    expect(onSpawn).toHaveBeenCalledTimes(1);

    const spawnedEnemies = onSpawn.mock.calls.map((call) => call[0]);
    spawnedEnemies.forEach((e) => {
      expect(e.type).toBe(EnemyType.XenoMite);
      expect(e.difficulty).toBe(1);
    });
  });

  it("should spawn up to 3pt enemies when threat is between 30% and 60% and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingThreatLevel: 30,
    });

    // Advance 1 turn (to threat 40)
    director.update(10000);

    expect(director.getThreatLevel()).toBe(40);

    // Wave budget at turn 4 (threat 40): floor(40/10 * 1.0) = 4 points
    // This can be 1x Warrior(3) + 1x Mite(1) or 4x Mites(1)
    expect(onSpawn).toHaveBeenCalled();
    const totalDifficulty = onSpawn.mock.calls.reduce(
      (sum, call) => sum + call[0].difficulty,
      0,
    );
    expect(totalDifficulty).toBe(4);

    const spawnedEnemies = onSpawn.mock.calls.map((call) => call[0]);
    spawnedEnemies.forEach((e) => {
      // Should not be higher than 3pts
      expect(e.difficulty).toBeLessThanOrEqual(3);
    });
  });

  it("should correctly handle starting points for budget and respect WAVE_CAP", () => {
    const mockMap = {
      width: 10,
      height: 10,
      cells: [
        { x: 0, y: 0, type: "Floor" as any, roomId: "room-1" },
        { x: 9, y: 9, type: "Floor" as any, roomId: "room-2" },
      ],
      squadSpawn: { x: 0, y: 0 },
    };
    const spawnPoints = [{ id: "sp1", pos: { x: 9, y: 9 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingPoints: 50,
      map: mockMap as any,
    });

    // Threat 0, turn 0. preSpawn should use startingPoints.
    director.preSpawn();

    // Budget = startingPoints = 50. Wave cap = 5.
    // 50 points / (max 5 pts per wave) = 10 waves of 5 difficulty.
    // Actually, preSpawnFromPoints(50) spends all 50.
    const totalDifficulty = onSpawn.mock.calls.reduce(
      (sum, call) => sum + call[0].difficulty,
      0,
    );
    expect(totalDifficulty).toBe(50);

    vi.clearAllMocks();
    // Turn 1 (threat 10)
    director.update(10000);

    // Budget = floor(10/10 * 1.0) = 1
    expect(onSpawn).toHaveBeenCalledTimes(1);
  });
});
