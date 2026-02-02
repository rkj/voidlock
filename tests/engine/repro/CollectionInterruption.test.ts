import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapDefinition, CellType, UnitState } from "@src/shared/types";

describe("Collection Interruption Repro", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [],
    extraction: { x: 9, y: 9 },
    objectives: [{ id: "obj1", kind: "Recover", targetCell: { x: 2, y: 2 } }],
  };

  // Fill cells
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  it("should start collection and NOT be interrupted by autonomous exploration", () => {
    // Enable agent control (AI)
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      true, // agentControlEnabled: true
      false,
    );

    const realUnit = (engine as any).state.units[0];

    // Set initial discovery: only 0,0 is discovered.
    // We want the unit to move to 2,2 (objective) and THEN have plenty of undiscovered cells to want to explore.
    (engine as any).state.discoveredCells = ["0,0", "0,1", "1,0", "1,1", "2,2"];

    // Teleport unit near objective
    realUnit.pos = { x: 2.1, y: 2.1 };
    realUnit.state = UnitState.Idle;

    // Update once. It should see it's at objective and start channeling.
    engine.update(100);

    const unitAfterFirstUpdate = engine.getState().units[0];

    // If bug exists, unit might pick "Exploring" instead of "Collect"
    // Wait, the check for "Recover" objective is at the END of update.
    // The "Autonomous Exploration" is in the MIDDLE.

    // Let's check if it's channeling.
    expect(unitAfterFirstUpdate.state).toBe(UnitState.Channeling);
    expect(unitAfterFirstUpdate.channeling?.action).toBe("Collect");

    // Update again. It should CONTINUE channeling.
    engine.update(100);
    const unitAfterSecondUpdate = engine.getState().units[0];
    expect(unitAfterSecondUpdate.state).toBe(UnitState.Channeling);
  });
});
