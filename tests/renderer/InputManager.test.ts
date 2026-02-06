// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InputManager } from "@src/renderer/InputManager";

describe("InputManager", () => {
  let inputManager: InputManager;
  let mockScreenManager: any;
  let mockMenuController: any;
  let togglePause: any;
  let handleMenuInput: any;
  let abortMission: any;
  let onUnitDeselect: any;
  let getSelectedUnitId: any;
  let handleCanvasClick: any;
  let onToggleDebug: any;
  let onToggleLos: any;
  let currentGameState: any;
  let debriefingActive = false;

  const mockState = {
    settings: {
      debugOverlayEnabled: false, debugSnapshots: false,
      losOverlayEnabled: false,
    },
  };

  beforeEach(() => {
    document.body.innerHTML = '<canvas id="game-canvas"></canvas>';
    debriefingActive = false;
    mockScreenManager = {
      getCurrentScreen: vi.fn(() => "mission"),
      goBack: vi.fn(),
    };
    mockMenuController = {
      menuState: "ACTION_SELECT",
      goBack: vi.fn(),
    };
    togglePause = vi.fn();
    handleMenuInput = vi.fn();
    abortMission = vi.fn();
    onUnitDeselect = vi.fn();
    getSelectedUnitId = vi.fn(() => null);
    handleCanvasClick = vi.fn();
    onToggleDebug = vi.fn();
    onToggleLos = vi.fn();
    currentGameState = vi.fn(() => mockState);

    const mockModalService = {
      alert: vi.fn(),
      confirm: vi.fn(),
    };

    inputManager = new InputManager(
      mockScreenManager,
      mockMenuController,
      mockModalService as any,
      togglePause,
      handleMenuInput,
      abortMission,
      onUnitDeselect,
      getSelectedUnitId,
      handleCanvasClick,
      onToggleDebug,
      onToggleLos,
      currentGameState,
      () => debriefingActive,
      vi.fn(),
      vi.fn(() => ({ x: 0, y: 0 })),
    );
    inputManager.init();
  });

  afterEach(() => {
    inputManager.destroy();
  });

  it("should toggle debug overlay on Backquote", () => {
    const event = new KeyboardEvent("keydown", { code: "Backquote" });
    document.dispatchEvent(event);

    expect(onToggleDebug).toHaveBeenCalledWith(true);
  });

  it("should toggle LOS overlay on Shift+Backquote", () => {
    const event = new KeyboardEvent("keydown", {
      code: "Backquote",
      shiftKey: true,
    });
    document.dispatchEvent(event);

    expect(onToggleLos).toHaveBeenCalledWith(true);
  });

  it("should toggle pause on Space", () => {
    const event = new KeyboardEvent("keydown", { code: "Space" });
    document.dispatchEvent(event);

    expect(togglePause).toHaveBeenCalled();
  });

  it("should block inputs when isDebriefing is true", () => {
    debriefingActive = true;

    const event = new KeyboardEvent("keydown", { code: "Space" });
    document.dispatchEvent(event);

    expect(togglePause).not.toHaveBeenCalled();
  });
});
