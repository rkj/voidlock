import { describe, it, expect, beforeEach, vi } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  Objective,
  EnemyType,
  AIProfile,
} from "@src/shared/types";

describe("CoreEngine with Objectives and Game Loop", () => {
  let engine: CoreEngine;
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
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
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
        soldierAim: 90,
        attackRange: 5,
        speed: 20,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });
  });

  it("should complete objective when unit reaches target", () => {
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 2, y: 0 },
    });

    for (let i = 0; i < 45; i++) engine.update(100);
    // Add 8s wait for channeling (5000 * (30/20) = 7500ms)
    engine.update(8000);

    const state = engine.getState();
    expect(state.objectives[0].state).toBe("Completed");
  });

  it("should NOT extract unit if objectives are pending", () => {
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 0, y: 2 },
    });

    for (let i = 0; i < 60; i++) engine.update(100);

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
    for (let i = 0; i < 45; i++) engine.update(100);
    // Wait for objective channel
    engine.update(8000);

    expect(engine.getState().objectives[0].state).toBe("Completed");

    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 0, y: 2 },
    });
    for (let i = 0; i < 75; i++) engine.update(100);
    // Wait for extract channel
    engine.update(8000);

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
      type: EnemyType.Boss,
      damage: 1000,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 10,
      difficulty: 100,
    });

    engine.update(100);

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.state).toBe(UnitState.Dead);
    expect(state.status).toBe("Lost");
  });

  it("should couple threat increase to game time (scaledDt)", () => {
    // turnDuration = 10000, threatPerTurn = 10
    expect(engine.getState().stats.threatLevel).toBe(0);

    // Advance with high game speed but low real speed
    // scaledDt = 30000 (three turns in game time), realDt = 1000 (1 second real time)
    engine.update(30000);

    // Threat should have increased by scaledDt (30 seconds), so 3 turns
    // (30000/10000) * 10 = 30.0
    expect(engine.getState().stats.threatLevel).toBeCloseTo(30.0, 3);

    // game time state.t should be 30000
    expect(engine.getState().t).toBe(30000);
  });
});
