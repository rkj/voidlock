import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import { MapGenerator } from "../MapGenerator";
import {
  MapDefinition,
  CellType,
  MissionType,
  UnitState,
} from "../../shared/types";

describe("VIP Mission Mechanics", () => {
  const mockMap: MapDefinition = {
    width: 3,
    height: 3,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
      { x: 2, y: 1, type: CellType.Floor },
      { x: 0, y: 2, type: CellType.Floor },
      { x: 1, y: 2, type: CellType.Floor },
      { x: 2, y: 2, type: CellType.Floor },
    ],
    squadSpawn: { x: 0, y: 0 },
    extraction: { x: 2, y: 2 },
  };

  it("should fail immediately if a VIP dies", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      [{ archetypeId: "assault", count: 1 }],
      false,
      false,
      MissionType.EscortVIP
    );

    const state = engine.getState();
    const vip = state.units.find(u => u.archetypeId === "vip");
    expect(vip).toBeDefined();

    // Kill the VIP
    const internalState = (engine as any).state;
    const internalVip = internalState.units.find((u: any) => u.archetypeId === "vip");
    internalVip.hp = 0;

    engine.update(100);

    expect(engine.getState().status).toBe("Lost");
  });

  it("should support multiple VIPs and fail if any one dies", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      [{ archetypeId: "assault", count: 1 }],
      false,
      false,
      MissionType.EscortVIP
    );

    // Manually add a second VIP for testing
    const vip2 = { ...engine.getState().units.find(u => u.archetypeId === "vip")! };
    vip2.id = "vip-2";
    engine.addUnit(vip2);

    expect(engine.getState().units.filter(u => u.archetypeId === "vip").length).toBe(2);

    // Kill one of the VIPs
    const internalState = (engine as any).state;
    const internalVip2 = internalState.units.find((u: any) => u.id === "vip-2");
    internalVip2.hp = 0;

    engine.update(100);

    expect(engine.getState().status).toBe("Lost");
  });

  it("should require all VIPs to be extracted to win", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      [{ archetypeId: "assault", count: 1 }],
      false,
      false,
      MissionType.EscortVIP
    );

    // Manually add a second VIP
    const vip2 = { ...engine.getState().units.find(u => u.archetypeId === "vip")! };
    vip2.id = "vip-2";
    vip2.pos = { x: 2.5, y: 2.5 }; // Near extraction
    engine.addUnit(vip2);

    // Extract first VIP
    const internalState = (engine as any).state;
    const internalVip1 = internalState.units.find((u: any) => u.id === "vip-1");
    internalVip1.state = UnitState.Extracted;

    engine.update(100);
    expect(engine.getState().status).toBe("Playing"); // Still one VIP left

    // Extract second VIP
    const internalVip2 = internalState.units.find((u: any) => u.id === "vip-2");
    internalVip2.state = UnitState.Extracted;

    engine.update(100);
    expect(engine.getState().status).toBe("Won");
  });

  it("should spawn VIP in a different quadrant than the squad", () => {
    const mapWithRooms: MapDefinition = {
      width: 10,
      height: 10,
      cells: [],
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 9, y: 9 },
      spawnPoints: [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }]
    };

    // Fill map with floor cells and assign rooms to quadrants
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const qx = x < 5 ? 0 : 1;
        const qy = y < 5 ? 0 : 1;
        mapWithRooms.cells.push({
          x, y,
          type: CellType.Floor,
          roomId: `room-${qx}-${qy}`
        });
      }
    }

    const engine = new CoreEngine(
      mapWithRooms,
      123,
      [{ archetypeId: "assault", count: 1 }],
      false,
      false,
      MissionType.EscortVIP
    );

    const vip = engine.getState().units.find(u => u.archetypeId === "vip");
    expect(vip).toBeDefined();
    
    // Squad is in (0,0) quadrant. VIP should be in (1,0), (0,1), or (1,1).
    const vipQX = vip!.pos.x < 5 ? 0 : 1;
    const vipQY = vip!.pos.y < 5 ? 0 : 1;
    
    expect(vipQX !== 0 || vipQY !== 0).toBe(true);
  });

  it("should unlock VIP only when a soldier is nearby or in LOS", () => {
    const asciiMap = `
+-+-+-+
|P| |V|
+ +-+ +
| | | |
+-+-+-+
    `.trim();
    // P is squad spawn at (0,0)
    // V is VIP at (2,0)
    // Wall between (0,0) and (2,0) is at x=1
    
    const mapWithWall = MapGenerator.fromAscii(asciiMap);
    
    const engine = new CoreEngine(
      mapWithWall,
      123,
      [{ archetypeId: "assault", count: 1 }],
      true, // Agent control enabled
      false,
      MissionType.EscortVIP
    );

    // Manually fix VIP position if fromAscii didn't place it (it uses 'S' for spawn, 'V' is not standard)
    // Actually fromAscii doesn't support 'V'. Let's use 'O' for objective and place VIP there.
    const asciiMap2 = `
+-+-+-+
|P| |O|
+ +-+ +
| | | |
+-+-+-+
    `.trim();
    const mapWithWall2 = MapGenerator.fromAscii(asciiMap2);
    
    const engine2 = new CoreEngine(
      mapWithWall2,
      123,
      [{ archetypeId: "assault", count: 1 }],
      true,
      false,
      MissionType.EscortVIP
    );

    const internalState = (engine2 as any).state;
    const vip = internalState.units.find((u: any) => u.archetypeId === "vip");
    const soldier = internalState.units.find((u: any) => u.archetypeId === "assault");
    
    // Ensure VIP is in the room with 'O'
    vip.pos = { x: 2.5, y: 0.5 };
    soldier.pos = { x: 0.5, y: 0.5 };
    vip.aiEnabled = false;

    engine2.update(100);
    expect(vip.aiEnabled).toBe(false); // Blocked by wall

    // Move soldier to (1,0) - still blocked by wall at x=1?
    // In our wall model, wall is BETWEEN cells.
    // The wall is between (0,0) and (1,0) in my ASCII? 
    // +-+-+-+
    // |P| |O|  <- wall is between P and empty cell.
    
    // Let's use coordinates. Wall at x=0.5 (between 0 and 1) and x=1.5 (between 1 and 2).
    // Cell (0,0) is P. Cell (1,0) is empty. Cell (2,0) is O.
    // Walls: (0,0)-(1,0) is '|' at x=1. (1,0)-(2,0) is ' ' (open).
    // Wait, the ASCII:
    // +-+-+-+
    // |P| |O|
    //   ^--- wall here.
    
    // So (0,0) and (1,0) are separated by a wall.
    // Soldier at (0.5, 0.5), VIP at (2.5, 0.5).
    // Line of sight must pass through (1,0). 
    // If there's a wall between (0,0) and (1,0), LOS is blocked.

    engine2.update(100);
    expect(vip.aiEnabled).toBe(false);

    // Move soldier to (1.5, 0.5) - now in same room area as VIP (1,0 and 2,0 are connected)
    soldier.pos = { x: 1.5, y: 0.5 };
    engine2.update(100);
    expect(vip.aiEnabled).toBe(true);
  });
});
