import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapDefinition, SquadConfig, EngineMode } from "@src/shared/types";
import * as fs from "fs";
import * as path from "path";

describe("Invincible Combat Repro (voidlock-zkhz)", () => {
  it("should deal damage when units are attacking enemies in range", () => {
    const dataPath = path.join(
      __dirname,
      "../../../tests/data/weird_fight.json",
    );
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const currentState = data.currentState;

    const map: MapDefinition = currentState.map;
    const squadConfig: SquadConfig = {
      soldiers: [],
      inventory: currentState.squadInventory,
    };

    // Initialize engine with map from state
    const engine = new CoreEngine(
      map,
      currentState.seed,
      squadConfig,
      true, // agentControlEnabled
      true, // debugOverlayEnabled
      currentState.missionType,
      false, // losOverlayEnabled
      currentState.stats.threatLevel,
      0.05, // initialTimeScale
      false, // startPaused
      EngineMode.Simulation,
    );

    // Manually override engine state to match currentState from JSON
    const state = engine["state"];
    state.t = currentState.t;
    state.units = JSON.parse(JSON.stringify(currentState.units));
    state.enemies = JSON.parse(JSON.stringify(currentState.enemies));
    state.visibleCells = currentState.visibleCells;
    state.discoveredCells = currentState.discoveredCells;
    state.objectives = JSON.parse(JSON.stringify(currentState.objectives));
    state.stats = JSON.parse(JSON.stringify(currentState.stats));

    const initialEnemiesHp = state.enemies.map((e: any) => ({
      id: e.id,
      hp: e.hp,
    }));
    const initialAliensKilled = state.stats.aliensKilled;

    // Run one tick of combat (16ms)
    engine.update(16);

    const newState = engine.getState();

    // Check if any enemy took damage
    const tookDamage =
      newState.enemies.some((e: any) => {
        const initial = initialEnemiesHp.find((ie: any) => ie.id === e.id);
        return initial && e.hp < initial.hp;
      }) || newState.stats.aliensKilled > initialAliensKilled;

    // Based on the bug report, we expect this to FAIL (tookDamage will be false)
    expect(tookDamage, "Enemies should have taken damage or died").toBe(true);
  });
});
