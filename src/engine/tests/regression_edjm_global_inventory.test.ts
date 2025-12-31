import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  CommandType,
  GameState,
  MapDefinition,
  CellType,
  EngineMode,
} from "../../shared/types";

describe("Global Squad Inventory", () => {
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
    squadSpawn: { x: 1, y: 1 },
  };

  it("should decrease global inventory count when USE_ITEM is called", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [{ archetypeId: "assault" }],
        inventory: { medkit: 1 },
      },
      false,
      false,
    );

    const initialUnit = engine.getState().units[0];
    initialUnit.hp = 50; // Damage it

    const cmd: any = {
      type: CommandType.USE_ITEM,
      itemId: "medkit",
      target: { x: 1, y: 1 },
    };

    engine.applyCommand(cmd);

    const state = engine.getState();
    expect(state.squadInventory["medkit"]).toBe(0);
    expect(state.units[0].hp).toBe(100);
  });
});
