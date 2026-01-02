import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CommandType,
  UnitState,
  MissionType,
  CellType,
  AIProfile,
} from "../../shared/types";

describe("New Command Logic: EXPLORE, OVERWATCH, and Agent Control", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    boundaries: [],
    spawnPoints: [{ id: "sp1", pos: { x: 1, y: 1 }, radius: 1 }],
    extraction: { x: 9, y: 9 },
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({
        x,
        y,
        type: CellType.Floor,
      });
    }
  }

  beforeEach(() => {
    engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      true, // agentControlEnabled
      false,
      MissionType.Default,
    );
  });

  it("should implement EXPLORE command and enable AI", () => {
    const unit = engine.getState().units[0];

    // Disable AI first
    engine.applyCommand({ type: CommandType.STOP, unitIds: [unit.id] });
    expect(engine.getState().units[0].aiEnabled).toBe(false);

    // Issue EXPLORE
    engine.applyCommand({
      type: CommandType.EXPLORE,
      unitIds: [unit.id],
    });

    expect(engine.getState().units[0].aiEnabled).toBe(true);
    expect(engine.getState().units[0].activeCommand?.type).toBe(
      CommandType.EXPLORE,
    );
  });

  it("should implement OVERWATCH_POINT command and set STAND_GROUND", () => {
    const unit = engine.getState().units[0];

    engine.applyCommand({
      type: CommandType.OVERWATCH_POINT,
      unitIds: [unit.id],
      target: { x: 5, y: 5 },
    });

    const updatedUnit = engine.getState().units[0];
    expect(updatedUnit.state).toBe(UnitState.Moving);
    expect(updatedUnit.targetPos).toBeDefined();
    expect(updatedUnit.aiProfile).toBe(AIProfile.STAND_GROUND);
    // Overwatch should probably also disable autonomous wandering (agent control)
    expect(updatedUnit.aiEnabled).toBe(false);
  });

  it("should NOT re-enable AI on MOVE_TO (Remove Agent Control)", () => {
    const unit = engine.getState().units[0];

    engine.applyCommand({ type: CommandType.STOP, unitIds: [unit.id] });
    expect(engine.getState().units[0].aiEnabled).toBe(false);

    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 3, y: 3 },
    });

    expect(engine.getState().units[0].aiEnabled).toBe(false);
  });

  it("should NOT re-enable AI on SET_ENGAGEMENT (Remove Agent Control)", () => {
    const unit = engine.getState().units[0];

    engine.applyCommand({ type: CommandType.STOP, unitIds: [unit.id] });
    expect(engine.getState().units[0].aiEnabled).toBe(false);

    engine.applyCommand({
      type: CommandType.SET_ENGAGEMENT,
      unitIds: [unit.id],
      mode: "ENGAGE",
    });

    expect(engine.getState().units[0].aiEnabled).toBe(false);
  });
});
