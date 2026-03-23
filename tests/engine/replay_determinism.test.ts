import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  EngineMode,
  CommandType,
  MissionType,
} from "@src/shared/types";

describe("Replay Determinism", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [],
    walls: [],
    spawnPoints: [{ id: "sp1", pos: { x: 1, y: 1 }, radius: 1 }],
    squadSpawns: [{ x: 0, y: 0 }],
    extraction: { x: 4, y: 4 },
  };

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  const defaultSquad: SquadConfig = {
    soldiers: [
      {
        id: "s1",
        name: "S1",
        archetypeId: "assault",
        pos: { x: 0, y: 0 },
        tacticalNumber: "1",
      },
    ],
    inventory: {},
  };

  it("should yield identical state after replay", () => {
    const seed = 42;

    // 1. Play session
    const engine1 = new CoreEngine({
      map: mockMap,
      seed: seed,
      squadConfig: defaultSquad,
      agentControlEnabled: false,
      debugOverlayEnabled: false,
      missionType: MissionType.Default,
      losOverlayEnabled: false,
      startingThreatLevel: 0,
      initialTimeScale: 1.0,
      startPaused: false,
      mode: EngineMode.Simulation,
      initialCommandLog: [],
      allowTacticalPause: true,
      targetTick: 0,
      baseEnemyCount: 1,
      enemyGrowthPerMission: 1,
      missionDepth: 0, nodeType: "Combat",
      campaignNodeId: undefined,
      startingPoints: undefined,
      skipDeployment: true,
      debugSnapshots: false
    });

    // Run for 100 ticks
    for (let i = 0; i < 100; i++) {
      engine1.update(16);
    }

    // Give a command at tick 1600
    engine1.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["s1"],
      target: { x: 3, y: 3 },
    });

    // Run for another 100 ticks
    for (let i = 0; i < 100; i++) {
      engine1.update(16);
    }

    const state1 = engine1.getState(false);
    const log = state1.commandLog!;
    // console.log("LOG:", JSON.stringify(log, null, 2));

    // 2. Replay session
    const engine2 = new CoreEngine({
      map: mockMap,
      seed: seed,
      squadConfig: defaultSquad,
      agentControlEnabled: false,
      debugOverlayEnabled: false,
      missionType: MissionType.Default,
      losOverlayEnabled: false,
      startingThreatLevel: 0,
      initialTimeScale: 1.0,
      startPaused: false,
      mode: EngineMode.Replay,
      initialCommandLog: log,
      allowTacticalPause: true,
      targetTick: 0,
      baseEnemyCount: 1,
      enemyGrowthPerMission: 1,
      missionDepth: 0, nodeType: "Combat",
      campaignNodeId: undefined,
      startingPoints: undefined,
      skipDeployment: true,
      debugSnapshots: false
    });

    // Run for 200 ticks
    for (let i = 0; i < 200; i++) {
      engine2.update(16);
    }

    const state2 = engine2.getState(false);

    // Compare states
    // We ignore fields that are allowed to differ (like snapshots or purely runtime flags if any)
    const prune = (s: any) => {
      const { snapshots, ...rest } = s;
      if (rest.settings) {
        delete rest.settings.mode;
      }
      return rest;
    };

    expect(prune(state2)).toEqual(prune(state1));
  });
});
