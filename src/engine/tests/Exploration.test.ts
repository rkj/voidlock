import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  MissionType,
} from "../../shared/types";

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
      objectives: [],
      // extraction: undefined,
    };

    for (let x = 0; x < 10; x++) {
      map.cells.push({
        x,
        y: 0,
        type: CellType.Floor,
        walls: { n: true, e: x === 9, s: true, w: x === 0 },
      });
    }

    const engine = new CoreEngine(
      map,
      1,
      [{ archetypeId: "assault", count: 1 }],
      true,
      false,
    );

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

    // console.log(`Soldier pos: ${soldier.pos.x.toFixed(2)}, ${soldier.pos.y.toFixed(2)} State: ${soldier.state}`);

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
      spawnPoints: [],
      objectives: [],
      // extraction: undefined,
    };

    // Top row 0..4
    for (let x = 0; x < 5; x++) {
      map.cells.push({
        x,
        y: 0,
        type: CellType.Floor,
        walls: { n: true, s: x < 4, e: x === 4 ? false : false, w: x === 0 },
      });
    }
    // Vertical col 4, y=1..4
    for (let y = 1; y < 5; y++) {
      map.cells.push({
        x: 4,
        y,
        type: CellType.Floor,
        walls: { n: false, s: y === 4, e: true, w: true },
      });
    }

    // Fill rest as void/walls implicitly (not in cells array = void? No, Grid expects all cells usually?
    // Grid handles missing cells as Void/Wall usually.
    // But let's be safe and only add floors.

    const engine = new CoreEngine(
      map,
      1,
      [{ archetypeId: "assault", count: 1 }],
      true,
      false,
    );

    // Run enough time to reach corner
    // Distance to corner (4,0) is 4 tiles. Speed ~4 tiles/sec?
    // Grunt speed is usually 2.5 tiles/sec?
    // Let's run 50 ticks (5 seconds).

    for (let i = 0; i < 100; i++) {
      engine.update(100);
      const s = engine.getState().units[0];
      // console.log(`T=${i} Pos: ${s.pos.x.toFixed(1)},${s.pos.y.toFixed(1)} State: ${s.state} Target: ${s.targetPos?.x},${s.targetPos?.y}`);
    }

    const state = engine.getState();
    const soldier = state.units[0];

    // console.log(`Final Pos: ${soldier.pos.x},${soldier.pos.y} State: ${soldier.state}`);
    // console.log('Discovered:', state.discoveredCells);

    // He should reach (4,0), look down to (4,4), see it, and turn back.
    // He should NOT walk to (4,4).

    // Check that he saw the end
    expect(state.discoveredCells).toContain("4,4");

    // Soldier should be near 4,0 or back at 0,0
    // Definitely not at 4,4
    expect(soldier.pos.y).toBeLessThan(2);
  });
});
