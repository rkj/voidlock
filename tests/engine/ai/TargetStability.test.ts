import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  GameState,
  Unit,
  Enemy,
  UnitState,
  CommandType,
  MapDefinition,
  EnemyType,
  CellType,
  SquadConfig,
} from "@src/shared/types";
import { PRNG } from "@src/shared/PRNG";
import { MathUtils } from "@src/shared/utils/MathUtils";

describe("AI Target Stability", () => {
  let engine: CoreEngine;

  const mapDef: MapDefinition = {
    width: 10,
    height: 10,
    cells: Array(100).fill(0).map((_, i) => ({
      x: i % 10,
      y: Math.floor(i / 10),
      type: CellType.Floor,
      roomId: "room-1"
    })),
    walls: [],
    doors: [],
    spawnPoints: [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
    squadSpawn: { x: 1, y: 1 },
    extraction: { x: 9, y: 9 },
    objectives: []
  };

  const defaultSquad: SquadConfig = {
    soldiers: [],
    inventory: {}
  };

  beforeEach(() => {
    engine = new CoreEngine(mapDef, 12345, defaultSquad, true, false);
    engine.clearUnits();
  });

  it("Soldier should maintain focus on one target and not oscillate movement", () => {
    // 1. Setup: 1 Soldier vs 2 Enemies at similar distances
    const s1: Unit = {
      id: "s1",
      pos: { x: 5.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      archetypeId: "scout",
      aiEnabled: true,
      stats: {
        hp: 100,
        speed: 20,
        accuracy: 80,
        damage: 10,
        fireRate: 500,
        attackRange: 5,
        visionRange: 10
      },
      inventory: [],
      commandQueue: [],
      activeWeaponId: "wpn1",
      rightHand: "wpn1",
      kills: 0,
      experience: 0,
      level: 1,
      aiProfile: "DEFAULT"
    };
    engine.addUnit(s1);

    engine.addEnemy({
      id: "e1",
      type: EnemyType.SwarmMelee,
      pos: { x: 5.5, y: 2.5 },
      hp: 100,
      maxHp: 100,
      difficulty: 1,
      stats: { hp: 100, speed: 10, damage: 10, fireRate: 1000, accuracy: 50, attackRange: 1 },
      attackRange: 1,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      speed: 10
    });

    engine.addEnemy({
      id: "e2",
      type: EnemyType.SwarmMelee,
      pos: { x: 8.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      difficulty: 1,
      stats: { hp: 100, speed: 10, damage: 10, fireRate: 1000, accuracy: 50, attackRange: 1 },
      attackRange: 1,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      speed: 10
    });

    const state = engine.getState();
    state.discoveredCells = state.map.cells.flat().map(c => `${c.x},${c.y}`);

    // Run a few ticks
    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const s1State = engine.getState().units[0];
    expect(s1State.forcedTargetId).toBeDefined();
    const initialTargetId = s1State.forcedTargetId;

    // Move the other enemy slightly closer
    const otherEnemyId = initialTargetId === "e1" ? "e2" : "e1";
    
    // Modify internal state enemy position
    const internalEnemy = (engine as any).state.enemies.find((e: Enemy) => e.id === otherEnemyId)!;
    if (otherEnemyId === "e1") {
      internalEnemy.pos = { x: 5.5, y: 3.0 };
    } else {
      internalEnemy.pos = { x: 8.0, y: 5.5 };
    }

    // Run more ticks
    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const s1Updated = engine.getState().units[0];
    // Soldier should STILL be targeting the same initial enemy
    expect(s1Updated.forcedTargetId).toBe(initialTargetId);
  });

  it("Soldier should not oscillate movement when targets are outside range", () => {
    // Soldier at (5.5, 5.5). Range 5.
    // Target 1 at (5.5, 11.5) - Dist 6.0
    // Target 2 at (11.5, 5.5) - Dist 6.0
    // (Wait, map is 10x10. Let's use smaller distances)
    
    // Soldier at (1.5, 1.5). Range 2.
    // E1 at (1.5, 4.5) - Dist 3.0
    // E2 at (4.5, 1.5) - Dist 3.0
    
    const s1: Unit = {
      id: "s1",
      pos: { x: 1.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      archetypeId: "scout",
      aiEnabled: true,
      stats: {
        hp: 100, speed: 20, accuracy: 80, damage: 10, fireRate: 500,
        attackRange: 2, // Outside range
        visionRange: 10
      },
      inventory: [], commandQueue: [], activeWeaponId: "wpn1", rightHand: "wpn1", kills: 0, experience: 0, level: 1, aiProfile: "DEFAULT"
    };
    engine.addUnit(s1);

    engine.addEnemy({
      id: "e1",
      type: EnemyType.SwarmMelee,
      pos: { x: 1.5, y: 4.5 },
      hp: 100, maxHp: 100, difficulty: 1,
      stats: { hp: 100, speed: 10, damage: 10, fireRate: 1000, accuracy: 50, attackRange: 1 },
      attackRange: 1, damage: 10, fireRate: 1000, accuracy: 50, speed: 10
    });

    engine.addEnemy({
      id: "e2",
      type: EnemyType.SwarmMelee,
      pos: { x: 4.5, y: 1.5 },
      hp: 100, maxHp: 100, difficulty: 1,
      stats: { hp: 100, speed: 10, damage: 10, fireRate: 1000, accuracy: 50, attackRange: 1 },
      attackRange: 1, damage: 10, fireRate: 1000, accuracy: 50, speed: 10
    });

    const state = engine.getState();
    state.discoveredCells = state.map.cells.flat().map(c => `${c.x},${c.y}`);

    // Run a few ticks
    engine.update(100);
    
    const s1State = engine.getState().units[0];
    const initialTargetId = s1State.forcedTargetId;
    expect(initialTargetId).toBeDefined();
    const initialTargetPos = { ...s1State.targetPos! };

    // Move the OTHER enemy slightly closer
    const otherEnemyId = initialTargetId === "e1" ? "e2" : "e1";
    const internalEnemy = (engine as any).state.enemies.find((e: Enemy) => e.id === otherEnemyId)!;
    
    // Move other enemy to dist 2.5
    if (otherEnemyId === "e1") {
      internalEnemy.pos = { x: 1.5, y: 4.0 };
    } else {
      internalEnemy.pos = { x: 4.0, y: 1.5 };
    }

    // Run more ticks
    engine.update(100);

    const s1Updated = engine.getState().units[0];
    // SHOULD STILL be targeting the same enemy
    expect(s1Updated.forcedTargetId).toBe(initialTargetId);
    
    // If it has a target pos, it should match the initial one (if that existed)
    if (s1Updated.targetPos) {
        expect(s1Updated.targetPos).toEqual(initialTargetPos);
    }
  });

  it("Enemies should stick to their initial target for a minimum duration", () => {
    engine.addUnit({
      id: "s1",
      pos: { x: 5.5, y: 2.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      archetypeId: "scout",
      aiEnabled: false,
      stats: { hp: 100, speed: 20, accuracy: 80, damage: 10, fireRate: 500, attackRange: 5, visionRange: 10 },
      inventory: [], commandQueue: [], rightHand: "wpn1", kills: 0, experience: 0, level: 1, aiProfile: "DEFAULT"
    });

    engine.addUnit({
      id: "s2",
      pos: { x: 8.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      archetypeId: "scout",
      aiEnabled: false,
      stats: { hp: 100, speed: 20, accuracy: 80, damage: 10, fireRate: 500, attackRange: 5, visionRange: 10 },
      inventory: [], commandQueue: [], rightHand: "wpn1", kills: 0, experience: 0, level: 1, aiProfile: "DEFAULT"
    });

    engine.addEnemy({
      id: "e1",
      type: EnemyType.SwarmMelee,
      pos: { x: 5.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      difficulty: 1,
      stats: { hp: 100, speed: 10, damage: 10, fireRate: 1000, accuracy: 50, attackRange: 1 },
      attackRange: 1,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      speed: 10
    });

    const state = engine.getState();
    state.discoveredCells = state.map.cells.flat().map(c => `${c.x},${c.y}`);

    for (let i = 0; i < 5; i++) {
      engine.update(100);
    }

    const e1 = engine.getState().enemies[0];
    const initialTargetId = e1.forcedTargetId;
    expect(initialTargetId).toBeDefined();

    const otherSoldierId = initialTargetId === "s1" ? "s2" : "s1";
    // We need to modify internal state
    const internalOtherSoldier = (engine as any).state.units.find((u: Unit) => u.id === otherSoldierId)!;
    
    // Move other soldier to be MUCH closer
    internalOtherSoldier.pos = { x: 5.5, y: 5.0 }; // distance 0.5 (initial target was distance 3.0)

    engine.update(100);

    const e1Final = engine.getState().enemies[0];
    const finalTargetId = e1Final.forcedTargetId;

    // EXPECTATION: Enemy should STICK to initial target
    expect(finalTargetId).toBe(initialTargetId);
  });
});
