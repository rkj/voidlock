import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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

describe("Regression: Voidlock-8hwf Time Clamping", () => {
  let client: GameClient;
  const mockMap: MapDefinition = { width: 10, height: 10, cells: [] };
  const defaultSquad: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new GameClient(mockMapGeneratorFactory);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow active pause (0.05x) when allowTacticalPause is true", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
      "Default" as any,
      16,
      16,
      3,
      false,
      0,
      1.0,
      false,
      true, // allowTacticalPause = true
    );

    client.pause();
    expect(client.getTimeScale()).toBe(0.05);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 0.05,
    });
  });

  it("should use absolute pause (0.0x) when allowTacticalPause is false", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
      "Default" as any,
      16,
      16,
      3,
      false,
      0,
      1.0,
      false,
      false, // allowTacticalPause = false
    );

    client.pause();
    expect(client.getTimeScale()).toBe(0.0);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 0.0,
    });
  });

  it("should clamp timeScale to 1.0 when allowTacticalPause is false and scale < 1.0 is set", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
      "Default" as any,
      16,
      16,
      3,
      false,
      0,
      1.0,
      false,
      false, // allowTacticalPause = false
    );

    client.setTimeScale(0.5);
    expect(client.getTimeScale()).toBe(1.0);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 1.0,
    });
  });

  it("should NOT clamp timeScale when allowTacticalPause is false and scale >= 1.0 is set", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true,
      false,
      true,
      defaultSquad,
      "Default" as any,
      16,
      16,
      3,
      false,
      0,
      1.0,
      false,
      false, // allowTacticalPause = false
    );

    client.setTimeScale(2.0);
    expect(client.getTimeScale()).toBe(2.0);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 2.0,
    });
  });
});
