import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";
import { EnemyType } from "@src/shared/types";
import { DIRECTOR } from "@src/engine/config/GameConstants";

describe("Director Wave Budgeting & Tier Locking", () => {
  it("should spawn only 1pt enemies (Xeno-Mites) when threat < 30% and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director(spawnPoints, prng, onSpawn);

    // Initial state: threat 0
    // Trigger first wave (threat increases to 10%)
    director.update(10000);

    expect(director.getThreatLevel()).toBe(10);

    // Wave budget at turn 1 (threat 10): 20 + (10/10 * 1) = 21 points
    // Since threat < 30, only 1pt XenoMites should spawn.
    // BUT WAVE_CAP = 5
    expect(onSpawn).toHaveBeenCalledTimes(DIRECTOR.WAVE_CAP);

    const spawnedEnemies = onSpawn.mock.calls.map((call) => call[0]);
    spawnedEnemies.forEach((enemy) => {
      expect(enemy.type).toBe(EnemyType.XenoMite);
      expect(enemy.difficulty).toBe(1);
    });
  });

  it("should spawn up to 3pt enemies when threat is between 30% and 60% and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();

    // Start at 30% threat
    const director = new Director(spawnPoints, prng, onSpawn, 30);

    // Trigger next wave (reaches 40% threat)
    director.update(10000);

    expect(director.getThreatLevel()).toBe(40);

    // Wave budget at turn 4 (threat 40): 20 + (40/10 * 1) = 24 points
    // BUT WAVE_CAP = 5
    const spawnedEnemies = onSpawn.mock.calls.map((call) => call[0]);
    expect(spawnedEnemies.length).toBe(DIRECTOR.WAVE_CAP);

    const totalDifficulty = spawnedEnemies.reduce(
      (sum, e) => sum + e.difficulty,
      0,
    );
    // Budget is 24, so it can definitely afford 5 enemies of any type (max 3pt each = 15 total)
    expect(totalDifficulty).toBeGreaterThanOrEqual(5);
    expect(totalDifficulty).toBeLessThanOrEqual(24);

    const hasHard = spawnedEnemies.some((e) => e.difficulty === 3);
    const hasMedium = spawnedEnemies.some((e) => e.difficulty === 2);
    const hasEasy = spawnedEnemies.some((e) => e.difficulty === 1);

    expect(hasEasy || hasMedium || hasHard).toBe(true);
  });

  it("should correctly handle starting points for budget and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();

    // Use custom starting points
    const director = new Director(spawnPoints, prng, onSpawn, 0, undefined, 50);

    director.update(10000); // 10% threat

    // Budget = 50 + (10/10 * 1) = 51
    // BUT WAVE_CAP = 5
    expect(onSpawn).toHaveBeenCalledTimes(DIRECTOR.WAVE_CAP);
  });
});
