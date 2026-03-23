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

describe("Regression voidlock-lece: Elite/Boss mission completion", () => {
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

  it("should win Elite Default mission only after extraction, even if objectives are complete", () => {
    const engine = new CoreEngine({
      map: mockMap,
      seed: 1,
      squadConfig: squadConfig,
      agentControlEnabled: true,
      debugOverlayEnabled: false,
      missionType: MissionType.Default,
      losOverlayEnabled: false,
      startingThreatLevel: 0,
      initialTimeScale: 1.0,
      startPaused: false,
      mode: // startPaused
      undefined,
      initialCommandLog: // mode
      [],
      allowTacticalPause: true,
      targetTick: 0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1,
      missionDepth: 0,
      nodeType: "Elite"
    });

    const state = getInternalState(engine);
    expect(state.nodeType).toBe("Elite");
    expect(state.objectives.length).toBeGreaterThan(0);

    // Manually complete all objectives
    state.objectives.forEach((o: Objective) => (o.state = "Completed"));

    engine.update(100);

    // Should NOT win instantly anymore
    expect(engine.getState().status).toBe("Playing");

    // Now extract (use latest state reference)
    getInternalState(engine).units[0].state = UnitState.Extracted;
    engine.update(100);

    expect(engine.getState().status).toBe("Won");
  });

  it("should win Boss Default mission only after extraction", () => {
    const engine = new CoreEngine({
      map: mockMap,
      seed: 1,
      squadConfig: squadConfig,
      agentControlEnabled: true,
      debugOverlayEnabled: false,
      missionType: MissionType.Default,
      losOverlayEnabled: false,
      startingThreatLevel: 0,
      initialTimeScale: 1.0,
      startPaused: false,
      mode: undefined,
      initialCommandLog: [],
      allowTacticalPause: true,
      targetTick: 0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1,
      missionDepth: 0,
      nodeType: "Boss" as any,
    });

    const state = getInternalState(engine);
    expect(state.nodeType).toBe("Boss");

    state.objectives.forEach((o: Objective) => (o.state = "Completed"));
    engine.update(100);

    expect(engine.getState().status).toBe("Playing");

    getInternalState(engine).units[0].state = UnitState.Extracted;
    engine.update(100);

    expect(engine.getState().status).toBe("Won");
  });

  it("should still win DestroyHive instantly even if it is an Elite node", () => {
    const engine = new CoreEngine({
      map: mockMap,
      seed: 1,
      squadConfig: squadConfig,
      agentControlEnabled: true,
      debugOverlayEnabled: false,
      missionType: MissionType.DestroyHive,
      losOverlayEnabled: false,
      startingThreatLevel: 0,
      initialTimeScale: 1.0,
      startPaused: false,
      mode: undefined,
      initialCommandLog: [],
      allowTacticalPause: true,
      targetTick: 0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1,
      missionDepth: 0,
      nodeType: "Elite" as any,
    });

    const state = getInternalState(engine);
    state.objectives.forEach((o: Objective) => (o.state = "Completed"));
    engine.update(100);

    // DestroyHive now waits for everyone to extract/die per ADR 0032
    expect(engine.getState().status).toBe("Playing");

    // Wipe squad
    getInternalState(engine).units.forEach((u: any) => (u.hp = 0));
    engine.update(100);

    expect(engine.getState().status).toBe("Won");
  });
});
