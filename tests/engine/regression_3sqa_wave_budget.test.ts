import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";
import { DIRECTOR } from "@src/engine/config/GameConstants";
import { EnemyType } from "@src/shared/types";

describe("Director Wave Budgeting & Tier Locking", () => {
  it("should spawn only 1pt enemies (Xeno-Mites) when threat < 30%", () => {
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
    // Total enemies = 21
    expect(onSpawn).toHaveBeenCalledTimes(21);
    
    const spawnedEnemies = onSpawn.mock.calls.map(call => call[0]);
    spawnedEnemies.forEach(enemy => {
      expect(enemy.type).toBe(EnemyType.XenoMite);
      expect(enemy.difficulty).toBe(1);
    });
  });

  it("should spawn up to 3pt enemies when threat is between 30% and 60%", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    
    // Start at 30% threat
    const director = new Director(spawnPoints, prng, onSpawn, 30);
    
    // Trigger next wave (reaches 40% threat)
    director.update(10000);
    
    expect(director.getThreatLevel()).toBe(40);
    
    // Wave budget at turn 4 (threat 40): 20 + (40/10 * 1) = 24 points
    // We expect a mix of enemies since threat is 40%
    const spawnedEnemies = onSpawn.mock.calls.map(call => call[0]);
    
    const totalDifficulty = spawnedEnemies.reduce((sum, e) => sum + e.difficulty, 0);
    expect(totalDifficulty).toBe(24);
    
    const hasHard = spawnedEnemies.some(e => e.difficulty === 3);
    const hasMedium = spawnedEnemies.some(e => e.difficulty === 2);
    const hasEasy = spawnedEnemies.some(e => e.difficulty === 1);
    
    // With PRNG(123), we should get some mix. 
    // If not, we might need a different seed or more spawns.
    expect(hasEasy).toBe(true);
    // At 40% threat, roll < 0.4 is XenoMite, < 0.7 is WarriorDrone, < 0.9 is SpitterAcid, else PraetorianGuard
    // Let's verify we have at least one of each (highly likely with 24 points)
    expect(hasMedium || hasHard).toBe(true);
  });

  it("should correctly handle starting points for budget", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    
    // Use custom starting points
    const director = new Director(spawnPoints, prng, onSpawn, 0, 3, 1, 0, undefined, 50);
    
    director.update(10000); // 10% threat
    
    // Budget = 50 + (10/10 * 1) = 51
    expect(onSpawn).toHaveBeenCalledTimes(51);
    const spawnedEnemies = onSpawn.mock.calls.map(call => call[0]);
    const totalDifficulty = spawnedEnemies.reduce((sum, e) => sum + e.difficulty, 0);
    expect(totalDifficulty).toBe(51);
  });
});
