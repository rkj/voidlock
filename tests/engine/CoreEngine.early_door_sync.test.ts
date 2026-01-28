import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CellType,
  MapDefinition,
  MissionType,
  AIProfile,
  UnitState,
  BoundaryType,
} from "@src/shared/types";

describe("CoreEngine Early Door Sync", () => {
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

  it("should update Graph boundary type IMMEDIATELY when door starts opening", () => {
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
    expect(boundary?.type).toBe(BoundaryType.Door); // Initially closed

    // Trigger door open
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 10,
      maxHp: 10,
      state: UnitState.Idle,
      stats: {
        damage: 1,
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 1,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      aiEnabled: true,
      commandQueue: [],
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    // Run update to trigger "Opening" logic (timer start)
    engine.update(100);
    const door = (engine as any).doorManager.getDoors().get("door1");
    expect(door.targetState).toBe("Open");
    expect(door.openTimer).toBe(500);

    // CHECK: Boundary should already be Open (Early Visibility)
    expect(boundary?.type).toBe(BoundaryType.Open);

    // Run update to complete timer
    engine.update(600);
    const doorFinal = (engine as any).doorManager.getDoors().get("door1");
    expect(doorFinal.state).toBe("Open");
    expect(boundary?.type).toBe(BoundaryType.Open);
  });
});
