import { describe, it, expect, beforeEach, vi } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  SquadConfig,
  MissionType,
  EngineMode,
  CommandType,
} from "@src/shared/types";

describe("Regression A02K: Replay Determinism", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [
      { x: 0, y: 0, type: 1, roomId: "room1" },
      { x: 1, y: 0, type: 1, roomId: "room1" },
    ],
    squadSpawn: { x: 0, y: 0 },
  };

  const squadConfig: SquadConfig = {
    soldiers: [
      {
        id: "s1",
        archetypeId: "assault",
        hp: 100,
        maxHp: 100,
        rightHand: "pistol",
      },
    ],
    inventory: {},
  };

  it("should produce the same final state regardless of update step size", () => {
    const seed = 12345;
    const targetPos = { x: 5, y: 0 };

    // Run 1: Fixed 16ms steps
    const engine1 = new CoreEngine(
      mockMap,
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
      0, // baseEnemyCount 0
    );

    // Issue a move command
    engine1.applyCommand({
      type: CommandType.MOVE,
      unitIds: ["s1"],
      target: targetPos,
    });

    for (let i = 0; i < 300; i++) {
      engine1.update(16);
    }
    const state1 = engine1.getState();

    // Run 2: 24ms steps
    const engine2 = new CoreEngine(
      mockMap,
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
      0, // baseEnemyCount 0
    );

    // Issue a move command
    engine2.applyCommand({
      type: CommandType.MOVE,
      unitIds: ["s1"],
      target: targetPos,
    });

    for (let i = 0; i < 200; i++) {
      engine2.update(24);
    }
    const state2 = engine2.getState();

    expect(state1.t).toBe(state2.t); // 4800
    expect(state1.rngState).toBe(state2.rngState);
    expect(state1.units[0].pos.x).toBeCloseTo(state2.units[0].pos.x);
    expect(state1.units[0].pos.y).toBeCloseTo(state2.units[0].pos.y);

    // Ensure they actually moved
    expect(state1.units[0].pos.x).toBeGreaterThan(0);
  });

  it("should match original simulation when replaying with same commands", () => {
    const seed = 12345;
    const engine1 = new CoreEngine(
      mockMap,
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

    // Initial state has EXPLORE command automatically added
    const initialLog = [...engine1.getState().commandLog!];
    expect(initialLog.length).toBe(1);
    expect(initialLog[0].command.type).toBe(CommandType.EXPLORE);

    // Run for some time
    for (let i = 0; i < 10; i++) {
      engine1.update(16);
    }
    const finalState1 = engine1.getState();
    const finalLog = finalState1.commandLog!;

    // Replay run
    const engine2 = new CoreEngine(
      mockMap,
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
      finalLog,
    );

    for (let i = 0; i < 10; i++) {
      engine2.update(16);
    }
    const finalState2 = engine2.getState();

    expect(finalState1.t).toBe(finalState2.t);
    expect(finalState1.rngState).toBe(finalState2.rngState);
    expect(finalState1.units[0].pos).toEqual(finalState2.units[0].pos);
  });
});
