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

describe("Stop and Shoot Behavior", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [],
    extraction: { x: 9, y: 9 },
    objectives: [],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
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
        damage: 20,
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 100,
        attackRange: 5,
        speed: 200,
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

  it("unit should stop moving to shoot at enemy", () => {
    // 1. Give move command
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 9, y: 0 },
    });

    // 2. Add enemy in path (at x=2)
    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 2.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      damage: 10,
      fireRate: 500,
      accuracy: 1000,
      attackRange: 2,
      speed: 1,
      difficulty: 1,
    });

    // 3. Update until unit sees enemy
    for (let i = 0; i < 10; i++) {
      engine.update(100);
      const state = engine.getState();
      const unit = state.units[0];
      if (unit.state === UnitState.Attacking) break;
    }

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.state).toBe(UnitState.Attacking);
    const posAfterSeeing = unit.pos.x;

    // 4. Update more, unit should STAY at same position while attacking
    engine.update(100);
    const state2 = engine.getState();
    const unit2 = state2.units[0];

    expect(unit2.state).toBe(UnitState.Attacking);
    expect(unit2.pos.x).toBe(posAfterSeeing);
  });

  it("RUSHing unit should keep moving while shooting", () => {
    // Replace unit with a RUSHing one
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 20,
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 100,
        attackRange: 10, // Longer range to start attacking early
        speed: 200,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.RUSH,
      commandQueue: [],
      archetypeId: "scout",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    // 1. Give move command
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 9, y: 0 },
    });

    // 2. Add enemy in path
    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 5.5, y: 0.5 },
      hp: 1000,
      maxHp: 1000,
      damage: 10,
      fireRate: 500,
      accuracy: 1000,
      attackRange: 2,
      speed: 1,
      difficulty: 1,
    });

    // 3. Update until unit starts attacking
    let initialPosX = 0;
    for (let i = 0; i < 10; i++) {
      engine.update(100);
      const u = engine.getState().units[0];
      if (u.state === UnitState.Attacking) {
        initialPosX = u.pos.x;
        break;
      }
    }

    expect(initialPosX).toBeGreaterThan(0.5);

    engine.update(100);
    const u2 = engine.getState().units[0];

    expect(u2.pos.x).toBeGreaterThan(initialPosX);
    expect(u2.state).toBe(UnitState.Attacking);
  });
});
