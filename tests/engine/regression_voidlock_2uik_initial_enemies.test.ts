import { describe, it, expect } from "vitest";
import { CoreEngine } from "../../src/engine/CoreEngine";
import {
  MissionType,
  EngineMode,
  MapGeneratorType,
} from "../../src/shared/types";
import { MapFactory } from "../../src/engine/map/MapFactory";

describe("Initial Enemy Spawns Regression (voidlock-2uik)", () => {
  const mapConfig = {
    seed: 12345,
    width: 10,
    height: 10,
    type: MapGeneratorType.DenseShip,
    spawnPointCount: 1,
  };
  const map = MapFactory.generate(mapConfig);
  const squadConfig = { soldiers: [], inventory: {} };

  it("CoreEngine: Mission 1 (rank 0) should contain 0 initial enemies on map", () => {
    // Rank 0 (Mission 1)
    // baseEnemyCount: 3, enemyGrowthPerMission: 1.0, missionDepth: 0
    // EXPECTATION: 0 initial roaming enemies for Mission 1.
    const engine = new CoreEngine(
      map,
      12345,
      squadConfig,
      false,
      false,
      MissionType.Default,
      false,
      0, // startingThreatLevel
      1.0,
      true,
      EngineMode.Simulation,
      [],
      true,
      0,
      3, // baseEnemyCount
      1.0, // enemyGrowthPerMission
      0, // missionDepth
    );

    const state = engine.getState();
    // This is expected to FAIL currently as it will likely return 3
    expect(state.enemies.length).toBe(0);
  });

  it("CoreEngine: Mission 2 (rank 1) should contain initial enemies on map", () => {
    // Rank 1 (Mission 2)
    // baseEnemyCount: 3, enemyGrowthPerMission: 1.0, missionDepth: 1
    // startingPoints = 3 + 1*1 = 4
    const engine = new CoreEngine(
      map,
      12345,
      squadConfig,
      false,
      false,
      MissionType.Default,
      false,
      0, // startingThreatLevel
      1.0,
      true,
      EngineMode.Simulation,
      [],
      true,
      0,
      3, // baseEnemyCount
      1.0, // enemyGrowthPerMission
      1, // missionDepth
    );

    const state = engine.getState();
    // For rank 1, we expect scaling to kick in.
    // 3 (base) + 1 (depth) * 1 (growth) = 4
    expect(state.enemies.length).toBe(4);
  });
});
