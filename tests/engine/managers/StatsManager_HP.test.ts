import { describe, it, expect } from "vitest";
import { StatsManager } from "@src/engine/managers/StatsManager";
import { Unit, UnitState, AIProfile } from "@src/shared/types";

describe("StatsManager HP Mismatch", () => {
  it("should preserve innate maxHp bonuses (e.g. from levels) during recalculation", () => {
    const statsManager = new StatsManager();
    
    const unit: Unit = {
      id: "test-unit",
      archetypeId: "assault", // baseHp is 100
      hp: 150,
      innateMaxHp: 150, // 100 base + 50 level bonus
      maxHp: 150, 
      state: UnitState.Idle,
      pos: { x: 0, y: 0 },
      stats: {
        damage: 20,
        fireRate: 600,
        accuracy: 90,
        soldierAim: 90,
        attackRange: 10,
        speed: 20,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.RUSH,
      commandQueue: [],
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    };

    const updatedUnit = statsManager.recalculateStats(unit);
    
    // If it's 100, then it's resetting to archetype base and ignoring the innate level bonus
    expect(updatedUnit.maxHp).toBe(150);
  });
});
