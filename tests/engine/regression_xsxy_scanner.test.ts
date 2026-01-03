import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CommandType,
  CellType,
  MapDefinition,
  UseItemCommand,
} from "@src/shared/types";

describe("Scanner Item Regression", () => {
  const mockMap: MapDefinition = {
    width: 20,
    height: 20,
    cells: [],
    squadSpawn: { x: 1, y: 1 },
  };
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  it("should reveal FOW in a radius when scanner is used", () => {
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

    const target = { x: 10, y: 10 };
    const cmd: UseItemCommand = {
      type: CommandType.USE_ITEM,
      itemId: "scanner",
      target,
    };

    const targetKey = `${target.x},${target.y}`;
    expect(engine.getState().discoveredCells).not.toContain(targetKey);

    engine.applyCommand(cmd);

    const state = engine.getState();
    expect(state.squadInventory["scanner"]).toBe(0);
    expect(state.discoveredCells).toContain(targetKey);
    // Check some points in radius
    expect(state.discoveredCells).toContain(`${target.x + 3},${target.y}`);
    expect(state.discoveredCells).not.toContain(`${target.x + 6},${target.y}`);
  });
});
