// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameClient } from "@src/engine/GameClient";
import {
  MapGeneratorType,
  MissionType,
  EngineMode,
  CommandType,
} from "@src/shared/types";

describe("GameClient", () => {
  let client: GameClient;
  let postMessageMock: any;
  let workerMock: any;

  beforeEach(() => {
    postMessageMock = vi.fn();
    workerMock = {
      postMessage: postMessageMock,
      terminate: vi.fn(),
      onmessage: null,
    };

    // Mock Worker constructor
    vi.stubGlobal(
      "Worker",
      vi.fn().mockImplementation(() => workerMock),
    );

    const mockMapFactory = vi.fn().mockReturnValue({
        generate: vi.fn().mockReturnValue({ width: 10, height: 10, cells: [] }),
        load: vi.fn().mockReturnValue({ width: 10, height: 10, cells: [] })
    });
    client = new GameClient(mockMapFactory);
  });

  it("should initialize and record seed/map", () => {
    client.init(
      12345,
      MapGeneratorType.DenseShip,
      undefined,
      true,
      false,
      true,
      { soldiers: [{ archetypeId: "assault" } as any], inventory: {} },
      MissionType.Default,
      10,
      10,
    ); 

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "INIT",
      payload: expect.objectContaining({
        seed: 12345,
        map: expect.objectContaining({ width: 10, height: 10 }),
        squadConfig: expect.objectContaining({
          soldiers: [expect.objectContaining({ archetypeId: "assault" })],
        }),
        debugSnapshotInterval: 0,
      }),
    });
  });

  it("should record commands via STATE_UPDATE sync", () => {
    client.init(123, MapGeneratorType.DenseShip, undefined, true, false, true, { soldiers: [], inventory: {} });
    
    // Simulate worker sending back a state update with a command log
    const mockState = {
        commandLog: [
            { tick: 100, command: { type: CommandType.MOVE_TO, unitIds: ["u1"], target: { x: 1, y: 1 } } },
            { tick: 500, command: { type: CommandType.MOVE_TO, unitIds: ["u2"], target: { x: 2, y: 2 } } }
        ],
        settings: { mode: EngineMode.Simulation },
        map: { width: 10, height: 10 }
    };

    if (workerMock.onmessage) {
        workerMock.onmessage({ data: { type: "STATE_UPDATE", payload: mockState } });
    }

    const replayData = client.getReplayData();
    expect(replayData).not.toBeNull();
    expect(replayData!.commands).toHaveLength(2);
    expect(replayData!.commands[0].cmd.type).toBe(CommandType.MOVE_TO);
  });

  it("should replay commands", () => {
    const commands = [
      {
        tick: 100,
        command: {
          type: CommandType.MOVE_TO,
          unitIds: ["u1"],
          target: { x: 1, y: 1 },
        },
      },
      {
        tick: 500,
        command: {
          type: CommandType.MOVE_TO,
          unitIds: ["u2"],
          target: { x: 2, y: 2 },
        },
      },
    ];

    client.init(
      555,
      MapGeneratorType.DenseShip,
      undefined,
      true,
      false,
      true,
      { soldiers: [{ archetypeId: "assault" } as any], inventory: {} },
      MissionType.Default,
      10,
      10,
      3,
      false,
      0,
      1.0,
      false,
      true,
      EngineMode.Replay,
      commands,
    );

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "INIT",
      payload: expect.objectContaining({
        seed: 555,
        mode: EngineMode.Replay,
        commandLog: commands,
        debugSnapshotInterval: 0,
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
      payload: {
          type: "TOGGLE_DEBUG_OVERLAY",
          enabled: true
      },
    });
  });

  it("should send toggleLosOverlay command", () => {
    client.toggleLosOverlay(true);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "COMMAND",
      payload: {
          type: "TOGGLE_LOS_OVERLAY",
          enabled: true
      },
    });
  });

  it("should send queryState message", () => {
    client.queryState();
    expect(postMessageMock).toHaveBeenCalledWith({ type: "QUERY_STATE" });
  });

  it("should save mission config to localStorage in Simulation mode", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    client.init(
      12345,
      MapGeneratorType.DenseShip,
      undefined,
      true,
      false,
      true,
      { soldiers: [], inventory: {} },
      MissionType.Default,
      16,
      16,
      3,
      false,
      0,
      1.0,
      false,
      true,
      EngineMode.Simulation,
      [],
      "test-node-123",
    );

    expect(spy).toHaveBeenCalledWith("voidlock_mission_config", expect.any(String));
    spy.mockRestore();
  });

  it("should propagate campaignNodeId and nodeType to worker in INIT message", () => {
    client.init(
      12345,
      MapGeneratorType.DenseShip,
      undefined,
      true,
      false,
      true,
      { soldiers: [{ archetypeId: "assault" } as any], inventory: {} },
      MissionType.Default,
      10,
      10,
      3,
      false,
      0,
      1.0,
      false,
      true,
      EngineMode.Simulation,
      [],
      "test-node-123",
      0,
      3,
      1,
      0,
      "Elite",
    );

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "INIT",
      payload: expect.objectContaining({
        campaignNodeId: "test-node-123",
        nodeType: "Elite",
        debugSnapshotInterval: 0,
      }),
    });
  });
});
