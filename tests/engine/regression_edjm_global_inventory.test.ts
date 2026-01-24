import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CommandType,
  MapDefinition,
  CellType,
  GameState,
  Command,
} from "@src/shared/types";

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

    const units = (engine as unknown as { state: GameState }).state.units;
    units[0].hp = 50;

    const cmd: Command = {
      type: CommandType.USE_ITEM,
      unitIds: [units[0].id],
      itemId: "medkit",
      target: { x: 1, y: 1 },
    };

    engine.applyCommand(cmd);
    engine.update(100); // Trigger Channeling start
    // Process Channeling completion (Scaled: 3000 * 30/20 = 4500)
    engine.update(4500);

    const state = engine.getState();
    expect(state.squadInventory["medkit"]).toBe(0);
    expect(state.units[0].hp).toBe(100);
  });
});
