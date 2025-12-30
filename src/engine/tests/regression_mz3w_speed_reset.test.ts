import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameClient } from "../GameClient";
import { MapGeneratorType } from "../../shared/types";

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
const mockMapGeneratorFactory = () => {
  return {
    generate: vi.fn().mockReturnValue({ width: 10, height: 10, cells: [] }),
    load: vi.fn().mockReturnValue({ width: 10, height: 10, cells: [] }),
  } as any;
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
    // Note: Pause should set time scale to 0.05 (Active Pause)
    client.pause();
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 0.05,
    });

    // 3. Unpause (Resume)
    client.resume();
    // It should restore the previous speed (5.0x)
    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "SET_TIME_SCALE",
      payload: 5.0,
    });
  });

  it("should allow changing 'pending' speed while paused", () => {
    client.setTimeScale(1.0);
    client.pause();
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 0.05,
    });

    // Change speed while paused
    client.setTimeScale(2.5);
    // Should NOT send to worker immediately, OR should send 0.05 again to ensure it stays paused
    // If we want "Active Pause" to be strictly 0.05, we keep it there.

    client.resume();
    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "SET_TIME_SCALE",
      payload: 2.5,
    });
  });
});
