/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapDefinition, EngineMode, MissionType } from "@src/shared/types";

describe("Replay Seek Integration", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [
      { x: 0, y: 0, type: "Floor" as any, roomId: "r1" },
      { x: 1, y: 1, type: "Floor" as any, roomId: "r1" },
      { x: 5, y: 5, type: "Floor" as any, roomId: "r1" },
      { x: 9, y: 9, type: "Floor" as any, roomId: "r1" },
    ],
    walls: [],
    spawnPoints: [{ cell: { x: 5, y: 5 }, id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
    extraction: { x: 9, y: 9 },
    squadSpawn: { x: 0, y: 0 }
  };

  it("should fast-forward to targetTick correctly during initialization", () => {
    const engine = new CoreEngine({
      map: mockMap,
      seed: 12345,
      squadConfig: { soldiers: [{ id: "s1", archetypeId: "scout" }], inventory: {} },
      agentControlEnabled: true,
      debugOverlayEnabled: false,
      missionType: MissionType.Default,
      losOverlayEnabled: false,
      startingThreatLevel: 0,
      initialTimeScale: 1.0,
      startPaused: false,
      mode: EngineMode.Replay,
      initialCommandLog: [],
      allowTacticalPause: true,
      targetTick: 112,
    });

    // Initial state.t should be 112
    expect(engine.getState().t).toBe(112);
  });

  it("should process commands correctly when seeking", () => {
    const engine = new CoreEngine({
      map: mockMap,
      seed: 12345,
      squadConfig: { soldiers: [{ id: "s1", archetypeId: "scout" }], inventory: {} },
      agentControlEnabled: true,
      debugOverlayEnabled: false,
      missionType: MissionType.Default,
      losOverlayEnabled: false,
      startingThreatLevel: 0,
      initialTimeScale: 1.0,
      startPaused: false,
      mode: EngineMode.Replay,
      initialCommandLog: [
        {
          tick: 0,
          command: {
            type: "MOVE",
            unitIds: ["s1"],
            targetCell: { x: 1, y: 1 },
          } as any,
        },
      ],
      allowTacticalPause: true,
      targetTick: 160,
    });

    const state = engine.getState();
    expect(state.t).toBe(160);
    const unit = state.units.find((u) => u.id === "s1")!;
    // In 160ms, the unit should have moved from (0,0) towards (1,1).
    expect(unit.pos.x).toBeGreaterThan(0);
    expect(unit.pos.y).toBeGreaterThan(0);
  });
});
