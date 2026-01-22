import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { GameState, BoundaryType } from "../../../src/shared/types";
import { Graph } from "../../../src/engine/Graph";

describe("Broken Walls Reproduction", () => {
  it("should have correct boundaries matching the map definition", () => {
    // Load the bad JSON
    const jsonPath = join(
      process.cwd(),
      "tests/data/goldens/2026-01-08_6x6-dense-bad.json",
    );
    const jsonContent = readFileSync(jsonPath, "utf-8");
    const exportData = JSON.parse(jsonContent);
    const mapDef = exportData.currentState.map;

    // Build the graph
    const graph = new Graph(mapDef);

    // Verify a few specific walls that look like they should exist
    // Based on the JSON, there is a wall between (0,0) and (1,0)
    // { "p1": { "x": 0, "y": 0 }, "p2": { "x": 1, "y": 0 } } -> Wall on top of 0,0? No.
    // Wait, p1-p2 define the segment.
    // If p1=(0,0) and p2=(1,0), that is the Top edge of cell (0,0).
    // Or is it the bottom edge of (0,-1)?

    // Let's look at MapGenerator.ts / Graph.ts logic for Wall hydration.
    // if (wall.p1.x === wall.p2.x) { // Vertical
    //   x = p1.x, y = min(p1.y, p2.y)
    //   x1 = x - 1, y1 = y, x2 = x, y2 = y
    // } else { // Horizontal
    //   y = p1.y, x = min(p1.x, p2.x)
    //   x1 = x, y1 = y - 1, x2 = x, y2 = y
    // }

    // Case 1: Wall at p1(0,0), p2(1,0) (Horizontal)
    // y=0, x=0.
    // Boundary between (0, -1) and (0, 0).
    // (0, -1) is invalid/void. (0, 0) is valid.
    // This is the TOP wall of the map.

    const topWall = graph.getBoundary(0, -1, 0, 0);
    expect(topWall).toBeDefined();
    expect(topWall?.type).toBe(BoundaryType.Wall);

    // Case 2: Internal wall?
    // Let's find a wall in the list that is between two valid cells.
    // JSON walls include: { p1: {x: 1, y: 0}, p2: {x: 2, y: 0} } -> Top of (1,0)?

    // Let's search for a vertical wall inside the map.
    // { p1: {x: 2, y: 0}, p2: {x: 2, y: 1} }
    // Vertical. x=2, y=0.
    // Boundary between (1, 0) and (2, 0).
    // Cell (1,0) is Floor (room-0-0)
    // Cell (2,0) is Floor (corridor-v-spine)

    // Check if this wall exists in the Graph
    const internalWall = graph.getBoundary(1, 0, 2, 0);
    expect(internalWall).toBeDefined();

    // In this specific bad JSON, there is BOTH a wall and a door at this boundary.
    // The Graph constructor (and sanitize) should prefer Door.
    // If the bug was "soldiers walking through rendered walls", it's because both were present
    // and the renderer might have drawn the wall even if it was an open door.
    expect(internalWall?.type).toBe(BoundaryType.Door);
    expect(internalWall?.doorId).toBe("door-5");

    // Let's verify doors too
    // Door door-1 at segment [(2,0), (3,0)]
    const doorBoundary = graph.getBoundary(2, 0, 3, 0);
    expect(doorBoundary).toBeDefined();
    expect(doorBoundary?.type).toBe(BoundaryType.Door);
    expect(doorBoundary?.doorId).toBe("door-1");
  });
});
