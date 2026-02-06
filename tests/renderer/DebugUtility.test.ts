// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DebugUtility } from "@src/renderer/DebugUtility";

describe("DebugUtility", () => {
  const mockState: any = { t: 100, status: "Playing" };
  const mockReplayData: any = { seed: 12345 };
  const version = "1.0.0";
  let mockModalService: any;

  beforeEach(() => {
    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(console, "info").mockImplementation(() => {});
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

    await DebugUtility.copyWorldState(
      mockState,
      mockReplayData,
      version,
      mockModalService,
    );

    expect(writeTextMock).toHaveBeenCalled();
    expect(mockModalService.alert).toHaveBeenCalledWith(
      "World State copied to clipboard!",
    );
  });

  it("should fallback to console when navigator.clipboard is missing", async () => {
    vi.stubGlobal("navigator", {});

    await DebugUtility.copyWorldState(
      mockState,
      mockReplayData,
      version,
      mockModalService,
    );

    expect(console.error).toHaveBeenCalledWith(
      "Failed to copy state to clipboard:",
      expect.any(Error),
    );
    expect(console.info).toHaveBeenCalledWith("Full World State JSON:");
    expect(mockModalService.alert).toHaveBeenCalledWith(
      "Failed to copy to clipboard. See console for JSON.",
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

    await DebugUtility.copyWorldState(
      mockState,
      mockReplayData,
      version,
      mockModalService,
    );

    expect(writeTextMock).toHaveBeenCalled();

    expect(console.error).toHaveBeenCalledWith(
      "Failed to copy state to clipboard:",
      error,
    );
    expect(mockModalService.alert).toHaveBeenCalledWith(
      "Failed to copy to clipboard. See console for JSON.",
    );
  });

  it("should fallback to console when writeText throws synchronously", async () => {
    const error = new Error("Sync Clipboard fail");
    const writeTextMock = vi.fn().mockImplementation(() => {
      throw error;
    });
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    await DebugUtility.copyWorldState(
      mockState,
      mockReplayData,
      version,
      mockModalService,
    );

    expect(console.error).toHaveBeenCalledWith(
      "Failed to copy state to clipboard:",
      error,
    );
    expect(mockModalService.alert).toHaveBeenCalledWith(
      "Failed to copy to clipboard. See console for JSON.",
    );
  });
});