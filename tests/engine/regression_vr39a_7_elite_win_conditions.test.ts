import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MissionType,
  CellType,
  MapDefinition,
  SquadConfig,
  GameState,
  Objective,
  UnitState,
} from "@src/shared/types";

describe("Regression voidlock-vr39a.7: Elite Escort/DestroyHive win conditions", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [{ id: "spawn-1", pos: { x: 1, y: 1 }, radius: 1 }],
    squadSpawn: { x: 1, y: 1 },
    extraction: { x: 9, y: 9 },
    objectives: [],
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

  it("should LOSE Elite Escort mission if VIP extracts but other mandatory objectives are not complete", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.EscortVIP,
      false, 0, 1.0, false, undefined, [], true, 0, 3, 1, 0, "Elite"
    );

    const state = getInternalState(engine);
    expect(state.nodeType).toBe("Elite");
    // Escort + 1x Recover + 1x Kill Hive = 3 objectives
    expect(state.objectives.length).toBe(3);

    const escortObj = state.objectives.find(o => o.kind === "Escort");
    const otherObjs = state.objectives.filter(o => o.kind !== "Escort");
    expect(escortObj).toBeDefined();
    expect(otherObjs.length).toBe(2);

    // Complete ONLY Escort
    escortObj!.state = "Completed";
    // Mark VIP as extracted
    const vip = state.units.find(u => u.archetypeId === "vip");
    vip!.state = UnitState.Extracted;

    // Extract soldier too
    state.units.find(u => u.archetypeId === "assault")!.state = UnitState.Extracted;

    engine.update(100);

    // BUG: This currently WINS because it returns early in EscortVIP branch
    // DESIRED: Should be "Lost" because artifacts/hive are not complete
    expect(engine.getState().status).toBe("Lost");
  });

  it("should win Elite DestroyHive mission only after all objectives are complete and squad is gone", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.DestroyHive,
      false, 0, 1.0, false, undefined, [], true, 0, 3, 1, 0, "Elite"
    );

    const state = getInternalState(engine);
    expect(state.objectives.length).toBeGreaterThan(1);

    // Complete Hive but NOT artifacts
    const hiveObj = state.objectives.find(o => o.kind === "Kill");
    hiveObj!.state = "Completed";
    
    // Wipe squad
    state.units.forEach(u => u.hp = 0);
    engine.update(100);

    // Should be Lost because artifacts are pending
    expect(engine.getState().status).toBe("Lost");

    // Re-test with all complete
    const engine2 = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.DestroyHive,
      false, 0, 1.0, false, undefined, [], true, 0, 3, 1, 0, "Elite"
    );
    const state2 = getInternalState(engine2);
    state2.objectives.forEach(o => o.state = "Completed");
    state2.units.forEach(u => u.hp = 0);
    engine2.update(100);
    expect(engine2.getState().status).toBe("Won");
  });
});
