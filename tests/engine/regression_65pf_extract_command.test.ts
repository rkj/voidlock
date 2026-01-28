import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CommandType,
  MissionType,
  UnitState,
  CellType,
} from "@src/shared/types";

describe("Regression 65pf: Extract Command", () => {
  let engine: CoreEngine;
  const mockMap = {
    width: 5,
    height: 5,
    cells: [
      { x: 0, y: 0, type: CellType.Floor, roomId: "room-1" },
      { x: 1, y: 0, type: CellType.Floor, roomId: "room-1" },
      { x: 2, y: 0, type: CellType.Floor, roomId: "room-1" },
      { x: 3, y: 0, type: CellType.Floor, roomId: "room-1" },
      { x: 4, y: 0, type: CellType.Floor, roomId: "room-1" },
      { x: 4, y: 1, type: CellType.Floor, roomId: "room-1" },
      { x: 4, y: 2, type: CellType.Floor, roomId: "room-1" },
      { x: 4, y: 3, type: CellType.Floor, roomId: "room-1" },
      { x: 4, y: 4, type: CellType.Floor, roomId: "room-1" },
    ],
    extraction: { x: 4, y: 4 },
    squadSpawn: { x: 0, y: 0 },
    objectives: [{ id: "obj-1", kind: "Recover", targetCell: { x: 1, y: 1 } }],
  } as any;

  const squadConfig = {
    soldiers: [{ archetypeId: "scout", id: "u1" }],
    inventory: {},
  };

  beforeEach(() => {
    engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      true,
      MissionType.Default,
    );
  });

  it("should move unit to extraction point when EXTRACT command is issued", () => {
    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.id).toBe("u1");

    engine.applyCommand({
      type: CommandType.EXTRACT,
      unitIds: ["u1"],
    });

    // Update engine to let unit start moving
    engine.update(100);

    const updatedState = engine.getState();
    const updatedUnit = updatedState.units[0];
    expect(updatedUnit.activeCommand?.type).toBe(CommandType.EXTRACT);
    expect(updatedUnit.state).toBe(UnitState.Moving);

    // Check path is set to extraction
    expect(updatedUnit.path).toBeDefined();
    const lastPathPoint = updatedUnit.path![updatedUnit.path!.length - 1];
    expect(lastPathPoint.x).toBe(4);
    expect(lastPathPoint.y).toBe(4);
  });

  it("should start extraction channeling even if objectives are NOT complete", () => {
    // Objective is Pending
    expect(engine.getState().objectives[0].state).toBe("Pending");

    // Teleport unit to extraction
    const state = engine.getState();
    const unit = state.units[0];
    unit.pos = { x: 4.5, y: 4.5 };
    // We need to reach into the internal state or just apply a command that moves it there
    // Actually, CoreEngine doesn't let us easily teleport, but we can mock it for test.

    // Let's use the command and then teleport internal unit
    engine.applyCommand({
      type: CommandType.EXTRACT,
      unitIds: ["u1"],
    });

    // Access internal unit to teleport
    (engine as any).state.units[0].pos = { x: 4.5, y: 4.5 };
    (engine as any).state.units[0].state = UnitState.Idle;
    (engine as any).state.units[0].path = undefined;
    (engine as any).state.units[0].targetPos = undefined;

    // Update engine
    engine.update(100);

    const updatedState = engine.getState();
    const updatedUnit = updatedState.units[0];

    expect(updatedUnit.state).toBe(UnitState.Channeling);
    expect(updatedUnit.channeling?.action).toBe("Extract");
  });

  it("should complete extraction correctly", () => {
    engine.applyCommand({
      type: CommandType.EXTRACT,
      unitIds: ["u1"],
    });

    (engine as any).state.units[0].pos = { x: 4.5, y: 4.5 };
    (engine as any).state.units[0].state = UnitState.Idle;
    (engine as any).state.units[0].path = undefined;
    (engine as any).state.units[0].targetPos = undefined;
    (engine as any).state.units[0].stats.speed = 60;

    // Start channeling
    engine.update(100);
    expect(engine.getState().units[0].state).toBe(UnitState.Channeling);

    // Extraction duration is 5000ms * (30/speed). Scout speed is 30.
    // So 5000 * 1.0 = 5000ms.
    engine.update(6000);

    expect(engine.getState().units[0].state).toBe(UnitState.Extracted);
  });
});
