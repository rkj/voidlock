import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CommandType,
  UnitState,
  MissionType,
  CellType,
  MoveCommand,
} from "@src/shared/types";

describe("Regression 1jmd: Command Queuing", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [{ id: "sp1", pos: { x: 1, y: 1 }, radius: 1 }],
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

  it("should append commands to the queue when 'queue' flag is true", () => {
    const unit = engine.getState().units[0];

    // 1. Issue first command (MOVE_TO)
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 5, y: 5 },
      queue: false,
    });

    // 2. Issue second command with queue: true
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 1, y: 1 },
      queue: true,
    });

    const updatedUnit = engine.getState().units[0];
    expect(updatedUnit.commandQueue.length).toBe(1);
    expect((updatedUnit.commandQueue[0] as MoveCommand).target).toEqual({ x: 1, y: 1 });
  });

  it("should clear the queue and execute immediately when 'queue' flag is false (default)", () => {
    const unit = engine.getState().units[0];

    // 1. Issue first command and queue a second one
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 5, y: 5 },
      queue: false,
    });
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 8, y: 8 },
      queue: true,
    });

    expect(engine.getState().units[0].commandQueue.length).toBe(1);

    // 2. Issue third command with queue: false
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 1, y: 1 },
      queue: false,
    });

    const updatedUnit = engine.getState().units[0];
    expect(updatedUnit.commandQueue.length).toBe(0);
    expect(updatedUnit.activeCommand?.type).toBe(CommandType.MOVE_TO);
    expect((updatedUnit.activeCommand as MoveCommand).target).toEqual({ x: 1, y: 1 });
  });

  it("should execute the next command in queue after the current one completes", () => {
    const unit = engine.getState().units[0];

    // 1. Issue first command (MOVE_TO adjacent)
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 2, y: 1 },
      queue: false,
    });

    // 2. Queue second command (MOVE_TO another point)
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 3, y: 1 },
      queue: true,
    });

    expect(engine.getState().units[0].commandQueue.length).toBe(1);

    // 3. Update engine until both commands should be finished
    // Unit starts at 1.5, 1.5.
    // Command 1: to 2.5, 1.5 (dist 1.0)
    // Command 2: to 3.5, 1.5 (dist 1.0)
    // Total dist 2.0. Speed 20. Now moves at 0.66 tiles/s. Time 3.0s.

    for (let i = 0; i < 60; i++) {
      engine.update(100);
    }

    const finalUnit = engine.getState().units[0];

    // Should have finished both
    expect(finalUnit.commandQueue.length).toBe(0);
    expect(finalUnit.activeCommand).toBeUndefined();
    expect(finalUnit.state).toBe(UnitState.Idle);
    // Final position should be in cell (3, 1)
    expect(Math.floor(finalUnit.pos.x)).toBe(3);
    expect(Math.floor(finalUnit.pos.y)).toBe(1);
  });
});
