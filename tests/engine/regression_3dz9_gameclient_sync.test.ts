import { describe, it, expect, vi, afterEach } from "vitest";
import { GameClient } from "@src/engine/GameClient";
import {
  CommandType,
  MapDefinition,
  MapGeneratorType,
  MoveCommand,
  SquadConfig,
  EngineMode,
  CommandLogEntry,
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
  const generator = new MapGenerator(seed);
  generator.generate = vi.fn().mockReturnValue(mapData || { width: 10, height: 10, cells: [] });
  generator.load = vi.fn().mockReturnValue(mapData || { width: 10, height: 10, cells: [] });
  return generator;
};

describe("Regression 3dz9: GameClient startTime Synchronization", () => {
  const mockMap: MapDefinition = { width: 10, height: 10, cells: [] };
  const defaultSquad: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("should synchronize startTime when initialized with commandLog", () => {
    vi.useFakeTimers();
    const client = new GameClient(mockMapGeneratorFactory);
    
    const commandLog: CommandLogEntry[] = [
      { tick: 1000, command: { type: CommandType.STOP, unitIds: [] } },
      { tick: 5000, command: { type: CommandType.STOP, unitIds: [] } },
    ];

    // Mock localStorage
    const storage: Record<string, string> = {};
    const mockLocalStorage = {
      setItem: vi.fn((key, value) => { storage[key] = value; }),
      getItem: vi.fn((key) => storage[key] || null),
      removeItem: vi.fn((key) => { delete storage[key]; }),
    };
    vi.stubGlobal("localStorage", mockLocalStorage);

    // Initial time is 10000
    vi.setSystemTime(10000);

    client.init(
      123,
      MapGeneratorType.Procedural,
      mockMap,
      true, false, true,
      defaultSquad,
      "Default" as any,
      16, 16, 3, false, 0, 1.0, false, true,
      EngineMode.Simulation,
      commandLog
    );

    // Advance time by 200ms (to 10200)
    vi.advanceTimersByTime(200);

    const cmd: MoveCommand = {
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 1, y: 1 },
    };
    client.sendCommand(cmd);

    // If startTime was correctly synchronized, the new command's tick should be 5000 + 200 = 5200
    const replay = client.getReplayData();
    const lastCommand = replay?.commands[replay.commands.length - 1];
    expect(lastCommand?.t).toBe(5200);

    // Verify localStorage also has the correct tick
    const logStr = storage["voidlock_mission_log"];
    const log: CommandLogEntry[] = JSON.parse(logStr);
    expect(log[log.length - 1].tick).toBe(5200);
    
    // Verify commandStream was initialized from commandLog
    expect(replay?.commands.length).toBe(3);
    expect(replay?.commands[0].t).toBe(1000);
    expect(replay?.commands[1].t).toBe(5000);
  });
});
