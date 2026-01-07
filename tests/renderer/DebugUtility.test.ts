// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DebugUtility } from "@src/renderer/DebugUtility";

describe("DebugUtility", () => {
  const mockState: any = { t: 100, status: "Playing" };
  const mockReplayData: any = { seed: 12345 };
  const version = "1.0.0";

  beforeEach(() => {
    vi.stubGlobal("alert", vi.fn());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should use navigator.clipboard when available", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    DebugUtility.copyWorldState(mockState, mockReplayData, version);

    expect(writeTextMock).toHaveBeenCalled();
    // Since writeText is async, we need to wait for the promise to resolve to see the alert
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(window.alert).toHaveBeenCalledWith("World State copied to clipboard!");
  });

  it("should fallback to console when navigator.clipboard is missing", () => {
    vi.stubGlobal("navigator", {});

    DebugUtility.copyWorldState(mockState, mockReplayData, version);

    expect(console.error).toHaveBeenCalledWith(
      "Failed to copy state to clipboard:",
      expect.any(Error)
    );
    expect(console.log).toHaveBeenCalledWith("Full World State JSON:");
    expect(window.alert).toHaveBeenCalledWith(
      "Failed to copy to clipboard. See console for JSON."
    );
  });

  it("should fallback to console when writeText fails", async () => {
    const error = new Error("Clipboard fail");
    const writeTextMock = vi.fn().mockRejectedValue(error);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    DebugUtility.copyWorldState(mockState, mockReplayData, version);

    expect(writeTextMock).toHaveBeenCalled();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(console.error).toHaveBeenCalledWith(
      "Failed to copy state to clipboard:",
      error
    );
    expect(window.alert).toHaveBeenCalledWith(
      "Failed to copy to clipboard. See console for JSON."
    );
  });

  it("should fallback to console when writeText throws synchronously", () => {
    const error = new Error("Sync Clipboard fail");
    const writeTextMock = vi.fn().mockImplementation(() => {
      throw error;
    });
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    // This should NOT throw if the fix is implemented correctly
    DebugUtility.copyWorldState(mockState, mockReplayData, version);

    expect(console.error).toHaveBeenCalledWith(
      "Failed to copy state to clipboard:",
      error
    );
    expect(window.alert).toHaveBeenCalledWith(
      "Failed to copy to clipboard. See console for JSON."
    );
  });
});
