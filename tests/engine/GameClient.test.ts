/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameClient } from "@src/engine/GameClient";
import {
  MapGeneratorType,
  UnitStyle,
  CommandType,
  MissionType,
  EngineMode,
} from "@src/shared/types";

describe("GameClient", () => {
  let client: GameClient;
  let postMessageMock: any;
  let mockWorker: any;

  beforeEach(() => {
    postMessageMock = vi.fn();
    // Mock worker constructor
    const MockWorker = vi.fn().mockImplementation(() => {
      mockWorker = {
        postMessage: postMessageMock,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        terminate: vi.fn(),
        onmessage: null,
      };
      return mockWorker;
    });
    (window as any).Worker = MockWorker;

    client = new GameClient(() => ({
      generate: vi.fn().mockReturnValue({ width: 10, height: 10, cells: [] }),
      load: vi.fn().mockReturnValue({ width: 10, height: 10, cells: [] }),
    }) as any);
  });

  it("should initialize and record seed/map", () => {
    client.init({
      seed: 12345,
      mapGeneratorType: MapGeneratorType.DenseShip,
      width: 10,
      height: 10,
      squadConfig: { soldiers: [{ archetypeId: "assault" } as any], inventory: {} },
      missionType: MissionType.Default,
    });

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "INIT",
      payload: expect.objectContaining({
        seed: 12345,
        // mapGeneratorType, width, height are filtered out by GameClient before sending to worker
        // as the worker receives the final 'map' object.
      }),
    });
  });

  it("should record commands via STATE_UPDATE sync", () => {
    client.init({
      seed: 123,
      mapGeneratorType: MapGeneratorType.DenseShip,
      squadConfig: {
        soldiers: [],
        inventory: {},
      }
    });

    // Simulate worker sending back a state update with a command log
    const mockState = {
      t: 100,
      status: "Playing",
      commandLog: [
        {
          tick: 50,
          command: { type: CommandType.MOVE_TO, unitIds: ["u1"], target: { x: 1, y: 1 } },
        },
      ],
      settings: { mode: EngineMode.Simulation }
    };

    mockWorker.onmessage({ data: { type: "STATE_UPDATE", payload: mockState } });

    const replayData = client.getReplayData();
    expect(replayData?.commands.length).toBe(1);
    expect(replayData?.commands[0].t).toBe(50);
  });

  it("should replay commands", () => {
    const commands = [
      {
        t: 100,
        cmd: {
          type: CommandType.MOVE_TO,
          unitIds: ["u1"],
          target: { x: 1, y: 1 },
        },
      },
    ];

    client.loadReplay({
      seed: 555,
      missionType: MissionType.Default,
      map: { width: 10, height: 10, cells: [] } as any,
      squadConfig: { soldiers: [{ archetypeId: "assault" } as any], inventory: {} },
      commands: commands,
    });

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "INIT",
      payload: expect.objectContaining({
        seed: 555,
        mode: EngineMode.Replay,
        commandLog: [{ tick: 100, command: commands[0].cmd }],
      }),
    });
  });

  it("should send STOP message", () => {
    client.stop();
    expect(postMessageMock).toHaveBeenCalledWith({ type: "STOP" });
  });

  it("should send toggleDebugOverlay command", () => {
    client.toggleDebugOverlay(true);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "COMMAND",
      payload: expect.objectContaining({ type: CommandType.TOGGLE_DEBUG_OVERLAY, enabled: true }),
    });
  });

  it("should send toggleLosOverlay command", () => {
    client.toggleLosOverlay(true);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "COMMAND",
      payload: expect.objectContaining({ type: CommandType.TOGGLE_LOS_OVERLAY, enabled: true }),
    });
  });

  it("should send queryState message", () => {
    client.queryState();
    expect(postMessageMock).toHaveBeenCalledWith({ type: "QUERY_STATE" });
  });

  it("should save mission config to localStorage in Simulation mode", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    client.init({
      seed: 777,
      mapGeneratorType: MapGeneratorType.DenseShip,
      width: 12,
      height: 12,
      squadConfig: { soldiers: [], inventory: {} },
      mode: EngineMode.Simulation,
    });

    expect(spy).toHaveBeenCalledWith(
      "voidlock_mission_config",
      expect.stringContaining('"seed":777'),
    );
    spy.mockRestore();
  });

  it("should propagate campaignNodeId and nodeType to worker in INIT message", () => {
    client.init({
      seed: 888,
      mapGeneratorType: MapGeneratorType.DenseShip,
      squadConfig: { soldiers: [], inventory: {} },
      campaignNodeId: "node-123",
      nodeType: "Elite" as any,
    });

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "INIT",
      payload: expect.objectContaining({
        campaignNodeId: "node-123",
        nodeType: "Elite",
      }),
    });
  });

  it("should pass snapshots and disable tactical pause in Replay mode seek", () => {
    const snapshots = [{ t: 0 } as any, { t: 100 } as any];
    client.loadReplay({
      seed: 999,
      missionType: MissionType.Default,
      map: { width: 10, height: 10, cells: [] } as any,
      squadConfig: { soldiers: [], inventory: {} },
      commands: [],
      snapshots,
    });

    postMessageMock.mockClear();
    client.seek(50);

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "INIT",
      payload: expect.objectContaining({
        seed: 999,
        mode: EngineMode.Replay,
        allowTacticalPause: false,
        initialSnapshots: snapshots,
        targetTick: 50,
      }),
    });
  });

  it("should restore unitStyle and themeId in loadReplay", () => {
    client.loadReplay({
      seed: 999,
      missionType: MissionType.Default,
      map: { width: 10, height: 10, cells: [] } as any,
      squadConfig: { soldiers: [], inventory: {} },
      commands: [],
      unitStyle: UnitStyle.Sprites,
      themeId: "classic",
    });

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "INIT",
      payload: expect.objectContaining({
        unitStyle: UnitStyle.Sprites,
        themeId: "classic",
      }),
    });
  });
});
