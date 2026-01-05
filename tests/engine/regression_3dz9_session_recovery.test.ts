import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  EngineMode,
  CommandType,
  MissionType,
} from "@src/shared/types";

describe("Regression 3dz9: Session Recovery / Catch-up", () => {
  it("should catch up to the state defined by initialCommandLog", () => {
    const seed = 123;
    // Simple 4x4 open map
    const map: MapDefinition = {
        width: 4,
        height: 4,
        cells: [],
        squadSpawn: { x: 1, y: 1 }
    };
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            map.cells.push({ x, y, type: CellType.Floor });
        }
    }

    const squadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };

    // First, run a simulation to get a command log
    const engine = new CoreEngine(
      map,
      seed,
      squadConfig,
      true, // agent
      false, // debug
      MissionType.Default,
      false, // los
      0, // threat
      1.0, // timeScale
      false, // startPaused
      EngineMode.Simulation
    );

    // Give a move command
    const state = engine.getState();
    const unitId = state.units[0].id;
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unitId],
      target: { x: 3, y: 3 },
    });

    // Run for a bit (e.g. 1 second of simulation)
    // 1000ms / 16ms = 62.5 ticks
    for (let i = 0; i < 63; i++) {
      engine.update(16, 16);
    }

    // Add a marker command at the current time to ensure catch-up reaches this state
    engine.applyCommand({
      type: CommandType.STOP,
      unitIds: [],
    });

    const stateAtEnd = engine.getState();
    const finalPos = { ...stateAtEnd.units[0].pos };
    const commandLog = [...(stateAtEnd.commandLog || [])];

    expect(commandLog.length).toBeGreaterThan(0);

    // Now, create a NEW engine with this command log
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
      commandLog
    );

    const recoveredState = recoveredEngine.getState();
    
    // It should have caught up to the last tick in the command log
    const lastTick = commandLog[commandLog.length - 1].tick;
    expect(recoveredState.t).toBeGreaterThanOrEqual(lastTick);
    
    // The unit should be at the same (or very close) position
    expect(recoveredState.units[0].pos.x).toBeCloseTo(finalPos.x);
    expect(recoveredState.units[0].pos.y).toBeCloseTo(finalPos.y);
  });
});
