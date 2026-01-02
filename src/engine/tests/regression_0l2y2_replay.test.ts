import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  CommandType,
  EngineMode,
  MissionType,
} from "../../shared/types";

describe("Mission Replay Regression", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: Array.from({ length: 25 }, (_, i) => ({
      x: i % 5,
      y: Math.floor(i / 5),
      type: CellType.Floor,
    })),
    squadSpawn: { x: 2, y: 2 },
  };

  const squadConfig = { soldiers: [{ archetypeId: "assault" }], inventory: {} };
  it("should reproduce the same state in Replay mode", () => {
    const seed = 12345;
    const engineSim = new CoreEngine(
      mockMap,
      seed,
      squadConfig,
      false, // agentControl
      false, // debug
      MissionType.Default,
    );

    // 1. Simulation Phase
    engineSim.update(100);
    const moveCmd = {
      type: CommandType.MOVE_TO as const,
      unitIds: [engineSim.getState().units[0].id],
      target: { x: 4, y: 4 },
    };
    engineSim.applyCommand(moveCmd);
    engineSim.update(1000); // 1 second move

    const finalSimState = engineSim.getState();
    const commandLog = finalSimState.commandLog || [];

    expect(commandLog.length).toBe(2);
    expect(commandLog[0].command.type).toBe(CommandType.EXPLORE);
    expect(commandLog[1].command).toEqual(moveCmd);

    // 2. Replay Phase
    const engineReplay = new CoreEngine(
      mockMap,
      seed,
      squadConfig,
      false,
      false,
      MissionType.Default,
      false,
      0,
      1.0,
      false,
      EngineMode.Replay,
      commandLog,
    );

    engineReplay.update(100); // Should trigger no command yet
    engineReplay.update(1000); // Should trigger command and move

    const finalReplayState = engineReplay.getState();

    // 3. Verification
    expect(finalReplayState.t).toBe(finalSimState.t);
    expect(finalReplayState.units[0].pos).toEqual(finalSimState.units[0].pos);
    expect(finalReplayState.units[0].state).toEqual(
      finalSimState.units[0].state,
    );
  });
});
