import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import { MapDefinition, MissionType } from "../../shared/types";

describe("Regression fgao: Pause Threat", () => {
  const minimalMap: MapDefinition = {
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, type: "Floor" },
      { x: 1, y: 0, type: "Floor" },
      { x: 0, y: 1, type: "Floor" },
      { x: 1, y: 1, type: "Floor" },
    ],
    squadSpawn: { x: 0, y: 0 },
    spawnPoints: [{ id: "sp1", pos: { x: 1, y: 1 }, radius: 1 }],
  };

  it("should not increase threat level when game is paused (scaledDt = 0)", () => {
    const engine = new CoreEngine(
      minimalMap,
      123,
      [], // empty squad
      false,
      false,
      MissionType.Default,
      false,
      0 // starting threat
    );

    const initialThreat = engine.getState().threatLevel;
    expect(initialThreat).toBe(0);

    // Simulate pause: scaledDt = 0, realDt = 16
    engine.update(0, 16);

    const pausedThreat = engine.getState().threatLevel;
    // Current behavior: it INCREASES because it uses realDt
    // Target behavior: it should NOT increase
    expect(pausedThreat).toBe(initialThreat);
  });

  it("should increase threat level based on game time (scaledDt)", () => {
    const engine = new CoreEngine(
      minimalMap,
      123,
      [],
      false,
      false,
      MissionType.Default,
      false,
      0
    );

    // 10s game time, 1s real time (e.g. 10x speed)
    engine.update(10000, 1000);

    const threatAfter10s = engine.getState().threatLevel;
    // It should have increased by 10% (one turn)
    expect(threatAfter10s).toBe(10);
  });
});
