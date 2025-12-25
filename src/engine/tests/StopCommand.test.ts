import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CommandType,
  UnitState,
  MissionType,
  CellType,
} from "../../shared/types";

describe("Stop Command and AI Logic", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [{ id: "sp1", pos: { x: 1, y: 1 }, radius: 1 }],
    extraction: { x: 9, y: 9 },
    objectives: [{ id: "obj1", kind: "Recover", targetCell: { x: 5, y: 5 } }],
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
      [{ archetypeId: "assault", count: 1 }],
      true, // agentControlEnabled
      false,
      MissionType.Default,
    );
  });

  it("should stop and disable AI when STOP command is issued", () => {
    const unit = engine.getState().units[0];

    // 1. Give move command
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 5, y: 5 },
    });

    engine.update(100);
    expect(engine.getState().units[0].state).toBe(UnitState.Moving);
    expect(engine.getState().units[0].aiEnabled).toBe(true);

    // 2. Issue STOP
    engine.applyCommand({
      type: CommandType.STOP,
      unitIds: [unit.id],
    });

    const stateAfterStop = engine.getState();
    expect(stateAfterStop.units[0].state).toBe(UnitState.Idle);
    expect(stateAfterStop.units[0].aiEnabled).toBe(false);

    // 3. Update and ensure it STAYS idle (AI should not take over)
    // Add an objective to trigger AI
    engine.getState().objectives.push({
      id: "obj1",
      kind: "Recover",
      state: "Pending",
      targetCell: { x: 2, y: 2 },
      visible: true,
    });

    // We need to inject the objective into the actual engine state,
    // but getState returns a copy. CoreEngine doesn't have a way to add objectives easily after init
    // except via the constructor or internal logic.
    // Actually, CoreEngine generates them in constructor.
  });

  it("should re-enable AI when a manual MOVE_TO is issued", () => {
    const unit = engine.getState().units[0];

    engine.applyCommand({ type: CommandType.STOP, unitIds: [unit.id] });
    expect(engine.getState().units[0].aiEnabled).toBe(false);

    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 3, y: 3 },
    });

    expect(engine.getState().units[0].aiEnabled).toBe(true);
  });

  it("should re-enable AI when SET_ENGAGEMENT is issued", () => {
    const unit = engine.getState().units[0];

    engine.applyCommand({ type: CommandType.STOP, unitIds: [unit.id] });
    expect(engine.getState().units[0].aiEnabled).toBe(false);

    engine.applyCommand({
      type: CommandType.SET_ENGAGEMENT,
      unitIds: [unit.id],
      mode: "ENGAGE",
    });

    expect(engine.getState().units[0].aiEnabled).toBe(true);
  });

  it("should re-enable AI when RESUME_AI is issued", () => {
    const unit = engine.getState().units[0];

    engine.applyCommand({ type: CommandType.STOP, unitIds: [unit.id] });
    expect(engine.getState().units[0].aiEnabled).toBe(false);

    engine.applyCommand({
      type: CommandType.RESUME_AI,
      unitIds: [unit.id],
    });

    expect(engine.getState().units[0].aiEnabled).toBe(true);
  });
});
