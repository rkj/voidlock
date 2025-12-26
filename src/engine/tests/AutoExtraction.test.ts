import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import { MapDefinition, CellType, UnitState } from "../../shared/types";

describe("Auto Extraction Logic", () => {
  it("should proceed to extraction immediately when objectives are complete, ignoring unexplored areas", () => {
    // Map: 20x1 Corridor
    // S/E . . . . . . . . . . . . . . . . . . . U
    // S/E at 0,0. U (Undiscovered) at 19,0.

    const map: MapDefinition = {
      width: 20,
      height: 1,
      cells: [],
      spawnPoints: [{ id: "sp1", pos: { x: 0.5, y: 0.5 }, radius: 0 }],
      objectives: [], // No objectives = All complete
      extraction: { x: 0, y: 0 },
    };

    for (let x = 0; x < 20; x++) {
      map.cells.push({
        x,
        y: 0,
        type: CellType.Floor,
        walls: { n: true, e: x === 19, s: true, w: x === 0 },
      });
    }

    const engine = new CoreEngine(
      map,
      1,
      [{ archetypeId: "assault", count: 1 }],
      true, // Agent control enabled
      false, // random seed
    );

    // Initial tick to spawn
    engine.update(100);

    const unit = engine.getState().units[0];

    // Verify initial state
    expect(unit).toBeDefined();
    // expect(unit.pos.x).toBeCloseTo(0.5, 1);

    // Run a few ticks.
    // If logic is OLD: Unit will see it's not fully discovered (x=19 is far), pick exploration target.
    // If logic is NEW: Unit sees objectives complete, picks Extraction (which is here).

    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const updatedUnit = engine.getState().units[0];

    if (updatedUnit.explorationTarget) {
      console.log("Exploration Target:", updatedUnit.explorationTarget);
    } else {
      console.log("No Exploration Target (Correct for Auto-Extraction)");
    }

    // If logic is working, we expect NO exploration target, because we are extracting.
    expect(updatedUnit.explorationTarget).toBeUndefined();

    // Also, if we were exploring, we would be moving East.
    // If we are extracting (and already there), we should be near 0.
    expect(updatedUnit.pos.x).toBeLessThan(2);
  });
});
