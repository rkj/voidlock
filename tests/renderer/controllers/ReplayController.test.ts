// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReplayController } from "@src/renderer/controllers/ReplayController";
import { EngineMode } from "@src/shared/types";

describe("ReplayController", () => {
  let mockGameClient: any;
  let onProgressUpdate: any;
  let controller: ReplayController;

  beforeEach(() => {
    mockGameClient = {
      addStateUpdateListener: vi.fn(),
      removeStateUpdateListener: vi.fn(),
      queryState: vi.fn(),
      getReplayData: vi.fn(() => ({})),
      loadReplay: vi.fn(),
      setTimeScale: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      getIsPaused: vi.fn(() => false),
      togglePause: vi.fn(),
      getTargetScale: vi.fn(() => 1.0),
    };
    onProgressUpdate = vi.fn();
    controller = new ReplayController(mockGameClient, onProgressUpdate);
  });

  it("should seek(0) when progress >= 100 and looping is enabled", () => {
    controller.startReplay(1000);
    controller.setLooping(true);

    const listener = mockGameClient.addStateUpdateListener.mock.calls[0][0];

    const mockState: any = {
      t: 1000,
      settings: { mode: EngineMode.Replay },
    };

    listener(mockState);

    expect(mockGameClient.seek).toHaveBeenCalledWith(0);
    expect(onProgressUpdate).toHaveBeenCalledWith(100);
  });

  it("should call gameClient.pause() when progress >= 100 and looping is disabled", () => {
    controller.startReplay(1000);
    controller.setLooping(false);

    const listener = mockGameClient.addStateUpdateListener.mock.calls[0][0];

    const mockState: any = {
      t: 1000,
      settings: { mode: EngineMode.Replay },
    };

    listener(mockState);

    // This is expected to fail initially as it's not implemented yet
    expect(mockGameClient.pause).toHaveBeenCalled();
    expect(onProgressUpdate).toHaveBeenCalledWith(100);
  });

  it("should throttle seek requests", () => {
    controller.startReplay(1000);

    // First seek should go through
    controller.seek(10);
    expect(mockGameClient.seek).toHaveBeenCalledTimes(1);

    // Second seek immediately after should be throttled
    controller.seek(20);
    expect(mockGameClient.seek).toHaveBeenCalledTimes(1);

    // After a delay, seek should work again
    // We use vi.advanceTimersByTime or just wait?
    // Actually our implementation uses performance.now() and returns early.
    // So we need to mock performance.now()
    const now = performance.now();
    vi.spyOn(performance, "now").mockReturnValue(now + 20);

    controller.seek(30);
    expect(mockGameClient.seek).toHaveBeenCalledTimes(2);
    expect(mockGameClient.seek).toHaveBeenLastCalledWith(300);

    vi.restoreAllMocks();
  });
});
