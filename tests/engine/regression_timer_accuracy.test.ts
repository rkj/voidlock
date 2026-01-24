import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  MissionType,
} from "@src/shared/types";

describe("Timer Accuracy Regression", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [{ x: 0, y: 0, type: CellType.Floor }],
  };
  const defaultSquad: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  it("should correctly track elapsed real-time when 1.0x speed is simulated", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      defaultSquad,
      false,
      false,
      MissionType.Default,
    );

    // Simulate 10 seconds of real time at 1.0x speed
    // In the worker, TICK_RATE is 16ms
    const TICK_RATE = 16;
    const timeScale = 1.0;
    const totalRealTimeMs = 10000;

    // After my fix, scaledDt = TICK_RATE * timeScale
    const scaledDt = TICK_RATE * timeScale;

    const iterations = totalRealTimeMs / TICK_RATE;
    for (let i = 0; i < iterations; i++) {
      engine.update(scaledDt);
    }

    const state = engine.getState();
    // state.t should be exactly 10000ms (10s)
    expect(state.t).toBe(10000);
  });

  it("should correctly track elapsed real-time when 2.0x speed is simulated", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      defaultSquad,
      false,
      false,
      MissionType.Default,
    );

    const TICK_RATE = 16;
    const timeScale = 2.0;
    const totalRealTimeMs = 10000;

    // After my fix, scaledDt = 16 * 2.0 = 32
    const scaledDt = TICK_RATE * timeScale;

    const iterations = totalRealTimeMs / TICK_RATE;
    for (let i = 0; i < iterations; i++) {
      engine.update(scaledDt);
    }

    const state = engine.getState();
    // At 2.0x speed, 10s of real time should result in 20s of game time
    expect(state.t).toBe(20000);
  });
});
