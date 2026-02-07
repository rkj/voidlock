import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapFactory } from "@src/engine/map/MapFactory";
import { EngineMode, MissionType, MapGeneratorType } from "@src/shared/types";

describe("Simulation Determinism (Rigorous)", () => {
  const seeds = [12345, 67890, 424242];
  const ticksToRun = 15000; // 15 seconds of simulation
  const mapTypes = [MapGeneratorType.Procedural, MapGeneratorType.DenseShip];

  mapTypes.forEach((mapType) => {
    seeds.forEach((seed) => {
      it(
        `should produce identical final states for seed ${seed} on ${mapType} map`,
        { timeout: 60000 },
        () => {
          const mapConfig = {
            seed,
            width: 16,
            height: 16,
            type: mapType,
            spawnPointCount: 5,
          };

          const map = MapFactory.generate(mapConfig);
          const squadConfig = {
            soldiers: [
              { archetypeId: "assault" },
              { archetypeId: "scout" },
              { archetypeId: "heavy" },
              { archetypeId: "medic" },
            ],
            inventory: { medkit: 4, grenade: 4 },
          };

          // 1. Run Simulation
          const engineSim = new CoreEngine(
            map,
            seed,
            squadConfig,
            true, // agentControlEnabled
            false, // debug
            MissionType.Default,
            false, // losOverlay
            0, // startingThreat
            1.0, // timeScale
            false, // startPaused
            EngineMode.Simulation,
            [], // initialCommandLog
            true, // allowTacticalPause
            0, // targetTick
            5, // baseEnemyCount
            2, // enemyGrowthPerMission
            1, // missionDepth
            "Elite", // nodeType
            undefined, // campaignNodeId
            15, // startingPoints (Trigger pre-spawning)
          );

          // Run for some time
          for (let i = 0; i < ticksToRun; i += 16) {
            engineSim.update(16);
          }

          const finalSimState = engineSim.getState();
          const commandLog = [...(finalSimState.commandLog || [])];

          // 2. Run Replay
          const engineReplay = new CoreEngine(
            map,
            seed,
            squadConfig,
            true, // agentControlEnabled must be same as original
            false,
            MissionType.Default,
            false,
            0,
            1.0,
            false,
            EngineMode.Replay,
            commandLog,
            true,
            0,
            5,
            2,
            1,
            "Elite",
            undefined,
            15, // startingPoints
          );

          // Run for same time
          for (let i = 0; i < ticksToRun; i += 16) {
            engineReplay.update(16);
          }

          const finalReplayState = engineReplay.getState();

          // 3. Compare States
          expect(finalReplayState.t).toBe(finalSimState.t);
          expect(finalReplayState.status).toBe(finalSimState.status);

          // Compare unit counts and states
          expect(finalReplayState.units.length).toBe(
            finalSimState.units.length,
          );
          finalSimState.units.forEach((simUnit, idx) => {
            const replayUnit = finalReplayState.units[idx];
            expect(replayUnit.id).toBe(simUnit.id);
            expect(replayUnit.pos.x).toBe(simUnit.pos.x);
            expect(replayUnit.pos.y).toBe(simUnit.pos.y);
            expect(replayUnit.hp).toBe(simUnit.hp);
            expect(replayUnit.state).toBe(simUnit.state);
          });

          // Compare enemies
          expect(finalReplayState.enemies.length).toBe(
            finalSimState.enemies.length,
          );

          // Sort enemies by ID to ensure stable comparison
          const sortedSimEnemies = [...finalSimState.enemies].sort((a, b) =>
            a.id.localeCompare(b.id),
          );
          const sortedReplayEnemies = [...finalReplayState.enemies].sort(
            (a, b) => a.id.localeCompare(b.id),
          );

          sortedSimEnemies.forEach((simEnemy, idx) => {
            const replayEnemy = sortedReplayEnemies[idx];
            expect(replayEnemy.id).toBe(simEnemy.id);
            expect(replayEnemy.pos.x).toBe(simEnemy.pos.x);
            expect(replayEnemy.pos.y).toBe(simEnemy.pos.y);
            expect(replayEnemy.hp).toBe(simEnemy.hp);
          });

          // Compare loot
          expect(finalReplayState.loot.length).toBe(finalSimState.loot.length);

          // Compare stats
          expect(finalReplayState.stats).toEqual(finalSimState.stats);

          // Compare PRNG state
          expect(finalReplayState.rngState).toBe(finalSimState.rngState);

          // Compare Director state
          expect(finalReplayState.directorState).toEqual(
            finalSimState.directorState,
          );
        },
      );
    });
  });

  it(
    "should DESYNC if baseEnemyCount mismatches in Replay mode",
    { timeout: 60000 },
    () => {
      const seed = 12345;
      const mapConfig = {
        seed,
        width: 16,
        height: 16,
        type: MapGeneratorType.DenseShip,
        spawnPointCount: 5,
      };

      const map = MapFactory.generate(mapConfig);
      const squadConfig = {
        soldiers: [{ archetypeId: "assault" }],
        inventory: {},
      };

      // 1. Run Simulation with 10 base enemies
      const engineSim = new CoreEngine(
        map,
        seed,
        squadConfig,
        true,
        false,
        MissionType.Default,
        false,
        0,
        1.0,
        false,
        EngineMode.Simulation,
        [],
        true,
        0,
        10,
        1,
        1,
        "Elite",
        undefined,
        10,
      );

      for (let i = 0; i < 15000; i += 16) engineSim.update(16);
      const finalSimState = engineSim.getState();

      // 2. Run Replay with 3 base enemies (the hardcoded value in GameClient)
      const engineReplay = new CoreEngine(
        map,
        seed,
        squadConfig,
        true,
        false,
        MissionType.Default,
        false,
        0,
        1.0,
        false,
        EngineMode.Replay,
        finalSimState.commandLog,
        true,
        0,
        3,
        1,
        0,
        "Combat",
        undefined,
        0,
      );

      for (let i = 0; i < 15000; i += 16) engineReplay.update(16);
      const finalReplayState = engineReplay.getState();

      // 3. Verify they are DIFFERENT
      expect(finalReplayState.enemies.length).not.toBe(
        finalSimState.enemies.length,
      );
    },
  );
});
