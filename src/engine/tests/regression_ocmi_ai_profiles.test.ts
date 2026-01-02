import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../engine/CoreEngine";
import {
  MapDefinition,
  UnitState,
  CommandType,
  AIProfile,
  EnemyType,
} from "../../shared/types";

describe("Regression OCMI: Innate AI Profiles", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    squadSpawn: { x: 1, y: 1 },
    spawnPoints: [{ id: "sp1", pos: { x: 8, y: 8 }, radius: 1 }],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: "Floor" as any });
    }
  }

  const squadConfig = {
    soldiers: [
      { archetypeId: "assault" }, // RUSH
      { archetypeId: "heavy" }, // STAND_GROUND
      { archetypeId: "medic" }, // RETREAT
    ],
    inventory: {},
  };

  it("STAND_GROUND (Heavy) should stay put and shoot", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      {
        soldiers: [{ archetypeId: "heavy" }],
        inventory: {},
      },
      true,
      false,
    );

    // Manually add an enemy nearby
    engine.addEnemy({
      id: "enemy-1",
      type: EnemyType.XenoMite,
      pos: { x: 5.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.aiProfile).toBe(AIProfile.STAND_GROUND);

    // Run engine for a few ticks
    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const finalState = engine.getState();
    const finalUnit = finalState.units[0];

    // Should NOT have moved toward enemy
    expect(finalUnit.pos.x).toBeCloseTo(unit.pos.x, 0.1);
    expect(finalUnit.pos.y).toBeCloseTo(unit.pos.y, 0.1);
  });

  it("RUSH (Assault) should move toward enemy", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      {
        soldiers: [{ archetypeId: "assault" }],
        inventory: {},
      },
      true,
      false,
    );

    engine.addEnemy({
      id: "enemy-1",
      type: EnemyType.XenoMite,
      pos: { x: 5.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.aiProfile).toBe(AIProfile.RUSH);

    // Run engine for a few ticks
    for (let i = 0; i < 20; i++) {
      engine.update(100);
    }

    const finalState = engine.getState();
    const finalUnit = finalState.units[0];

    // Should HAVE moved toward enemy
    expect(finalUnit.pos.x).toBeGreaterThan(unit.pos.x);
  });

  it("RETREAT (Medic) should move away from enemy while maintaining LOF", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      {
        soldiers: [{ archetypeId: "medic" }],
        inventory: {},
      },
      true,
      false,
    );

    // Start medic closer to enemy
    engine.clearUnits();
    engine.addUnit({
      id: "medic-1",
      archetypeId: "medic",
      pos: { x: 4.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 1000,
        soldierAim: 80,
        equipmentAccuracyBonus: 0,
        accuracy: 80,
        attackRange: 10,
        speed: 20,
      },
      aiProfile: AIProfile.RETREAT,
      engagementPolicy: "ENGAGE",
      commandQueue: [],
    } as any);

    engine.addEnemy({
      id: "enemy-1",
      type: EnemyType.XenoMite,
      pos: { x: 5.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    const state = engine.getState();
    const unit = state.units[0];

    // Run engine for a few ticks
    for (let i = 0; i < 20; i++) {
      engine.update(100);
    }

    const finalState = engine.getState();
    const finalUnit = finalState.units[0];

    // Should HAVE moved away from enemy (x decreases)
    expect(finalUnit.pos.x).toBeLessThan(unit.pos.x);
    // Should still be within range/LOF (in this simple map, LOF is always clear)
    const dist = Math.sqrt(
      Math.pow(finalUnit.pos.x - 5.5, 2) + Math.pow(finalUnit.pos.y - 1.5, 2),
    );
    expect(dist).toBeGreaterThan(1.0);
    expect(dist).toBeLessThanOrEqual(6.5); // attackRange + buffer
  });
});
