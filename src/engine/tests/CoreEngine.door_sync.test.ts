import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import { CellType, MapDefinition, MissionType } from "../../shared/types";

describe("CoreEngine Door Sync", () => {
  const mockMap: MapDefinition = {
    width: 3,
    height: 1,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
    ],
    doors: [
      {
        id: "door1",
        segment: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        orientation: "Vertical",
        state: "Closed",
        hp: 100,
        maxHp: 100,
        openDuration: 0.5, // 500ms
      },
    ],
    spawnPoints: [],
    objectives: [],
  };

  it("should update Graph boundary isWall when door opens", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [], inventory: {} },
      false,
      false,
      MissionType.Default,
    );
    const grid = (engine as any).gameGrid;
    const graph = grid.getGraph();
    const boundary = graph.getBoundary(0, 0, 1, 0);

    expect(boundary).toBeDefined();
    expect(boundary?.isWall).toBe(true); // Initially closed

    // Trigger door open
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 10,
      maxHp: 10,
      state: "Idle" as any,
      damage: 1,
      fireRate: 500,
      accuracy: 1000,
      attackRange: 2,
      sightRange: 5,
      speed: 1,
      aiEnabled: true,
      commandQueue: [],
      archetypeId: "assault",
    });

    // Run update to trigger "Opening" logic (timer start)
    engine.update(100);
    const door = (engine as any).doors.get("door1");
    expect(door.targetState).toBe("Open");
    expect(door.openTimer).toBe(500);

    // Run update to complete timer
    engine.update(600);
    expect(door.state).toBe("Open");

    // CHECK: Boundary should now be NOT a wall
    expect(boundary?.isWall).toBe(false);
  });

  it("should update Graph boundary isWall when door closes", () => {
    // Setup with OPEN door
    const mapWithOpenDoor = JSON.parse(JSON.stringify(mockMap));
    mapWithOpenDoor.doors[0].state = "Open";

    const engine = new CoreEngine(
      mapWithOpenDoor,
      123,
      { soldiers: [], inventory: {} },
      false,
      false,
      MissionType.Default,
    );
    const grid = (engine as any).gameGrid;
    const graph = grid.getGraph();
    const boundary = graph.getBoundary(0, 0, 1, 0);

    // Add a unit far away to keep game in 'Playing' state (otherwise empty squad = Lost)
    engine.addUnit({
      id: "u_anchor",
      pos: { x: 2.5, y: 0.5 }, // Far from door (boundary 0,0-1,0)
      hp: 10,
      maxHp: 10,
      state: "Idle" as any,
      damage: 1,
      fireRate: 500,
      accuracy: 1000,
      attackRange: 2,
      sightRange: 5,
      speed: 1,
      aiEnabled: true,
      commandQueue: [],
      archetypeId: "assault",
    });

    // Initial state check: Boundary should be OPEN (isWall: false)
    expect(boundary?.isWall).toBe(false);

    // Update to trigger Close logic (starts timer)
    engine.update(100);
    const door = (engine as any).doors.get("door1");
    expect(door.targetState).toBe("Closed");
    expect(door.openTimer).toBe(500);

    // Update to complete timer
    engine.update(600);
    expect(door.state).toBe("Closed");

    expect(boundary?.isWall).toBe(true);
  });
});
