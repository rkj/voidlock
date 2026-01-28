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

describe("UnitManager Movement and Attacking Regression", () => {
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
    // @ts-ignore
    engine.state.enemies = [];
    // @ts-ignore
    engine.state.objectives = [];
    
    // Add a unit at (0.5, 0.5)
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 100,
        fireRate: 1000,
        accuracy: 1000,
        soldierAim: 100,
        attackRange: 10,
        speed: 100,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "scout",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    // Add an enemy at (5.5, 0.5) - in range
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 0.5 },
      hp: 1000,
      maxHp: 1000,
      type: EnemyType.XenoMite,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });
  });

  it("unit should stop moving to attack when in STAND_GROUND profile", () => {
    // Give MOVE_TO command to (9.5, 0.5)
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 9, y: 0 },
    });

    // Initial state: unit is moving
    engine.update(16); // One tick
    let state = engine.getState();
    let unit = state.units[0];
    expect(unit.state).toBe(UnitState.Attacking);
    const initialPosX = unit.pos.x;

    // Update more
    engine.update(100);
    state = engine.getState();
    unit = state.units[0];
    
    // Unit should still be at the same position (or very close if it moved a tiny bit before target acquisition)
    // Actually, in UnitManager, Combat is processed BEFORE Movement in the loop.
    // So if it acquires target and starts attacking, it won't move in the same tick if it's STAND_GROUND.
    expect(unit.pos.x).toBe(initialPosX);
    expect(unit.state).toBe(UnitState.Attacking);
  });

  it("unit should move and attack when in RUSH profile", () => {
    // Change profile to RUSH
    // @ts-ignore
    engine.state.units[0].aiProfile = AIProfile.RUSH;
    
    // Give MOVE_TO command to (9.5, 0.5)
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 9, y: 0 },
    });

    engine.update(100);
    let state = engine.getState();
    let unit = state.units[0];
    
    expect(unit.state).toBe(UnitState.Attacking);
    expect(unit.pos.x).toBeGreaterThan(0.5); // Should have moved
  });
});
