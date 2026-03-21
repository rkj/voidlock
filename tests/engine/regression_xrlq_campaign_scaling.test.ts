import { describe, it, expect } from "vitest";
import { CoreEngine } from "../../src/engine/CoreEngine";
import {
  MissionType,
  EngineMode,
  MapGeneratorType,
} from "../../src/shared/types";
import { MapFactory } from "../../src/engine/map/MapFactory";
import { Director } from "../../src/engine/Director";
import { ItemEffectService } from "../../src/engine/managers/ItemEffectService";
import { PRNG } from "../../src/shared/PRNG";

describe("Director & Campaign Scaling Regression (xrlq)", () => {
  const mapConfig = {
    seed: 12345,
    width: 10,
    height: 10,
    type: MapGeneratorType.DenseShip,
    spawnPointCount: 1,
  };
  const map = MapFactory.generate(mapConfig);
  const squadConfig = { soldiers: [], inventory: {} };

  it("CoreEngine: should calculate correct startingPoints for Director at rank 0", () => {
    // Rank 0, base 3, growth 1.0 => startingPoints = 0 (Mission 1 safety)
    const engine = new CoreEngine({
      map: map,
      seed: 12345,
      squadConfig: squadConfig,
      agentControlEnabled: false,
      debugOverlayEnabled: false,
      missionType: MissionType.Default,
      losOverlayEnabled: false,
      startingThreatLevel: 0,
      initialTimeScale: // startingThreatLevel
      1.0,
      startPaused: true,
      mode: EngineMode.Simulation,
      initialCommandLog: [],
      allowTacticalPause: true,
      targetTick: 0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: // baseEnemyCount
      1.0,
      missionDepth: // enemyGrowthPerMission
      0,
      nodeType: // missionDepth
    });

    const state = engine.getState();
    // 0 enemies should be pre-spawned for Mission 1
    expect(state.enemies.length).toBe(0);
  });

  it("CoreEngine: should calculate correct startingPoints for Director at rank 5", () => {
    // Rank 5, base 3, growth 1.0 => startingPoints = 3 + 5*1 = 8
    const engine = new CoreEngine({
      map: map,
      seed: 12345,
      squadConfig: squadConfig,
      agentControlEnabled: false,
      debugOverlayEnabled: false,
      missionType: MissionType.Default,
      losOverlayEnabled: false,
      startingThreatLevel: 0,
      initialTimeScale: 1.0,
      startPaused: true,
      mode: EngineMode.Simulation,
      initialCommandLog: [],
      allowTacticalPause: true,
      targetTick: 0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1.0,
      missionDepth: 5
    });

    const state = engine.getState();
    // 8 enemies should be pre-spawned
    expect(state.enemies.length).toBe(8);
  });

  it("Director: wave budget should include startingPoints base", () => {
    const prng = new PRNG(12345);
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const enemies: any[] = [];
    const onSpawn = (e: any) => enemies.push(e);

    // startingPoints = 3
    const director = new Director(spawnPoints, prng, onSpawn, new ItemEffectService(), 0, undefined, 3);

    // 10% threat (turn 1): budget = floor(1 * 1.0) = 1
    director.update(10000);
    expect(enemies.length).toBe(1);

    // 20% threat (turn 2): budget = floor(2 * 1.0) = 2
    director.update(10000);
    // Total should be 1 (previous) + 2 (new) = 3
    expect(enemies.length).toBe(3);
  });
});
