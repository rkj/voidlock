import { describe, it, expect } from "vitest";
import { CoreEngine } from "../../src/engine/CoreEngine";
import {
  MissionType,
  EngineMode,
  MapGeneratorType,
} from "../../src/shared/types";
import { MapFactory } from "../../src/engine/map/MapFactory";
import { Director } from "../../src/engine/Director";
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
    // Rank 0, base 3, growth 1.0 => startingPoints = 3 + 0*1 = 3
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
    // 3 enemies should be pre-spawned
    expect(state.enemies.length).toBe(3);
  });

  it("CoreEngine: should calculate correct startingPoints for Director at rank 5", () => {
    // Rank 5, base 3, growth 1.0 => startingPoints = 3 + 5*1 = 8
    const engine = new CoreEngine(
      map,
      12345,
      squadConfig,
      false,
      false,
      MissionType.Default,
      false,
      0,
      1.0,
      true,
      EngineMode.Simulation,
      [],
      true,
      0,
      3,
      1.0,
      5,
    );

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
    const director = new Director(spawnPoints, prng, onSpawn, 0, undefined, 3);

    // 10% threat (turn 1): budget = floor(1 * 1.0) = 1
    director.update(10000);
    expect(enemies.length).toBe(1);

    // 20% threat (turn 2): budget = floor(2 * 1.0) = 2
    director.update(10000);
    // Total should be 1 (previous) + 2 (new) = 3
    expect(enemies.length).toBe(3);
  });
});
