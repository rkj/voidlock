import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { CommandType, MapDefinition, CellType } from "@src/shared/types";

describe("Stimpack Item", () => {
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

  it("should heal the unit instantly by 25 HP", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [{ archetypeId: "assault" }],
        inventory: { stimpack: 1 },
      },
      false,
      false,
    );

    const units = (engine as any).state.units;
    units[0].hp = 50;

    const cmd: any = {
      type: CommandType.USE_ITEM,
      unitIds: [units[0].id],
      itemId: "stimpack",
      target: { x: 1, y: 1 },
    };

    engine.applyCommand(cmd);

    // Stimpack is instant, so even a small update should apply it
    // Wait, Director.handleUseItem is called by UnitManager when channelTime completes.
    // If channelTime is 0/undefined, it happens in the same tick if UnitManager detects it.

    engine.update(100, 100);

    const state = engine.getState();
    expect(state.squadInventory["stimpack"]).toBe(0);
    // Assault base HP is 100. 50 + 25 = 75.
    expect(state.units[0].hp).toBe(75);
  });
});
