import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  EngineMode,
  CommandType,
  MissionType,
  UnitState,
} from "@src/shared/types";

describe("Regression lv7j: Unit Movement on Refresh", () => {
  it("should preserve movement state even if no command was issued exactly at refresh time", () => {
    const seed = 123;
    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: [],
      squadSpawn: { x: 1, y: 1 },
    };
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.cells.push({ x, y, type: CellType.Floor });
      }
    }

    const squadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };

    const engine = new CoreEngine(
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
    );

    const unitId = engine.getState().units[0].id;

    // 1. Issue MOVE command at t=0
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unitId],
      target: { x: 8, y: 8 },
    });

    // 2. Run for 1000ms
    for (let i = 0; i < 62; i++) {
      engine.update(16);
    }

    const stateBeforeRefresh = engine.getState();
    const posBeforeRefresh = { ...stateBeforeRefresh.units[0].pos };
    const tickBeforeRefresh = stateBeforeRefresh.t;
    const commandLog = [...stateBeforeRefresh.commandLog!];

    // 3. Simulate Refresh: Create new engine with the SAME command log
    // BUT we don't have a command at tickBeforeRefresh.
    const recoveredEngine = new CoreEngine(
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
      commandLog,
      true, // allowTacticalPause
      tickBeforeRefresh,
    );

    const recoveredState = recoveredEngine.getState();

    // EXPECTATION FAILURE:
    // Without the fix, recoveredState.t will be 0 (or whatever the last command tick was)
    // and the unit will be at the start position.

    // We want it to be at tickBeforeRefresh and posBeforeRefresh.
    expect(recoveredState.t).toBeGreaterThanOrEqual(tickBeforeRefresh);
    expect(recoveredState.units[0].pos.x).toBeCloseTo(posBeforeRefresh.x);
    expect(recoveredState.units[0].pos.y).toBeCloseTo(posBeforeRefresh.y);
    expect(recoveredState.units[0].state).toBe(UnitState.Moving);
  });
});
