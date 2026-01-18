// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DebugUtility } from "@src/renderer/DebugUtility";

describe("DebugUtility Map Generator Export Regression", () => {
  const mockState: any = { 
    t: 100, 
    status: "Playing",
    map: {
      generatorName: "TreeShipGenerator"
    }
  };
  const mockReplayData: any = { seed: 12345 };
  const version = "1.0.0";
  let mockModalService: any;

  beforeEach(() => {
    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should include mapGenerator in the exported JSON when generatorName is in state.map", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    await DebugUtility.copyWorldState(mockState, mockReplayData, version, mockModalService);

    expect(writeTextMock).toHaveBeenCalled();
    const jsonString = writeTextMock.mock.calls[0][0];
    const exportedObject = JSON.parse(jsonString);

    expect(exportedObject.mapGenerator).toBe("TreeShipGenerator");
  });

  it("should include mapGenerator in the exported JSON when generatorName is in replayData.map", async () => {
    const stateWithoutGenerator: any = { t: 100, status: "Playing", map: {} };
    const replayDataWithGenerator: any = { 
      seed: 12345,
      map: {
        generatorName: "DenseShipGenerator"
      }
    };
    
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    await DebugUtility.copyWorldState(stateWithoutGenerator, replayDataWithGenerator, version, mockModalService);

    const jsonString = writeTextMock.mock.calls[0][0];
    const exportedObject = JSON.parse(jsonString);

    expect(exportedObject.mapGenerator).toBe("DenseShipGenerator");
  });

  it("should fallback to 'Unknown' if generatorName is missing in both", async () => {
    const stateWithoutGenerator: any = { t: 100, status: "Playing", map: {} };
    const replayDataWithoutGenerator: any = { seed: 12345, map: {} };
    
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    await DebugUtility.copyWorldState(stateWithoutGenerator, replayDataWithoutGenerator, version, mockModalService);

    const jsonString = writeTextMock.mock.calls[0][0];
    const exportedObject = JSON.parse(jsonString);

    expect(exportedObject.mapGenerator).toBe("Unknown");
  });
});