import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";

// Mock CoreEngine
vi.mock("../CoreEngine", () => {
  return {
    CoreEngine: vi.fn().mockImplementation(() => {
      return {
        update: vi.fn(),
        getState: vi.fn().mockReturnValue({ status: "Playing" }),
        applyCommand: vi.fn(),
      };
    }),
  };
});

describe("worker.ts Regression zzjz", () => {
  let onmessageHandler: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Mock self.postMessage
    const postMessage = vi.fn();
    vi.stubGlobal("self", {
      postMessage,
      onmessage: null,
    });

    // Import worker.ts - this will execute the module and set self.onmessage
    await import("../worker");
    onmessageHandler = (self as any).onmessage;
  });

  it("should reset timeScale to 1.0 on INIT", async () => {
    // 1. Set timeScale to something else
    onmessageHandler({
      data: {
        type: "SET_TIME_SCALE",
        payload: 2.0,
      },
    });

    vi.useFakeTimers();

    // 2. Send INIT
    onmessageHandler({
      data: {
        type: "INIT",
        payload: {
          map: { width: 10, height: 10, cells: [] },
          seed: 123,
          squadConfig: [],
        },
      },
    });

    // 3. Verify that the loop uses timeScale 1.0
    vi.advanceTimersByTime(16);

    const CoreEngineMock = vi.mocked(CoreEngine);
    const engineInstance = CoreEngineMock.mock.results[0].value;

    // Check first update call
    // TICK_RATE is 16, so 1.0 timeScale means scaledDt = 16
    // If it didn't reset, it would be 32 (16 * 2.0)
    expect(engineInstance.update).toHaveBeenCalledWith(16, 16);

    vi.useRealTimers();
  });
});
