import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GameClient } from "@src/engine/GameClient";
import {
  CommandType,
  MapDefinition,
  MapGeneratorType,
  SquadConfig,
  MapGenerationConfig,
  EngineMode,
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
  const generator = new MapGenerator(config);
  generator.generate = vi
    .fn()
    .mockReturnValue({ width: 10, height: 10, cells: [] });
  generator.load = vi
    .fn()
    .mockImplementation((data) => data || { width: 10, height: 10, cells: [] });
  return generator;
};

describe("Repro VO7L: Replay Command Synchronization", () => {
  let client: GameClient;
  const mockMap: MapDefinition = { width: 10, height: 10, cells: [] };
  const defaultSquad: SquadConfig = {
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

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

    client = new GameClient(mockMapGeneratorFactory);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should capture automatically issued EXPLORE command in replay data", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
    );

    // Simulate state update from worker that includes the EXPLORE command in commandLog
    // (CoreEngine automatically adds this if commandLog is empty)
    (client as any).worker.onmessage({
      data: {
        type: "STATE_UPDATE",
        payload: {
          t: 0,
          settings: { mode: EngineMode.Simulation },
          commandLog: [
            {
              tick: 0,
              command: { type: CommandType.EXPLORE, unitIds: ["s1"] },
            },
          ],
        },
      },
    });

    const replay = client.getReplayData();

    // CURRENTLY FAILING: replay data only includes commands sent via GameClient.sendCommand
    expect(replay?.commands.length).toBeGreaterThan(0);
    expect(replay?.commands[0].cmd.type).toBe(CommandType.EXPLORE);
  });

  it("should maintain correct command ticks even when sent between state updates", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
    );

    // Engine is at tick 0
    (client as any).worker.onmessage({
      data: {
        type: "STATE_UPDATE",
        payload: {
          t: 0,
          settings: { mode: EngineMode.Simulation },
          commandLog: [],
        },
      },
    });

    // Advance time in real world, but no state update yet
    vi.advanceTimersByTime(100);

    // Send a command. It should ideally use the CURRENT engine tick if we could know it,
    // but using the LAST KNOWN engine tick is the best we can do in the client.
    // However, if the engine state comes back with a different tick for this command,
    // we should prefer the engine's authoritative log.

    client.sendCommand({ type: CommandType.STOP, unitIds: ["s1"] });

    // Simulate next state update from worker which has processed the command at tick 16
    (client as any).worker.onmessage({
      data: {
        type: "STATE_UPDATE",
        payload: {
          t: 16,
          settings: { mode: EngineMode.Simulation },
          commandLog: [
            { tick: 16, command: { type: CommandType.STOP, unitIds: ["s1"] } },
          ],
        },
      },
    });

    const replay = client.getReplayData();
    // If it's syncing from engine, it should be 16.
    // If it's using the client's recorded tick at time of send, it would be 0.
    expect(replay?.commands[0].t).toBe(16);
  });
});
