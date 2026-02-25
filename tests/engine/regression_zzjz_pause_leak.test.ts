import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameClient } from "@src/engine/GameClient";
import {
  MapDefinition,
  MapGeneratorType,
  SquadConfig,
  MapGenerationConfig,
} from "@src/shared/types";
import { MapGenerator } from "@src/engine/MapGenerator";

// Mock Worker
const postMessageMock = vi.fn();
class MockWorker {
  onmessage: any = null;
  postMessage = postMessageMock;
  terminate = vi.fn();
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

describe("GameClient Regression zzjz (Pause/Speed Leak)", () => {
  let client: GameClient;
  const mockMap: MapDefinition = { width: 10, height: 10, cells: [] };
  const defaultSquad: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GameClient(mockMapGeneratorFactory);
  });

  it("should reset pause and time scale on init", () => {
    // 1. Set some non-default state
    client.init(
      1,
      MapGeneratorType.Static,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
    );
    client.setTimeScale(2.0);
    client.pause(); // Should set scale to 0.1 and isPaused to true

    expect(client.getIsPaused()).toBe(true);
    expect(client.getTimeScale()).toBe(0.1);
    expect(client.getTargetScale()).toBe(2.0);

    postMessageMock.mockClear();

    // 2. Re-initialize
    client.init(
      2,
      MapGeneratorType.Static,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
    );

    // 3. Verify defaults are restored
    expect(client.getIsPaused()).toBe(false);
    expect(client.getTimeScale()).toBe(1.0);
    expect(client.getTargetScale()).toBe(1.0);

    // 4. Verify messages sent to worker
    // It should send INIT with the correct initialTimeScale
    const initCall = postMessageMock.mock.calls.find(
      (c) => c[0].type === "INIT",
    );

    expect(initCall).toBeDefined();
    expect(initCall![0].payload.initialTimeScale).toBe(1.0);
  });
});
