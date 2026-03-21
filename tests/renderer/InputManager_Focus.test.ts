import { InputDispatcher } from "@src/renderer/InputDispatcher";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InputManager } from "@src/renderer/InputManager";
import { GameState } from "@src/shared/types";

describe("InputManager Focus Handling", () => {
  let inputManager: InputManager;
  let mockScreenManager: any;
  let mockMenuController: any;
  let currentGameState: any;
  let cycleUnits: any;
  let mockInputDispatcher: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-mission"></div><canvas id="game-canvas"></canvas><button id="ui-btn">UI Button</button>';
    mockScreenManager = {
      getCurrentScreen: vi.fn(() => "mission"),
    };
    mockMenuController = {
      getRenderableState: vi.fn().mockReturnValue({}),
      menuState: "ACTION_SELECT",
    };
    cycleUnits = vi.fn();
    currentGameState = vi.fn(() => ({ status: "Playing" } as GameState));
    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };

    inputManager = new InputManager({
      inputDispatcher: mockInputDispatcher,
      screenManager: mockScreenManager,
      menuController: mockMenuController,
      togglePause: vi.fn(),
      handleMenuInput: vi.fn(),
      abortMission: vi.fn(),
      onUnitDeselect: vi.fn(),
      handleCanvasClick: vi.fn(),
      onToggleDebug: vi.fn(),
      onToggleLos: vi.fn(),
      currentGameState,
      isDebriefing: () => false,
      getSelectedUnitId: vi.fn(() => null),
      onDeployUnit: vi.fn(),
      onUndeployUnit: vi.fn(),
      getCellCoordinates: vi.fn(() => ({ x: 0, y: 0 })),
      getWorldCoordinates: vi.fn(() => ({ x: 0, y: 0 })),
      cycleUnits,
      panMap: vi.fn(),
      panMapBy: vi.fn(),
      zoomMap: vi.fn(),
    });
    inputManager.init();
  });

  afterEach(() => {
    inputManager.destroy();
  });

  it("should not trap focus when status is Playing", () => {
    // status is Playing by default in currentGameState mock
    expect(inputManager.trapsFocus).toBe(false);
  });

  it("should trap focus when status is Deployment", () => {
    currentGameState.mockReturnValue({ status: "Deployment" } as GameState);
    expect(inputManager.trapsFocus).toBe(true);
  });

  it("should allow default Tab behavior when UI element is focused", () => {
    const btn = document.getElementById("ui-btn")!;
    btn.focus();
    
    const event = new KeyboardEvent("keydown", { key: "Tab" });
    const handled = inputManager.handleKeyDown(event);
    
    expect(handled).toBe(false);
    expect(cycleUnits).not.toHaveBeenCalled();
  });

  it("should cycle units on Tab when no UI element is focused", () => {
    // Ensure no UI element is focused
    (document.activeElement as HTMLElement)?.blur();
    
    const event = new KeyboardEvent("keydown", { key: "Tab" });
    const handled = inputManager.handleKeyDown(event);
    
    expect(handled).toBe(true);
    expect(cycleUnits).toHaveBeenCalled();
  });
});
