import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapDefinition, CellType } from "@src/shared/types";

describe("Regression IHFP: Leveling Stat Boosts", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [{ x: 0, y: 0, type: CellType.Floor }],
    squadSpawn: { x: 0, y: 0 },
  };

  it("should apply soldierAim boost correctly in the engine", () => {
    const baseEngine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [
          {
            archetypeId: "assault",
            soldierAim: 90, // Level 1
          },
        ],
        inventory: {},
      },
      false,
      false,
    );
    const baseUnit = baseEngine.getState().units[0];
    expect(baseUnit.stats.soldierAim).toBe(90);
    expect(baseUnit.stats.accuracy).toBeGreaterThanOrEqual(90); // 90 + weapon bonus

    const boostedEngine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [
          {
            archetypeId: "assault",
            soldierAim: 95, // Level 2
          },
        ],
        inventory: {},
      },
      false,
      false,
    );
    const boostedUnit = boostedEngine.getState().units[0];
    expect(boostedUnit.stats.soldierAim).toBe(95);
    expect(boostedUnit.stats.accuracy).toBe(baseUnit.stats.accuracy + 5);
  });

  it("should apply HP boost correctly in the engine", () => {
    const boostedEngine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [
          {
            archetypeId: "assault",
            hp: 120,
            maxHp: 120,
          },
        ],
        inventory: {},
      },
      false,
      false,
    );
    const boostedUnit = boostedEngine.getState().units[0];
    expect(boostedUnit.hp).toBe(120);
    expect(boostedUnit.maxHp).toBe(120);
  });
});
