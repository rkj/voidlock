import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GameClient } from "@src/engine/GameClient";
import {
  CommandType,
  MapDefinition,
  MapGeneratorType,
  SquadConfig,
  MapGenerationConfig,
  EngineMode,
  MoveCommand,
  MissionType,
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
const mockMapGeneratorFactory = (config: MapGenerationConfig) => {
  const generator = new MapGenerator(config); // Doesn't matter too much for tests, just needs to be an instance
  // Mock the generate and load methods
  generator.generate = vi
    .fn()
    .mockReturnValue({ width: 10, height: 10, cells: [] });
  generator.load = vi
    .fn()
    .mockImplementation((data) => data || { width: 10, height: 10, cells: [] });
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
        allowTacticalPause: true,
        mode: EngineMode.Simulation,
        commandLog: [],
        targetTick: 0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        missionDepth: 0,
        skipDeployment: true,
        campaignNodeId: undefined,
        nodeType: undefined,
      },
    });

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 1.0,
    });

    const replay = client.getReplayData();
    expect(replay?.seed).toBe(seed);
    expect(replay?.map).toEqual(mockMap);
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
    // Manually trigger a state update to advance the engine tick in the client
    (client as any).worker.onmessage({
      data: {
        type: "STATE_UPDATE",
        payload: {
          t: 100,
          settings: { mode: EngineMode.Simulation },
        },
      },
    });

    const cmd: MoveCommand = {
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 1, y: 1 },
    };
    client.applyCommand(cmd);

    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "COMMAND",
      payload: cmd,
    });

    // Simulate authoritative update from engine
    (client as any).worker.onmessage({
      data: {
        type: "STATE_UPDATE",
        payload: {
          t: 100,
          settings: { mode: EngineMode.Simulation },
          commandLog: [{ tick: 100, command: cmd }],
        },
      },
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
      missionType: MissionType.Default,
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
        allowTacticalPause: true,
        mode: EngineMode.Replay,
        commandLog: [
          { tick: 100, command: replayData.commands[0].cmd },
          { tick: 500, command: replayData.commands[1].cmd },
        ],
        targetTick: 0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        missionDepth: 0,
        skipDeployment: true,
        campaignNodeId: undefined,
        nodeType: undefined,
      },
    });

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 1.0,
    });

    // Clear mocks to check subsequent calls
    postMessageMock.mockClear();

    // Advance time and ensure NO COMMAND messages are sent via timeouts (since engine handles it now)
    vi.advanceTimersByTime(500);
    const commandCalls = postMessageMock.mock.calls.filter(
      (call) => call[0].type === "COMMAND",
    );
    expect(commandCalls.length).toBe(0);
  });

  it("should send STOP message", () => {
    client.stop();

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "STOP",
    });
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

  it("should save mission config and campaignNodeId to localStorage in Simulation mode", () => {
    const seed = 12345;
    const campaignNodeId = "test-node-123";

    // Mock localStorage
    const storage: Record<string, string> = {};
    const mockLocalStorage = {
      setItem: vi.fn((key, value) => {
        storage[key] = value;
      }),
      getItem: vi.fn((key) => storage[key] || null),
      removeItem: vi.fn((key) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        for (const key in storage) delete storage[key];
      }),
    };
    vi.stubGlobal("localStorage", mockLocalStorage);

    client.init(
      seed,
      MapGeneratorType.Procedural,
      mockMap,
      true, // fog
      false, // debug
      true, // agent
      defaultSquad,
      "Default" as any,
      16,
      16,
      3,
      false, // los
      0, // threat
      1.0, // scale
      false, // paused
      true, // allowPause
      EngineMode.Simulation,
      [],
      campaignNodeId,
    );

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      "voidlock_mission_config",
      expect.any(String),
    );

    const savedConfig = JSON.parse(storage["voidlock_mission_config"]);
    expect(savedConfig.seed).toBe(seed);
    expect(savedConfig.campaignNodeId).toBe(campaignNodeId);
  });

  it("should propagate campaignNodeId and nodeType to worker in INIT message", () => {
    const seed = 12345;
    const campaignNodeId = "test-node-123";
    const nodeType = "Elite";

    client.init(
      seed,
      MapGeneratorType.Procedural,
      mockMap,
      true, // fog
      false, // debug
      true, // agent
      defaultSquad,
      MissionType.Default,
      16,
      16,
      3,
      false, // los
      0, // threat
      1.0, // scale
      false, // paused
      true, // allowPause
      EngineMode.Simulation,
      [],
      campaignNodeId,
      0,
      3,
      1,
      0,
      nodeType,
    );

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
        allowTacticalPause: true,
        mode: EngineMode.Simulation,
        commandLog: [],
        targetTick: 0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        missionDepth: 0,
        nodeType,
        campaignNodeId,
        skipDeployment: true,
      },
    });
  });
});
