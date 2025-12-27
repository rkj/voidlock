import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import { CellType, MapDefinition, MissionType, UnitState } from "../../shared/types";

describe("UnitManager Door Movement", () => {
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

  it("should NOT allow movement through a door that is still opening", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      [],
      false,
      false,
      MissionType.Default,
    );

    // Add unit at (0,0) moving to (1,0)
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 10,
      maxHp: 10,
      state: UnitState.Idle,
      damage: 1,
      fireRate: 100,
      attackRange: 5,
      sightRange: 5,
      speed: 2, // 2 tiles per second
      aiEnabled: true,
      commandQueue: [{
          type: "MOVE_TO" as any,
          unitIds: ["u1"],
          target: { x: 1, y: 0 }
      }],
      archetypeId: "assault",
    });

    // Update 1: Door starts opening
    engine.update(100);
    const state1 = engine.getState();
    const u1_1 = state1.units.find(u => u.id === "u1")!;
    const door1 = state1.map.doors![0];
    
    expect(door1.targetState).toBe("Open");
    expect(door1.state).toBe("Closed");
    
    // Unit should be "Waiting for Door" and NOT have moved significantly
    expect(u1_1.state).toBe(UnitState.WaitingForDoor);
    expect(u1_1.pos.x).toBeCloseTo(0.5);

    // Update 2: Wait more but door still opening
    engine.update(200);
    const state2 = engine.getState();
    const u1_2 = state2.units.find(u => u.id === "u1")!;
    expect(u1_2.state).toBe(UnitState.WaitingForDoor);
    expect(u1_2.pos.x).toBeCloseTo(0.5);

    // Update 3: Door fully open
    engine.update(300); // 100 + 200 + 300 = 600 total ( > 500ms duration)
    const state3 = engine.getState();
    const u1_3 = state3.units.find(u => u.id === "u1")!;
    const door3 = state3.map.doors![0];
    expect(door3.state).toBe("Open");
    
    // Unit should now be moving
    expect(u1_3.state).toBe(UnitState.Moving);
  });
});
