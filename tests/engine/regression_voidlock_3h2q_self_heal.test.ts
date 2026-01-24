import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CommandType,
  MapDefinition,
  CellType,
} from "@src/shared/types";

describe("Medkit Restriction (voidlock-3h2q)", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [],
    squadSpawn: { x: 2, y: 2 },
  };
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  it("Medkit should only heal self even if targetUnitId is specified", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [
          { archetypeId: "assault", id: "unit-1", hp: 50, maxHp: 100 },
          { archetypeId: "medic", id: "unit-2", hp: 10, maxHp: 100 },
        ],
        inventory: { medkit: 1 },
      },
      false,
      false,
    );

    const stateBefore = engine.getState();
    const unit1Before = stateBefore.units.find((u) => u.id === "unit-1")!;
    const unit2Before = stateBefore.units.find((u) => u.id === "unit-2")!;
    expect(unit1Before.hp).toBe(50);
    expect(unit2Before.hp).toBe(10);

    // Unit 1 uses medkit, but specifies Unit 2 as target
    const cmd: any = {
      type: CommandType.USE_ITEM,
      unitIds: ["unit-1"],
      itemId: "medkit",
      targetUnitId: "unit-2",
    };

    engine.applyCommand(cmd);

    // Advance time to complete channeling
    // Assault speed 20. Base 3000ms * (30/20) = 4500ms.
    engine.update(5000, 5000);

    const finalState = engine.getState();
    const finalUnit1 = finalState.units.find((u) => u.id === "unit-1")!;
    const finalUnit2 = finalState.units.find((u) => u.id === "unit-2")!;

    // Unit 1 should be healed (50 + 50 = 100)
    expect(finalUnit1.hp).toBe(100);
    // Unit 2 should NOT be healed
    expect(finalUnit2.hp).toBe(10);
    expect(finalState.squadInventory["medkit"]).toBe(0);
  });
});
