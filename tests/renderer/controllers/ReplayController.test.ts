import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReplayController } from "@src/renderer/controllers/ReplayController";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";
import { EngineMode } from "@src/shared/types";

describe("ReplayController", () => {
  let controller: ReplayController;
  let mockGameClient: any;
  let mockTheme: any;
  let mockAssets: any;
  let onProgressUpdate: any;

  beforeEach(() => {
    mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
      addStateUpdateListener: vi.fn(),
      removeStateUpdateListener: vi.fn(),
      getIsPaused: vi.fn(() => true),
      togglePause: vi.fn(),
      getTargetScale: vi.fn(() => 1.0),
      setTimeScale: vi.fn(),
      getTimeScale: vi.fn().mockReturnValue(1.0),
      getReplayData: vi.fn(() => ({})),
      loadReplay: vi.fn(),
      stop: vi.fn(),
      queryState: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    };
    mockTheme = {
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#ffffff"),
    };
    mockAssets = {
      iconImages: {},
      unitSprites: {},
      enemySprites: {},
      getMiscSprite: vi.fn(),
      getIcon: vi.fn(),
    };
    onProgressUpdate = vi.fn();
    controller = new ReplayController({
      gameClient: mockGameClient,
      themeManager: (typeof mockTheme !== 'undefined' ? mockTheme : {} as any),
      assetManager: (typeof mockAssets !== 'undefined' ? mockAssets : {} as any),
      onProgressUpdate: onProgressUpdate
    });
  });

  it("should seek(0) when progress >= 100 and looping is enabled", () => {
    controller.setLooping(true);
    controller.startReplay(1000);

    const state = createMockGameState({ 
      t: 1000,
      settings: { mode: EngineMode.Replay } as any
    });
    // @ts-ignore - access private for test
    controller.handleStateUpdate(state);

    expect(mockGameClient.seek).toHaveBeenCalledWith(0);
    expect(onProgressUpdate).toHaveBeenCalledWith(100);
  });

  it("should call gameClient.pause() when progress >= 100 and looping is disabled", () => {
    mockGameClient.getIsPaused.mockReturnValue(false);
    controller.setLooping(false);
    controller.startReplay(1000);

    const state = createMockGameState({ 
      t: 1000,
      settings: { mode: EngineMode.Replay } as any
    });
    // @ts-ignore - access private for test
    controller.handleStateUpdate(state);

    expect(mockGameClient.pause).toHaveBeenCalled();
    expect(onProgressUpdate).toHaveBeenCalledWith(100);
  });
});
