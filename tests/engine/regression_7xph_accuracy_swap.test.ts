import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  UnitState,
  EnemyType,
} from "@src/shared/types";

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

  const getInternalState = (engine: CoreEngine) => (engine as any).state;

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
    const unit = engine.getState().units[0];

    // Initial check: assault(90) + pulse_rifle(5) + heavy_armor(-10) = 85
    expect(unit.stats.accuracy).toBe(85);

    // 1. Move an enemy into melee range
    getInternalState(engine).enemies.push({
      id: "enemy1",
      type: EnemyType.XenoMite,
      pos: { x: 2.2, y: 2.2 }, // Very close to unit at {2.5, 2.5}
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
    });

    // 2. Run update to trigger weapon swap
    engine.update(100);

    const unitMelee = engine.getState().units[0];

    // Expecting: soldierAim(90) + combat_knife(10) + heavy_armor(-10) = 90
    expect(unitMelee.activeWeaponId).toBe("combat_knife");
    expect(unitMelee.stats.accuracy).toBe(90);

    // 3. Move enemy away
    getInternalState(engine).enemies[0].pos = { x: 8, y: 8 };
    engine.update(100);

    const unitRanged = engine.getState().units[0];
    expect(unitRanged.activeWeaponId).toBe("pulse_rifle");
    // Expecting: soldierAim(90) + pulse_rifle(5) + heavy_armor(-10) = 85
    expect(unitRanged.stats.accuracy).toBe(85);
  });
});