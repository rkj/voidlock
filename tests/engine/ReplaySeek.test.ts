import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { EngineMode, MapDefinition, CellType, MissionType } from "@src/shared/types";

describe("CoreEngine Replay Seek", () => {
  const mockMap: MapDefinition = {
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
    ],
    walls: [],
    doors: [],
    spawnPoints: [],
    squadSpawn: { x: 0, y: 0 },
    extraction: { x: 1, y: 1 },
    objectives: [],
  };

  it("should catch up to targetTick in Replay mode", () => {
    const engine = new CoreEngine(
      mockMap,
      12345,
      { soldiers: [{ id: "s1", archetypeId: "scout" }], inventory: {} },
      true, // agentControl
      false, // debug
      MissionType.Default,
      false, // los
      0, // threat
      1.0, // timeScale
      false, // paused
      EngineMode.Replay,
      [], // commandLog
      true, // allowPause
      100, // targetTick
    );

    // Initial state.t should be 100
    expect(engine.getState().t).toBe(100);
  });

  it("should apply command log correctly during catch up", () => {
    // We'll create a simple command log that makes a unit move.
    // However, units move slowly, so we need a significant targetTick.
    const engine = new CoreEngine(
      mockMap,
      12345,
      { soldiers: [{ id: "s1", archetypeId: "scout" }], inventory: {} },
      true, // agentControl
      false, // debug
      MissionType.Default,
      false, // los
      0, // threat
      1.0, // timeScale
      false, // paused
      EngineMode.Replay,
      [
        {
          tick: 0,
          command: {
            type: "MOVE",
            unitIds: ["s1"],
            targetCell: { x: 1, y: 1 }
          } as any
        }
      ],
      true, // allowPause
      160, // targetTick (10 updates of 16ms)
    );

    const state = engine.getState();
    expect(state.t).toBe(160);
    const unit = state.units.find(u => u.id === "s1")!;
    // In 160ms, the unit should have moved from (0,0) towards (1,1).
    // Scout speed is usually around 50-60 units per second? 
    // Wait, let's check Constants.
    expect(unit.pos.x).toBeGreaterThan(0);
    expect(unit.pos.y).toBeGreaterThan(0);
  });
});
