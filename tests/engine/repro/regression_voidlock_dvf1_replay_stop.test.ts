import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  EngineMode,
  MissionType,
} from "@src/shared/types";

describe("CoreEngine Replay Termination", () => {
  it("should stop updating when mission status is no longer Playing, even in Replay mode", () => {
    const map = {
      width: 5,
      height: 5,
      cells: [
        { x: 0, y: 0, type: 1, roomId: "room-1" },
        { x: 1, y: 0, type: 1, roomId: "room-1" },
        { x: 0, y: 1, type: 1, roomId: "room-1" },
        { x: 1, y: 1, type: 1, roomId: "room-1" },
      ],
      spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 } }],
      squadSpawns: [{ x: 1, y: 1 }],
      extraction: { x: 4, y: 4 },
    } as any;

    const squadConfig = {
      soldiers: [
        { id: "s1", name: "S1", archetypeId: "scout", tacticalNumber: 1, hp: 10, maxHp: 10, pos: { x: 1, y: 1 } }
      ],
      inventory: {}
    } as any;

    // 1. Create a simulation and make it fail
    const engine = new CoreEngine(
      map,
      12345,
      squadConfig,
      false, // agentControl
      false, // debug
      MissionType.Default,
      false, // losOverlay
      0, // threat
      1.0, // timescale
      false, // paused
      EngineMode.Simulation
    );

    // Force failure by killing the only unit
    const state = engine.getState();
    state.units[0].hp = 0;
    
    // Run one update to trigger loss check
    engine.update(16);
    expect(engine.getState().status).toBe("Lost");

    // 2. Create a replay engine with the same log
    const replayEngine = new CoreEngine(
      map,
      12345,
      squadConfig,
      false,
      false,
      MissionType.Default,
      false,
      0,
      1.0,
      false,
      EngineMode.Replay,
      engine.getState().commandLog
    );

    // Run until it hits Lost
    for (let i = 0; i < 1000; i++) {
        replayEngine.update(16);
        if (replayEngine.getState().status === "Lost") break;
    }

    expect(replayEngine.getState().status).toBe("Lost");
    const replayEndTick = replayEngine.getState().t;
    
    // Now try to update again
    replayEngine.update(16);
    
    // Time should NOT have increased
    expect(replayEngine.getState().t).toBe(replayEndTick);
  });
});
