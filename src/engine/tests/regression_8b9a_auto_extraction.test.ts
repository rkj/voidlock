import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapDefinition, CellType, CommandType } from "@src/shared/types";

describe("Regression 8b9a: Auto Extraction Discovery", () => {
  it("should NOT automatically order units to extract if the extraction point is undiscovered", () => {
    // Large map to ensure extraction is out of sight range
    const map: MapDefinition = {
      width: 200,
      height: 1,
      cells: [],
      squadSpawn: { x: 0, y: 0 },
      spawnPoints: [{ id: "sp1", pos: { x: 0.5, y: 0.5 }, radius: 0 }],
      objectives: [], // Objectives complete
      extraction: { x: 199, y: 0 },
      doors: [
        {
          id: "d1",
          segment: [
            { x: 100, y: 0 },
            { x: 101, y: 0 },
          ],
          orientation: "Vertical",
          state: "Closed",
          hp: 100,
          maxHp: 100,
          openDuration: 1,
        },
      ],
    };

    for (let x = 0; x < 200; x++) {
      map.cells.push({ x, y: 0, type: CellType.Floor });
    }

    const engine = new CoreEngine(
      map,
      1,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      true, // Agent control enabled
      false,
    );

    engine.applyCommand({
      type: CommandType.EXPLORE,
      unitIds: [engine.getState().units[0].id],
    });

    // Run a few ticks to allow thinking
    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const unit = state.units[0];

    // Verify extraction point is NOT discovered
    expect(state.discoveredCells).not.toContain("199,0");

    // Unit should NOT be extracting
    expect(unit.activeCommand?.label).not.toBe("Extracting");

    // Should be exploring instead
    expect(unit.activeCommand?.label).toBe("Exploring");
  });
});
