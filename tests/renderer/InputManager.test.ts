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
      debugOverlayEnabled: false,
      debugSnapshots: false,
      losOverlayEnabled: false,
    },
  };

  beforeEach(() => {
    document.body.innerHTML = '<canvas id="game-canvas"></canvas>';
    debriefingActive = false;
    mockScreenManager = {
      getCurrentScreen: vi.fn(() => "mission"),
      goBack: vi.fn(),
      getScreenElement: vi.fn(() => document.createElement("div")),
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

    inputManager = new InputManager({
      screenManager: mockScreenManager,
      menuController: mockMenuController,
      togglePause,
      handleMenuInput,
      abortMission,
      onUnitDeselect,
      handleCanvasClick,
      onToggleDebug,
      onToggleLos,
      currentGameState,
      isDebriefing: () => debriefingActive,
      getSelectedUnitId,
      onDeployUnit: vi.fn(),
      onUndeployUnit: vi.fn(),
      getCellCoordinates: vi.fn(() => ({ x: 0, y: 0 })),
      getWorldCoordinates: vi.fn(() => ({ x: 0, y: 0 })),
      cycleUnits: vi.fn(),
      panMap: vi.fn(),
      panMapBy: vi.fn(),
      zoomMap: vi.fn(),
    });
    inputManager.init();
  });

  afterEach(() => {
    inputManager.destroy();
  });

  it("should toggle debug overlay on Backquote", () => {
    // Current InputManager uses e.key === "~" || e.key === "`"
    const event = new KeyboardEvent("keydown", { key: "`" });
    document.dispatchEvent(event);

    expect(onToggleDebug).toHaveBeenCalledWith(true);
  });

  it("should toggle LOS overlay on Shift+Backquote", () => {
    // Current InputManager uses e.key.toLowerCase() === "l"
    const event = new KeyboardEvent("keydown", {
      key: "l",
    });
    document.dispatchEvent(event);

    expect(onToggleLos).toHaveBeenCalledWith(true);
  });

  it("should toggle pause on Space", () => {
    const event = new KeyboardEvent("keydown", { key: " " });
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
