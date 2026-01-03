// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InputManager } from "./InputManager";
import { CommandType, EngineMode } from "../shared/types";

describe("InputManager", () => {
  let inputManager: InputManager;
  let mockScreenManager: any;
  let mockMenuController: any;
  let togglePause: any;
  let handleMenuInput: any;
  let abortMission: any;
  let onUnitDeselect: any;
  let getSelectedUnitId: any;
  let updateUI: any;
  let handleCanvasClick: any;
  let sendCommand: any;
  let currentGameState: any;

  const mockState = {
    settings: {
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
    },
  };

  beforeEach(() => {
    document.body.innerHTML = '<canvas id="game-canvas"></canvas>';
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
    updateUI = vi.fn();
    handleCanvasClick = vi.fn();
    sendCommand = vi.fn();
    currentGameState = vi.fn(() => mockState);

    inputManager = new InputManager(
      mockScreenManager,
      mockMenuController,
      togglePause,
      handleMenuInput,
      abortMission,
      onUnitDeselect,
      getSelectedUnitId,
      updateUI,
      handleCanvasClick,
      sendCommand,
      currentGameState,
    );
    inputManager.init();
  });

  it("should toggle debug overlay on Backquote", () => {
    const event = new KeyboardEvent("keydown", { code: "Backquote" });
    document.dispatchEvent(event);

    expect(sendCommand).toHaveBeenCalledWith({
      type: CommandType.TOGGLE_DEBUG_OVERLAY,
      enabled: true,
    });
  });

  it("should toggle LOS overlay on Shift+Backquote", () => {
    const event = new KeyboardEvent("keydown", {
      code: "Backquote",
      shiftKey: true,
    });
    document.dispatchEvent(event);

    expect(sendCommand).toHaveBeenCalledWith({
      type: CommandType.TOGGLE_LOS_OVERLAY,
      enabled: true,
    });
  });

  it("should toggle pause on Space", () => {
    const event = new KeyboardEvent("keydown", { code: "Space" });
    document.dispatchEvent(event);

    expect(togglePause).toHaveBeenCalled();
  });
});
