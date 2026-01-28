import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  AIProfile,
  EnemyType,
} from "@src/shared/types";

describe("Stutter Step Repro", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 20,
    height: 10,
    cells: [],
    spawnPoints: [],
    extraction: { x: 19, y: 9 },
    objectives: [],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 20; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  beforeEach(() => {
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "scout" }],
      inventory: {},
    };
    engine = new CoreEngine(mockMap, 123, defaultSquad, false, false);
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 1000, // 1 second reload
        accuracy: 1000,
        soldierAim: 100,
        attackRange: 10,
        speed: 100, // moves 1 unit per 1000ms
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "scout",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });
  });

  it("unit should stop and stay stopped while attacking", () => {
    // Enemy at distance 5 (well within range 10)
    engine.addEnemy({
        id: "e1",
        type: EnemyType.XenoMite,
        pos: { x: 5.5, y: 0.5 },
        hp: 1000,
        maxHp: 1000,
        damage: 1,
        fireRate: 1000,
        accuracy: 1000,
        attackRange: 2,
        speed: 0,
        difficulty: 1,
    });
    
    // Give MOVE command past the enemy
    engine.applyCommand({
        type: CommandType.MOVE_TO,
        unitIds: ["u1"],
        target: { x: 15, y: 0 },
    });

    // Update 1: Unit fires (Tick 0)
    engine.update(100);
    let state = engine.getState();
    let u1 = state.units[0];
    expect(u1.state).toBe(UnitState.Attacking);
    const posAfterFirstShot = { ...u1.pos };

    // Update 2: Cooldown (Tick 100)
    engine.update(100);
    state = engine.getState();
    u1 = state.units[0];
    
    // If it stutter steps, it will have moved here because isAttacking will be false
    expect(u1.pos.x).toBe(posAfterFirstShot.x);
    expect(u1.state).toBe(UnitState.Attacking);
  });
});
