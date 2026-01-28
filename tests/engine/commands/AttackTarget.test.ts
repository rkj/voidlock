import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
  EnemyType,
  AIProfile,
} from "@src/shared/types";

describe("Autonomous Targeting Logic", () => {
  let engine: CoreEngine;
  const map: MapDefinition = {
    width: 10,
    height: 10,
    cells: Array(100)
      .fill(null)
      .map((_, i) => ({
        x: i % 10,
        y: Math.floor(i / 10),
        type: CellType.Floor,
      })),
    spawnPoints: [],
    extraction: { x: 9, y: 9 },
    objectives: [],
  };

  beforeEach(() => {
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };
    engine = new CoreEngine(map, 123, defaultSquad, false, false);
    engine.clearUnits();
    // Add one unit
    engine.addUnit({
      id: "u1",
      pos: { x: 5.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "test_archetype",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });
  });

  it("should prioritize weakest target (kill confirm) over closest", () => {
    // Enemy 1: Close (Distance 1), Full HP (100)
    // Score = (100-100) + (100/1) = 100
    engine.addEnemy({
      id: "e_close",
      pos: { x: 5.5, y: 4.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.Grunt,
      damage: 0,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });
    // Enemy 2: Farther (Distance 2), Low HP (30)
    // Score = (100-30) + (100/2) = 70 + 50 = 120
    engine.addEnemy({
      id: "e_weak",
      pos: { x: 5.5, y: 3.5 },
      hp: 30,
      maxHp: 100,
      type: EnemyType.Grunt,
      damage: 0,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    engine.update(100); // 1 tick
    const state = engine.getState();
    const e_weak = state.enemies.find((e) => e.id === "e_weak");
    const e_close = state.enemies.find((e) => e.id === "e_close");

    // e_weak should take damage because it has a higher score
    expect(e_weak?.hp).toBeLessThan(30);
    expect(e_close?.hp).toBe(100);
  });

  it("should implement stickiness: continue attacking current target even if a better one appears", () => {
    // Enemy 1: Target A (Distance 3, Full HP)
    // Score = 0 + 100/3 = 33.3
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 2.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.Grunt,
      damage: 0,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    engine.update(100); // 1 tick to acquire e1
    let state = engine.getState();
    let u1 = state.units.find((u) => u.id === "u1");
    expect(u1?.forcedTargetId).toBe("e1");

    // Enemy 2: Target B (Distance 1, Full HP)
    // Score = 0 + 100/1 = 100 (Higher than e1)
    engine.addEnemy({
      id: "e2",
      pos: { x: 5.5, y: 4.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.Grunt,
      damage: 0,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    engine.update(100); // Another tick
    state = engine.getState();
    const e1 = state.enemies.find((e) => e.id === "e1");
    const e2 = state.enemies.find((e) => e.id === "e2");
    u1 = state.units.find((u) => u.id === "u1");

    // Should STILL be attacking e1 due to stickiness
    expect(u1?.forcedTargetId).toBe("e1");
    expect(e1?.hp).toBeLessThan(100);
    expect(e2?.hp).toBe(100);
  });

  it("should switch target if current target dies", () => {
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 4.5 },
      hp: 10,
      maxHp: 100,
      type: EnemyType.Grunt,
      damage: 0,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });
    engine.addEnemy({
      id: "e2",
      pos: { x: 5.5, y: 3.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.Grunt,
      damage: 0,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    engine.update(100); // Hit e1 (10 dmg -> 0 hp)
    // Tick end cleanup will remove e1

    engine.update(100); // Should acquire and hit e2
    const state = engine.getState();
    const e2 = state.enemies.find((e) => e.id === "e2");
    const u1 = state.units.find((u) => u.id === "u1");

    expect(u1?.forcedTargetId).toBe("e2");
    expect(e2?.hp).toBeLessThan(100);
  });

  it("should switch target if current target leaves range", () => {
    // e1 starts in range
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 4.5 }, // Distance 1
      hp: 100,
      maxHp: 100,
      type: EnemyType.Grunt,
      damage: 0,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 10, // Fast
      difficulty: 1,
    });

    engine.update(100);
    let state = engine.getState();
    expect(state.units[0].forcedTargetId).toBe("e1");

    // Move e1 out of range (range is 5)
    const e1_real = (engine as any).state.enemies.find(
      (e: any) => e.id === "e1",
    )!;
    e1_real.pos = { x: 5.5, y: 15.5 }; // Distance 10

    // Add another enemy in range
    engine.addEnemy({
      id: "e2",
      pos: { x: 5.5, y: 6.5 }, // Distance 1
      hp: 100,
      maxHp: 100,
      type: EnemyType.Grunt,
      damage: 0,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    engine.update(100);
    state = engine.getState();
    const u1 = state.units.find((u) => u.id === "u1");
    const e2 = state.enemies.find((e) => e.id === "e2");

    expect(u1?.forcedTargetId).toBe("e2");
    expect(e2?.hp).toBeLessThan(100);
  });
});
