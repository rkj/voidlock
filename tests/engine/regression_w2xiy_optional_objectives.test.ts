import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MissionType,
  CellType,
  MapDefinition,
  SquadConfig,
  GameState,
} from "@src/shared/types";

describe("Regression voidlock-w2xiy: Optional Objectives", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [{ id: "spawn-1", pos: { x: 1, y: 1 }, radius: 1 }],
    squadSpawn: { x: 1, y: 1 },
    extraction: { x: 9, y: 9 },
    objectives: [
      { id: "optional-recover", kind: "Recover", targetCell: { x: 5, y: 5 } }
    ],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor, roomId: "room-1" });
    }
  }

  const squadConfig: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  it("should NOT include map-defined Recover objectives as mandatory in DestroyHive missions", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.DestroyHive,
    );

    const state = engine.getState();
    
    // Find objectives
    const hiveObj = state.objectives.find(o => o.kind === "Kill");
    const recoverObj = state.objectives.find(o => o.kind === "Recover");

    expect(hiveObj).toBeDefined();
    // BUG: recoverObj should NOT be in state.objectives, or at least not mandatory
    expect(recoverObj).toBeUndefined();
  });

  it("should win DestroyHive mission when Hive is killed, even if optional objectives are pending", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.DestroyHive,
    );

    const state = (engine as any).state as GameState;
    
    // Manually complete Hive objective
    const hiveObj = state.objectives.find(o => o.kind === "Kill");
    expect(hiveObj).toBeDefined();
    if (hiveObj) hiveObj.state = "Completed";

    engine.update(100);
    
    // BUG: If optional-recover is in state.objectives, status will be "Playing" instead of "Won"
    expect(engine.getState().status).toBe("Won");
  });
});
