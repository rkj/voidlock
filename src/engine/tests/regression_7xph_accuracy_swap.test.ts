import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  UnitState,
  EnemyType,
} from "../../shared/types";

describe("Regression 7xph - Accuracy Stats Reset on Weapon Swap", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: Array.from({ length: 100 }, (_, i) => ({
      x: i % 10,
      y: Math.floor(i / 10),
      type: CellType.Floor,
    })),
    squadSpawn: { x: 2, y: 2 },
    spawnPoints: [{ id: "sp1", pos: { x: 8, y: 8 }, radius: 1 }],
  };

  it("should maintain soldierAim and equipment bonuses when swapping weapons", () => {
    const squadConfig: SquadConfig = {
      soldiers: [
        {
          archetypeId: "assault",
          body: "heavy_plate",
        },
      ],
      inventory: {},
    };

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const state = engine.getState();
    const unit = state.units[0];

    // Initial check: assault(90) + pulse_rifle(5) + heavy_armor(-10) = 85
    // Note: If the bug is already present at initialization, it might be 5.
    // Let's check what CoreEngine does at init.
    // CoreEngine.ts:
    // let accuracy = arch.accuracy; // 95 for assault
    // accuracy += armor.accuracyBonus; // 95 - 10 = 85
    // unit.accuracy = accuracy; // 85

    // Wait, the bug might also be in initialization if it overwrites it later.
    // In CoreEngine.ts:
    // this.addUnit({ ..., accuracy: accuracy, ... });
    // This looks okay for initial state.

    expect(unit.stats.accuracy).toBe(85);

    // 1. Move an enemy into melee range
    const internalState = (engine as any).state;
    internalState.enemies.push({
      id: "enemy1",
      type: EnemyType.XenoMite,
      pos: { x: 2.2, y: 2.2 }, // Very close to unit at {2.5, 2.5} (approx, because of jitter)
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
    });

    // 2. Run update to trigger weapon swap
    engine.update(100);

    const unitMelee = engine.getState().units[0];

    // Expecting: soldierAim(90) + combat_knife(10) + heavy_armor(-10) = 90
    // If bug exists, it will be combat_knife.accuracy = 10
    expect(unitMelee.activeWeaponId).toBe("combat_knife");
    // This is the failing assertion
    expect(unitMelee.stats.accuracy).toBe(90);

    // 3. Move enemy away
    internalState.enemies[0].pos = { x: 8, y: 8 };
    engine.update(100);

    const unitRanged = engine.getState().units[0];
    expect(unitRanged.activeWeaponId).toBe("pulse_rifle");
    // Expecting: soldierAim(90) + pulse_rifle(5) + heavy_armor(-10) = 85
    // If bug exists, it will be pulse_rifle.accuracy = 5
    expect(unitRanged.stats.accuracy).toBe(85);
  });
});
