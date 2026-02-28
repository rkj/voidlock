import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapGenerator } from "@src/engine/MapGenerator";
import {
  MapDefinition,
  CellType,
  MissionType,
  UnitState,
  GameState,
  Unit,
} from "@src/shared/types";

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

  const getInternalState = (engine: CoreEngine): GameState =>
    (engine as any).state;

  it("should fail immediately if a VIP dies", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      false,
      false,
      MissionType.EscortVIP,
    );

    const vip = getInternalState(engine).units.find(
      (u: any) => u.archetypeId === "vip",
    );
    expect(vip).toBeDefined();

    // Kill the VIP
    vip!.hp = 0;

    engine.update(100);

    expect(engine.getState().status).toBe("Lost");
  });

  it("should support multiple VIPs and fail if any one dies", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      false,
      false,
      MissionType.EscortVIP,
    );

    // Manually add a second VIP for testing
    const vip2 = {
      ...engine.getState().units.find((u) => u.archetypeId === "vip")!,
    };
    vip2.id = "vip-2";
    engine.addUnit(vip2);

    expect(
      engine.getState().units.filter((u) => u.archetypeId === "vip").length,
    ).toBe(2);

    // Kill one of the VIPs
    getInternalState(engine).units.find((u: any) => u.id === "vip-2")!.hp = 0;

    engine.update(100);

    expect(engine.getState().status).toBe("Lost");
  });

  it("should require all VIPs to be extracted to win", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      false,
      false,
      MissionType.EscortVIP,
    );

    // Manually add a second VIP
    const vip2 = {
      ...engine.getState().units.find((u) => u.archetypeId === "vip")!,
    };
    vip2.id = "vip-2";
    vip2.pos = { x: 2.5, y: 2.5 }; // Near extraction
    engine.addUnit(vip2);

    // Extract first VIP
    getInternalState(engine).units.find((u: any) => u.id === "vip-1")!.state =
      UnitState.Extracted;

    engine.update(100);
    expect(engine.getState().status).toBe("Playing"); // Still one VIP left

    // Extract second VIP
    getInternalState(engine).units.find((u: any) => u.id === "vip-2")!.state =
      UnitState.Extracted;

    engine.update(100);
    expect(engine.getState().status).toBe("Playing"); // Still the assault soldier left

    // Extract the soldier
    getInternalState(engine).units.find((u: any) => u.archetypeId === "assault")!.state =
      UnitState.Extracted;

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
      spawnPoints: [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
    };

    // Fill map with floor cells and assign rooms to quadrants
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const qx = x < 5 ? 0 : 1;
        const qy = y < 5 ? 0 : 1;
        mapWithRooms.cells.push({
          x,
          y,
          type: CellType.Floor,
          roomId: `room-${qx}-${qy}`,
        });
      }
    }

    const engine = new CoreEngine(
      mapWithRooms,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      false,
      false,
      MissionType.EscortVIP,
    );

    const vip = engine.getState().units.find((u) => u.archetypeId === "vip");
    expect(vip).toBeDefined();

    // Squad is in (0,0) quadrant. VIP should be in (1,0), (0,1), or (1,1).
    const vipQX = vip!.pos.x < 5 ? 0 : 1;
    const vipQY = vip!.pos.y < 5 ? 0 : 1;

    expect(vipQX !== 0 || vipQY !== 0).toBe(true);
  });

  it("should unlock VIP only when a soldier is nearby or in LOS", () => {
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
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      true,
      false,
      MissionType.EscortVIP,
      false,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Combat",
      undefined,
      0,
    );

    const vip = getInternalState(engine2).units.find(
      (u: Unit) => u.archetypeId === "vip",
    )!;
    const soldier = getInternalState(engine2).units.find(
      (u: Unit) => u.archetypeId === "assault",
    )!;

    // Ensure VIP is in the room with 'O'
    vip.pos = { x: 2.5, y: 0.5 };
    soldier.pos = { x: 0.5, y: 0.5 };
    vip.aiEnabled = false;

    engine2.update(100);
    expect(
      getInternalState(engine2).units.find((u: any) => u.archetypeId === "vip")!
        .aiEnabled,
    ).toBe(false); // Blocked by wall

    // Move soldier to (1.5, 0.5) - now in same room area as VIP (1,0 and 2,0 are connected)
    getInternalState(engine2).units.find(
      (u: any) => u.archetypeId === "assault",
    )!.pos = { x: 1.5, y: 0.5 };
    engine2.update(100);

    const updatedVip = getInternalState(engine2).units.find(
      (u: any) => u.archetypeId === "vip",
    )!;
    expect(updatedVip.aiEnabled).toBe(true);
  });
});
