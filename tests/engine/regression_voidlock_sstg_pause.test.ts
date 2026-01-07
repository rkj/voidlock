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

describe("GameClient Pause Logic (sstg.2)", () => {
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

  it("should use 0.05x for active pause when allowed", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true, false, true,
      defaultSquad,
      undefined, 16, 16, 3, false, 0,
      1.0, // initial scale
      false, // startPaused
      true // allowTacticalPause
    );

    client.togglePause(); // Should pause
    expect(client.getIsPaused()).toBe(true);
    expect(client.getTimeScale()).toBe(0.05);
    
    // Verify SET_TIME_SCALE was sent to worker with 0.05
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 0.05
    });
  });

  it("should resume to last non-paused scale", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true, false, true,
      defaultSquad,
      undefined, 16, 16, 3, false, 0,
      1.0, false, true
    );

    client.setTimeScale(2.0);
    client.togglePause(); // Pause
    expect(client.getTimeScale()).toBe(0.05);

    client.togglePause(); // Resume
    expect(client.getTimeScale()).toBe(2.0);
    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "SET_TIME_SCALE",
      payload: 2.0
    });
  });

  it("should disable togglePause when tactical pause is NOT allowed", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true, false, true,
      defaultSquad,
      undefined, 16, 16, 3, false, 0,
      1.0,
      false, // startPaused
      false // allowTacticalPause = FALSE
    );

    client.togglePause();
    expect(client.getIsPaused()).toBe(false);
    expect(client.getTimeScale()).toBe(1.0);
  });

  it("should clamp setTimeScale to 1.0 when tactical pause is NOT allowed", () => {
    client.init(
      12345,
      MapGeneratorType.Procedural,
      mockMap,
      true, false, true,
      defaultSquad,
      undefined, 16, 16, 3, false, 0,
      1.0,
      false,
      false // allowTacticalPause = FALSE
    );

    client.setTimeScale(0.5);
    expect(client.getTimeScale()).toBe(1.0);
    
    client.setTimeScale(5.0);
    expect(client.getTimeScale()).toBe(5.0);
    
    client.setTimeScale(20.0);
    expect(client.getTimeScale()).toBe(10.0);
  });
  
  it("should return 0.05 for getTimeScale when paused and tactical allowed", () => {
      client.init(
          12345,
          MapGeneratorType.Procedural,
          mockMap,
          true, false, true,
          defaultSquad,
          undefined, 16, 16, 3, false, 0,
          1.0, true, true
      );
      expect(client.getIsPaused()).toBe(true);
      expect(client.getTimeScale()).toBe(0.05);
  });
});
