import { describe, it, expect, beforeEach, vi } from "vitest";
import { CoreEngine } from "../engine/CoreEngine";
import { GameGrid } from "../engine/GameGrid";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  Vector2,
  SquadConfig,
  Archetype,
  ArchetypeLibrary,
  SpawnPoint,
  Objective,
} from "../shared/types";
import { Pathfinder } from "../engine/Pathfinder";

describe("CoreEngine with Objectives and Game Loop", () => {
  let engine: CoreEngine;
  const mockSpawnPoint: SpawnPoint = {
    id: "sp1",
    pos: { x: 0, y: 0 },
    radius: 1,
  };
  const mockObjective: Objective = {
    id: "obj1",
    kind: "Recover",
    state: "Pending",
    targetCell: { x: 2, y: 0 },
  };
  const mockMap: MapDefinition = {
    width: 3,
    height: 3,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },

      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
      { x: 2, y: 1, type: CellType.Floor },

      { x: 0, y: 2, type: CellType.Floor },
      { x: 1, y: 2, type: CellType.Floor },
      { x: 2, y: 2, type: CellType.Floor },
    ],
    spawnPoints: [], // Clear spawn points to prevent enemies
    extraction: { x: 0, y: 2 },
    objectives: [mockObjective],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const defaultSquad: SquadConfig = [{ archetypeId: "assault", count: 1 }];
    engine = new CoreEngine(mockMap, 123, defaultSquad, false, false);
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 20,
      fireRate: 500,
      attackRange: 2,
      sightRange: 5,
      speed: 2,
      commandQueue: [],
    });
  });

  it("should complete objective when unit reaches target", () => {
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 2, y: 0 },
    });

    for (let i = 0; i < 15; i++) engine.update(100);
    // Add 5.1s wait for channeling
    engine.update(5100);

    const state = engine.getState();
    expect(state.objectives[0].state).toBe("Completed");
  });

  it("should NOT extract unit if objectives are pending", () => {
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 0, y: 2 },
    });

    for (let i = 0; i < 20; i++) engine.update(100);

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.state).not.toBe(UnitState.Extracted);
  });

  it("should win game when objectives complete and units extract", () => {
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 2, y: 0 },
    });
    for (let i = 0; i < 15; i++) engine.update(100);
    // Wait for objective channel
    engine.update(5100);

    expect(engine.getState().objectives[0].state).toBe("Completed");

    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 0, y: 2 },
    });
    for (let i = 0; i < 25; i++) engine.update(100);
    // Wait for extract channel
    engine.update(5100);

    const state = engine.getState();
    expect(state.units[0].state).toBe(UnitState.Extracted);
    expect(state.status).toBe("Won");
  });

  it("should lose game if all units die", () => {
    engine.addEnemy({
      id: "boss",
      pos: { x: 0.5, y: 0.5 },
      hp: 500,
      maxHp: 500,
      type: "Boss",
      damage: 1000,
      fireRate: 1000,
      attackRange: 1,
      speed: 1,
    });

    engine.update(100);

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.state).toBe(UnitState.Dead);
    expect(state.status).toBe("Lost");
  });

  it("should stop movement and clear queue when STOP command is issued", () => {
    // 1. Give move command
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 2, y: 2 },
    });

    engine.update(100);
    expect(engine.getState().units[0].state).toBe(UnitState.Moving);

    // 2. Issue STOP
    engine.applyCommand({
      type: CommandType.STOP,
      unitIds: ["u1"],
    });

    const state = engine.getState();
    expect(state.units[0].state).toBe(UnitState.Idle);
    expect(state.units[0].path).toBeUndefined();
    expect(state.units[0].targetPos).toBeUndefined();
  });

  it("should decouple threat increase from game speed", () => {
    // turnDuration = 30000, threatPerTurn = 10
    expect(engine.getState().threatLevel).toBe(0);

    // Advance with high game speed but low real speed
    // scaledDt = 30000 (one turn in game time), realDt = 1000 (1 second real time)
    engine.update(30000, 1000);

    // Threat should have increased by 1 second worth, not one turn
    // (1000/30000) * 10 = 0.333
    expect(engine.getState().threatLevel).toBeCloseTo(0.333, 3);
    
    // game time state.t should be 30000
    expect(engine.getState().t).toBe(30000);
  });
});
