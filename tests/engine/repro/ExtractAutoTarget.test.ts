import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
} from "@src/shared/types";

describe("ExtractHandler Auto-Targeting Repro", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [],
    extraction: { x: 9, y: 9 }, // Bottom right
  };

  // Fill cells
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  it("should automatically pathfind to extraction zone when EXTRACT is issued", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ id: "u1", archetypeId: "scout" }], inventory: {} },
      false, // Manual control
      false,
    );

    const u1 = engine.getState().units[0];
    // Place unit at top left
    (u1 as any).pos = { x: 0.5, y: 0.5 };

    // Issue EXTRACT command without a target
    engine.applyCommand({
      type: CommandType.EXTRACT,
      unitIds: [u1.id],
    });

    // Update engine
    engine.update(100);

    const updatedU1 = engine.getState().units[0];
    
    // Unit should be MOVING
    expect(updatedU1.state).toBe(UnitState.Moving);
    
    // Unit should have a path
    expect(updatedU1.path).toBeDefined();
    expect(updatedU1.path!.length).toBeGreaterThan(0);
    
    // Final target in path should be (9,9)
    const lastPathPoint = updatedU1.path![updatedU1.path!.length - 1];
    expect(lastPathPoint.x).toBe(9);
    expect(lastPathPoint.y).toBe(9);
    
    // activeCommand should be EXTRACT
    expect(updatedU1.activeCommand?.type).toBe(CommandType.EXTRACT);
  });

  it("should immediately start interaction if unit is already in extraction zone", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ id: "u1", archetypeId: "scout" }], inventory: {} },
      false,
      false,
    );

    const u1 = engine.getState().units[0];
    // Place unit AT extraction (9,9)
    (u1 as any).pos = { x: 9.5, y: 9.5 };

    // Issue EXTRACT
    engine.applyCommand({
      type: CommandType.EXTRACT,
      unitIds: [u1.id],
    });

    // Update engine (1 tick)
    engine.update(100);

    const updatedU1 = engine.getState().units[0];
    
    // Unit should be CHANNELING
    expect(updatedU1.state).toBe(UnitState.Channeling);
    expect(updatedU1.channeling?.action).toBe("Extract");
  });

  it("should overwrite existing path when EXTRACT is issued", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ id: "u1", archetypeId: "scout" }], inventory: {} },
      false,
      false,
    );

    const u1 = engine.getState().units[0];
    (u1 as any).pos = { x: 0.5, y: 0.5 };

    // Move to (5,5) first
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [u1.id],
      target: { x: 5, y: 5 },
    });
    engine.update(100);
    
    const midMove = engine.getState().units[0];
    expect(midMove.state).toBe(UnitState.Moving);
    expect(midMove.targetPos?.x).not.toBe(9.5); // Should be moving to 5,5 neighborhood

    // Issue EXTRACT
    engine.applyCommand({
      type: CommandType.EXTRACT,
      unitIds: [u1.id],
    });
    engine.update(100);

    const afterExtract = engine.getState().units[0];
    expect(afterExtract.state).toBe(UnitState.Moving);
    
    // Final target in path should be (9,9)
    const lastPathPoint = afterExtract.path![afterExtract.path!.length - 1];
    expect(lastPathPoint.x).toBe(9);
    expect(lastPathPoint.y).toBe(9);
  });
});
