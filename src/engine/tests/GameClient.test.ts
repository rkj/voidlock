import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GameClient } from "@src/engine/GameClient";
import {
  CommandType,
  MapDefinition,
  MapGeneratorType,
  MoveCommand,
  SquadConfig,
} from "@src/shared/types";
import { MapGenerator } from "@src/engine/MapGenerator";

// Mock Worker
const postMessageMock = vi.fn();
const terminateMock = vi.fn();

class MockWorker {
  onmessage: any = null;
  postMessage = postMessageMock;
  terminate = terminateMock;
}

vi.stubGlobal("Worker", MockWorker);

// Mock MapGeneratorFactory
const mockMapGeneratorFactory = (
  seed: number,
  type: MapGeneratorType,
  mapData?: MapDefinition,
) => {
  const generator = new MapGenerator(seed); // Doesn't matter too much for tests, just needs to be an instance
  // Mock the generate and load methods
  generator.generate = vi
    .fn()
    .mockReturnValue(mapData || { width: 10, height: 10, cells: [] });
  generator.load = vi
    .fn()
    .mockReturnValue(mapData || { width: 10, height: 10, cells: [] });
  return generator;
};

describe("GameClient", () => {
  let client: GameClient;
  const mockMap: MapDefinition = { width: 10, height: 10, cells: [] };
  const defaultSquad: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  }; // Define defaultSquad once

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new GameClient(mockMapGeneratorFactory); // Pass the mock factory
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize and record seed/map", () => {
    const seed = 12345;
    client.init(
      seed,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
    ); // Pass default squadConfig and other params

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "INIT",
      payload: {
        seed,
        map: mockMap,
        missionType: "Default",
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        agentControlEnabled: true,
        squadConfig: defaultSquad,
        losOverlayEnabled: false,
        startingThreatLevel: 0,
        initialTimeScale: 1.0,
        startPaused: false,
      },
    });

    const replay = client.getReplayData();
    expect(replay?.seed).toBe(seed);
    expect(replay?.map).toBe(mockMap);
    expect(replay?.squadConfig).toBe(defaultSquad);
    expect(replay?.commands).toEqual([]);
  });

  it("should record commands", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
    ); // Pass default squadConfig and other params

    // Advance time
    vi.advanceTimersByTime(100);

    const cmd: MoveCommand = {
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 1, y: 1 },
    };
    client.sendCommand(cmd);

    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "COMMAND",
      payload: cmd,
    });

    const replay = client.getReplayData();
    expect(replay?.commands.length).toBe(1);
    expect(replay?.commands[0].cmd).toEqual(cmd);
    expect(replay?.commands[0].t).toBe(100);
  });

  it("should replay commands", () => {
    // Setup replay data
    const replayData = {
      seed: 555,
      map: mockMap,
      squadConfig: defaultSquad,
      commands: [
        {
          t: 100,
          cmd: {
            type: CommandType.MOVE_TO,
            unitIds: ["u1"],
            target: { x: 1, y: 1 },
          } as MoveCommand,
        },
        {
          t: 500,
          cmd: {
            type: CommandType.MOVE_TO,
            unitIds: ["u2"],
            target: { x: 2, y: 2 },
          } as MoveCommand,
        },
      ],
    };

    client.loadReplay(replayData);

    // Should verify init was called immediately
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "INIT",
      payload: {
        seed: 555,
        map: mockMap,
        missionType: "Default",
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        agentControlEnabled: true,
        squadConfig: defaultSquad,
        losOverlayEnabled: false,
        startingThreatLevel: 0,
        initialTimeScale: 1.0,
        startPaused: false,
      },
    });

    // Clear mocks to check subsequent calls
    postMessageMock.mockClear();

    // Advance time to 100ms
    vi.advanceTimersByTime(100);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "COMMAND",
      payload: replayData.commands[0].cmd,
    });

    // Advance to 500ms (total)
    vi.advanceTimersByTime(400);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "COMMAND",
      payload: replayData.commands[1].cmd,
    });
  });

  it("should send STOP message and clear replay timeouts", () => {
    // Setup replay data with far future command
    const replayData = {
      seed: 555,
      map: mockMap,
      squadConfig: defaultSquad,
      commands: [
        {
          t: 5000,
          cmd: {
            type: CommandType.MOVE_TO,
            unitIds: ["u1"],
            target: { x: 1, y: 1 },
          } as MoveCommand,
        },
      ],
    };

    client.loadReplay(replayData);
    postMessageMock.mockClear();

    client.stop();

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "STOP",
    });

    // Advance time and ensure no COMMAND message is sent
    vi.advanceTimersByTime(5000);
    const commandCalls = postMessageMock.mock.calls.filter(
      (call) => call[0].type === "COMMAND",
    );
    expect(commandCalls.length).toBe(0);
  });

  it("should clear replay timeouts on init", () => {
    // Setup replay data with far future command
    const replayData = {
      seed: 555,
      map: mockMap,
      squadConfig: defaultSquad,
      commands: [
        {
          t: 5000,
          cmd: {
            type: CommandType.MOVE_TO,
            unitIds: ["u1"],
            target: { x: 1, y: 1 },
          } as MoveCommand,
        },
      ],
    };

    client.loadReplay(replayData);
    postMessageMock.mockClear();

    // Re-initialize should clear previous replay timeouts
    client.init(
      123,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
    );

    // Advance time and ensure no COMMAND message from the replay is sent
    vi.advanceTimersByTime(5000);
    const commandCalls = postMessageMock.mock.calls.filter(
      (call) => call[0].type === "COMMAND",
    );
    expect(commandCalls.length).toBe(0);
  });

  it("should send toggleDebugOverlay command", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
    );
    client.toggleDebugOverlay(true);

    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "COMMAND",
      payload: {
        type: CommandType.TOGGLE_DEBUG_OVERLAY,
        enabled: true,
      },
    });
  });

  it("should send toggleLosOverlay command", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
    );
    client.toggleLosOverlay(true);

    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "COMMAND",
      payload: {
        type: CommandType.TOGGLE_LOS_OVERLAY,
        enabled: true,
      },
    });
  });

  it("should send queryState message", () => {
    client.queryState();

    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "QUERY_STATE",
    });
  });
});
