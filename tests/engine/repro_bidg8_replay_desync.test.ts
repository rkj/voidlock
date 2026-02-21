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

describe("Replay Determinism & Desync Fix (bidg8)", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [],
    walls: [],
    spawnPoints: [{ id: "sp1", pos: { x: 1, y: 1 }, radius: 1 }],
    squadSpawns: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
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
        tacticalNumber: 1,
      },
    ],
    inventory: {},
  };

  const prune = (s: any) => {
    const { snapshots, commandLog, ...rest } = s;
    if (rest.settings) {
      delete rest.settings.mode;
    }
    return rest;
  };

  it("should be deterministic when skipDeployment and startingThreatLevel MATCH", () => {
    const seed = 42;
    const skipDeployment = false;
    const startingThreatLevel = 25;

    // 1. Play session
    const engine1 = new CoreEngine(
      mockMap, seed, defaultSquad, false, false, MissionType.Default, false, 
      startingThreatLevel, 1.0, false, EngineMode.Simulation, [], true, 0, 1, 1, 0, "Combat", 
      undefined, undefined, skipDeployment
    );

    engine1.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitIds: ["s1"],
      unitId: "s1",
      target: { x: 0.5, y: 0.5 },
    });
    engine1.applyCommand({ type: CommandType.START_MISSION });

    for (let i = 0; i < 100; i++) engine1.update(16);
    const state1 = engine1.getState(false);
    const log = state1.commandLog!;

    // 2. Replay session with MATCHING parameters
    const engine2 = new CoreEngine(
      mockMap, seed, defaultSquad, false, false, MissionType.Default, false, 
      startingThreatLevel, 1.0, false, EngineMode.Replay, log, true, 0, 1, 1, 0, "Combat", 
      undefined, undefined, skipDeployment
    );

    for (let i = 0; i < 100; i++) engine2.update(16);
    const state2 = engine2.getState(false);

    expect(prune(state2)).toEqual(prune(state1));
    expect(state2.rngState).toBe(state1.rngState);
  });

  it("should diverge when skipDeployment MISMATCHES", () => {
    const seed = 42;

    const engine1 = new CoreEngine(
      mockMap, seed, defaultSquad, false, false, MissionType.Default, false, 
      0, 1.0, false, EngineMode.Simulation, [], true, 0, 1, 1, 0, "Combat", 
      undefined, undefined, false
    );
    engine1.applyCommand({ type: CommandType.DEPLOY_UNIT, unitId: "s1", target: { x: 0.5, y: 0.5 } });
    engine1.applyCommand({ type: CommandType.START_MISSION });
    for (let i = 0; i < 100; i++) engine1.update(16);
    const state1 = engine1.getState(false);

    const engine2 = new CoreEngine(
      mockMap, seed, defaultSquad, false, false, MissionType.Default, false, 
      0, 1.0, false, EngineMode.Replay, state1.commandLog!, true, 0, 1, 1, 0, "Combat", 
      undefined, undefined, true
    );
    for (let i = 0; i < 100; i++) engine2.update(16);
    const state2 = engine2.getState(false);

    expect(state2.rngState).not.toBe(state1.rngState);
  });

  it("should diverge when startingThreatLevel MISMATCHES", () => {
    const seed = 42;

    const engine1 = new CoreEngine(
      mockMap, seed, defaultSquad, false, false, MissionType.Default, false, 
      0, 1.0, false, EngineMode.Simulation, [], true, 0, 1, 1, 0, "Combat", 
      undefined, undefined, true
    );
    for (let i = 0; i < 100; i++) engine1.update(16);
    const state1 = engine1.getState(false);

    const engine2 = new CoreEngine(
      mockMap, seed, defaultSquad, false, false, MissionType.Default, false, 
      50, 1.0, false, EngineMode.Replay, state1.commandLog!, true, 0, 1, 1, 0, "Combat", 
      undefined, undefined, true
    );
    for (let i = 0; i < 100; i++) engine2.update(16);
    const state2 = engine2.getState(false);

    expect(state2.rngState).not.toBe(state1.rngState);
  });
});
