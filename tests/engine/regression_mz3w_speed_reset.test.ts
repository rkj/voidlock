import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameClient } from "@src/engine/GameClient";
import { MapGenerationConfig, MapDefinition } from "@src/shared/types";
import { MapFactory } from "@src/engine/map/MapFactory";

// Mock Worker
const postMessageMock = vi.fn();
const terminateMock = vi.fn();

class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  postMessage = postMessageMock;
  terminate = terminateMock;
}

vi.stubGlobal("Worker", MockWorker);

// Mock MapGeneratorFactory
const mockMapGeneratorFactory = (_config: MapGenerationConfig) => {
  return {
    generate: vi.fn().mockReturnValue({ width: 10, height: 10, cells: [] }),
    load: vi
      .fn()
      .mockImplementation(
        (data: MapDefinition) => data || { width: 10, height: 10, cells: [] },
      ),
  } as unknown as MapFactory;
};

describe("Regression mz3w: Speed Reset on Unpause", () => {
  let client: GameClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GameClient(mockMapGeneratorFactory);
  });

  it("should preserve speed setting after pause/unpause", () => {
    // 1. Set speed to 5.0x
    client.setTimeScale(5.0);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 5.0,
    });

    // 2. Pause the game
    // Note: Pause should set time scale to 0.1 (Active Pause)
    client.pause();
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 0.1,
    });

    // 3. Unpause (Resume)
    client.resume();
    // It should restore the previous speed (5.0x)
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_PAUSED",
      payload: false,
    });
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 5.0,
    });
    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "SET_TARGET_TIME_SCALE",
      payload: 5.0,
    });
  });

  it("should allow changing 'pending' speed while paused", () => {
    client.setTimeScale(1.0);
    client.pause();
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_PAUSED",
      payload: true,
    });
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 0.1,
    });

    // Change speed while paused
    client.setTimeScale(2.5);
    // Should NOT send to worker immediately SET_TIME_SCALE, but should send SET_TARGET_TIME_SCALE
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TARGET_TIME_SCALE",
      payload: 2.5,
    });

    client.resume();
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_PAUSED",
      payload: false,
    });
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 2.5,
    });
    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "SET_TARGET_TIME_SCALE",
      payload: 2.5,
    });
  });
});
