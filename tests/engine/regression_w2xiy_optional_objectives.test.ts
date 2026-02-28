import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MissionType,
  CellType,
  MapDefinition,
  SquadConfig,
  GameState,
  Unit,
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

  const getInternalState = (engine: CoreEngine): GameState =>
    (engine as any).state;

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
    // BUG FIX: recoverObj should NOT be in state.objectives
    expect(recoverObj).toBeUndefined();
  });

  it("should win DestroyHive mission when Hive is killed and squad is gone, even if optional objectives are pending", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.DestroyHive,
    );

    // Kill the hive
    const state = getInternalState(engine);
    const hive = state.enemies.find(e => e.id === "enemy-hive");
    expect(hive).toBeDefined();
    if (hive) hive.hp = 0;

    engine.update(100);
    // Should still be Playing because soldier is still on map
    expect(engine.getState().status).toBe("Playing");

    // Wipe squad (everyone off map)
    // Must use internal state to modify units
    getInternalState(engine).units.forEach((u: Unit) => (u.hp = 0));
    
    // Run enough updates to process death and win condition
    engine.update(100);
    
    // Should be "Won" now
    expect(engine.getState().status).toBe("Won");
  });
});
