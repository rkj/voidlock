import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CommandType,
  GameState,
  MapDefinition,
  CellType,
  EngineMode,
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

    const units = (engine as any).state.units;
    units[0].hp = 50;

    const cmd: any = {
      type: CommandType.USE_ITEM,
      unitIds: [units[0].id],
      itemId: "medkit",
      target: { x: 1, y: 1 },
    };

    engine.applyCommand(cmd);
    engine.update(100); // Trigger Channeling start
    engine.update(3100, 3100); // Process Channeling completion (Scaled: 2000 * 30/20 = 3000)

    const state = engine.getState();
    expect(state.squadInventory["medkit"]).toBe(0);
    expect(state.units[0].hp).toBe(100);
  });
});
