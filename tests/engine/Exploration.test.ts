import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  MissionType,
  CommandType,
} from "@src/shared/types";

describe("Exploration Logic", () => {
  it("should not explore deep into a dead end if it is already visible", () => {
    // 10x1 Corridor
    // 0123456789
    // S.........

    const map: MapDefinition = {
      width: 10,
      height: 1,
      cells: [],
      spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 0 }],
      objectives: [
        {
          id: "obj_explore",
          kind: "Recover",
          targetCell: { x: 99, y: 0 },
        },
      ],
    };

    for (let x = 0; x < 10; x++) {
      map.cells.push({
        x,
        y: 0,
        type: CellType.Floor,
      });
    }

    const engine = new CoreEngine(
      map,
      1,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      true,
      false,
    );

    engine.applyCommand({
      type: CommandType.EXPLORE,
      unitIds: [engine.getState().units[0].id],
    });

    // Initial state
    let state = engine.getState();
    let soldier = state.units[0];

    // Soldier sight range is usually 10.
    // At x=0.5, he should see to x=10.5 (entire map).

    // Run a few ticks
    for (let i = 0; i < 20; i++) {
      // 2 seconds
      engine.update(100);
    }

    state = engine.getState();
    soldier = state.units[0];

    // He should be Idle at 0,0 (or near extraction)
    // Or at least NOT at 9,0.

    // If logic is bad, he might be moving towards 9

    // Let's force him to NOT have extraction at 0,0 to avoid "Go to extraction" logic interfering.
    // Let's put extraction at 0,0.
    // If map is fully discovered, he goes to extraction.
    // If map is NOT fully discovered, he explores.

    // If he sees everything immediately, he should stay at 0,0 (Extraction).

    expect(state.discoveredCells.length).toBe(10); // Should see all
    expect(soldier.pos.x).toBeLessThan(2); // Should not have walked far
  });

  it("should explore a corner but not walk into the dead end after corner", () => {
    // 5x5 L shape
    // S . . . #
    // # # # . #
    // # # # . #
    // # # # . #
    // # # # . #

    // Actually simpler:
    // 0,0 -> 4,0 (Corridor)
    // 4,0 -> 4,4 (Dead end down)

    const map: MapDefinition = {
      width: 5,
      height: 5,
      cells: [],
      spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 0 }],
      objectives: [
        {
          id: "obj_explore",
          kind: "Recover",
          targetCell: { x: 9, y: 0 },
        },
      ],
    };

    // Top row 0..4
    for (let x = 0; x < 5; x++) {
      map.cells.push({
        x,
        y: 0,
        type: CellType.Floor,
      });
    }
    // Vertical col 4, y=1..4
    for (let y = 1; y < 5; y++) {
      map.cells.push({
        x: 4,
        y,
        type: CellType.Floor,
      });
    }

    // Fill rest as void/walls implicitly (not in cells array = void? No, Grid expects all cells usually?
    // Grid handles missing cells as Void/Wall usually.
    // But let's be safe and only add floors.

    const engine = new CoreEngine(
      map,
      1,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      true,
      false,
      MissionType.Default,
      false,
    );

    engine.applyCommand({
      type: CommandType.EXPLORE,
      unitIds: [engine.getState().units[0].id],
    });

    // Run enough time to reach corner
    // Distance to corner (4,0) is 4 tiles. Speed ~4 tiles/sec?
    // Grunt speed is usually 2.5 tiles/sec?
    // Let's run 50 ticks (5 seconds).

    const totalFloors = engine
      .getState()
      .map.cells.filter((c) => c.type === CellType.Floor).length;
    console.log(`Total Floor Cells: ${totalFloors}`);

    for (let i = 0; i < 100; i++) {
      engine.update(100);
      const s = engine.getState();
      const u = s.units[0];
      if (i % 10 === 0) {
        console.log(
          `Tick ${i}: Pos (${u.pos.x.toFixed(2)}, ${u.pos.y.toFixed(2)}), State: ${u.state}, Target: ${u.explorationTarget ? `${u.explorationTarget.x},${u.explorationTarget.y}` : "none"}, Discovered: ${s.discoveredCells.length}`,
        );
      }
    }

    const state = engine.getState();
    const soldier = state.units[0];
    console.log("Final Discovered Cells:", state.discoveredCells);

    // He should reach (4,0), look down to (4,4), see it, and turn back.
    // He should NOT walk to (4,4).

    // Check that he saw the end
    expect(state.discoveredCells).toContain("4,4");

    // Soldier should be near 4,0 or back at 0,0
    // Definitely not at 4,4
    expect(soldier.pos.y).toBeLessThan(2);
  });
});
