import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
  EnemyType,
  AIProfile,
} from "../../../shared/types";

describe("Combat Accuracy (Percentage Model)", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 20,
    height: 3,
    cells: Array.from({ length: 60 }, (_, i) => ({
      x: i % 20,
      y: Math.floor(i / 20),
      type: CellType.Floor,
    })),
    spawnPoints: [],
    extraction: { x: 19, y: 0 },
    objectives: [],
  };

  beforeEach(() => {
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };
    // Use a fixed seed for deterministic results
    engine = new CoreEngine(mockMap, 12345, defaultSquad, false, false);
    engine.clearUnits();
  });

  it("should have 100% hit chance if accuracy is 100 and distance <= range", () => {
    // accuracy = 100 -> 100% hit if distance <= range
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 100,
        attackRange: 15,
        speed: 20,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 10.5, y: 0.5 }, // distance = 10.0
      hp: 1000,
      maxHp: 1000,
      type: EnemyType.XenoMite,
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
      difficulty: 1,
    });

    // Fire 10 shots
    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    // Each shot 10 damage, 10 shots -> 100 damage
    expect(enemy.hp).toBe(900);
  });

  it("should have 50% hit chance at range distance if accuracy is 50", () => {
    // accuracy = 50, range = 10, distance = 10 -> (50/100) * (10/10) = 0.5
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 50,
        attackRange: 10,
        speed: 20,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 10.5, y: 0.5 }, // distance = 10.0
      hp: 10000,
      maxHp: 10000,
      type: EnemyType.XenoMite,
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
      difficulty: 1,
    });

    // Fire 100 shots
    for (let i = 0; i < 100; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    const damageDealt = 10000 - enemy.hp;
    const hits = damageDealt / 10;

    // Expect around 50 hits
    expect(hits).toBeGreaterThan(35);
    expect(hits).toBeLessThan(65);
  });

  it("should have 100% hit chance at 1 tile if accuracy is 50 and range is 10", () => {
    // accuracy = 50, range = 10, distance = 1.0 -> (50/100) * (10/1) = 5.0 -> 1.0
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 50,
        attackRange: 10,
        speed: 20,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 1.5, y: 0.5 }, // distance = 1.0
      hp: 10000,
      maxHp: 10000,
      type: EnemyType.XenoMite,
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
      difficulty: 1,
    });

    // Fire 100 shots
    for (let i = 0; i < 100; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    const damageDealt = 10000 - enemy.hp;
    const hits = damageDealt / 10;

    // Expect exactly 100 hits
    expect(hits).toBe(100);
  });

  it("should have 100% hit chance if accuracy is very high (e.g. 1000)", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 1000,
        attackRange: 15,
        speed: 20,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 10.5, y: 0.5 }, // distance = 10.0
      hp: 1000,
      maxHp: 1000,
      type: EnemyType.XenoMite,
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
      difficulty: 1,
    });

    // Fire 10 shots
    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    expect(enemy.hp).toBe(900);
  });

  it("should correctly calculate hit chance for enemies attacking units", () => {
    // distance = 10.0, accuracy = 100, range = 15 -> (100/100) * (15/10) = 1.5 -> 1.0
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 10000,
      maxHp: 10000,
      state: UnitState.Idle,
      stats: {
        damage: 0,
        fireRate: 1000,
        accuracy: 1000,
        attackRange: 0,
        speed: 20,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 10.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.SpitterAcid,
      damage: 10,
      fireRate: 100,
      accuracy: 100,
      attackRange: 15,
      speed: 0,
      difficulty: 1,
    });

    // Fire 100 shots
    for (let i = 0; i < 100; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const unit = state.units[0];
    const damageDealt = 10000 - unit.hp;
    const hits = damageDealt / 10;

    // Expect 100 hits
    expect(hits).toBe(100);
  });

  it("should have 0% hit chance if accuracy is 0", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 0,
        attackRange: 15,
        speed: 20,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 1.5, y: 0.5 }, // distance = 1.0
      hp: 1000,
      maxHp: 1000,
      type: EnemyType.XenoMite,
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
      difficulty: 1,
    });

    // Fire 10 shots
    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    expect(enemy.hp).toBe(1000);
  });

  it("should have ~55% hit chance for enemies if accuracy is 50 and distance is 10 and range is 11", () => {
    // accuracy = 50, range = 11, distance = 10 -> (50/100) * (11/10) = 0.55
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 10000,
      maxHp: 10000,
      state: UnitState.Idle,
      stats: {
        damage: 0,
        fireRate: 1000,
        accuracy: 100,
        attackRange: 0,
        speed: 20,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 10.5, y: 0.5 }, // distance = 10.0
      hp: 100,
      maxHp: 100,
      type: EnemyType.SpitterAcid,
      damage: 10,
      fireRate: 100,
      accuracy: 50,
      attackRange: 11,
      speed: 0,
      difficulty: 1,
    });

    // Fire 100 shots
    for (let i = 0; i < 100; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const unit = state.units[0];
    const damageDealt = 10000 - unit.hp;
    const hits = damageDealt / 10;

    expect(hits).toBeGreaterThan(40);
    expect(hits).toBeLessThan(70);
  });
});
