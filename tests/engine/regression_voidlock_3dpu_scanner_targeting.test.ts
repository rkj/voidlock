import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CommandType,
  CellType,
  MapDefinition,
  UseItemCommand,
  BoundaryType,
} from "@src/shared/types";

describe("Scanner Targeting Regression (voidlock-3dpu)", () => {
  it("should reveal FOW centered on target unit when targetUnitId is provided", () => {
    const mockMap: MapDefinition = {
      width: 3,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Floor },
      ],
      squadSpawn: { x: 0, y: 0 },
      boundaries: [{ x1: 0, y1: 0, x2: 1, y2: 0, type: BoundaryType.Wall }],
    };

    const engine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [{ archetypeId: "assault" }],
        inventory: { scanner: 1 },
      },
      false,
      false,
    );

    // Run update to trigger initial visibility
    engine.update(16);

    const state = engine.getState();
    const soldier = state.units[0];
    expect(soldier).toBeDefined();

    // Initially, soldier at 0,0 should see 0,0 but not 1,0 because of the wall
    // Wait, if discoveredCells is STILL empty, then something is wrong with LOS or VisibilityManager
    expect(state.discoveredCells).toContain("0,0");
    expect(state.discoveredCells).not.toContain("1,0");

    const cmd: UseItemCommand = {
      type: CommandType.USE_ITEM,
      unitIds: [], // Global command
      itemId: "scanner",
      targetUnitId: soldier.id,
    };

    engine.applyCommand(cmd);

    const newState = engine.getState();
    expect(newState.squadInventory["scanner"]).toBe(0);
    expect(newState.discoveredCells).toContain("1,0");
  });
});
