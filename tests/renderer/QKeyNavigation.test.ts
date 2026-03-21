/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InputManager } from "@src/renderer/InputManager";
import { GlobalShortcuts } from "@src/renderer/GlobalShortcuts";
import { InputDispatcher } from "@src/renderer/InputDispatcher";

describe("Q and ESC Key Navigation", () => {
  let inputManager: InputManager;
  let globalShortcuts: GlobalShortcuts;
  let dispatcher: InputDispatcher;
  let mockScreenManager: any;
  let mockMenuController: any;
  let togglePause: any;
  let handleMenuInput: any;
  let abortMission: any;
  let onUnitDeselect: any;
  let getSelectedUnitId: any;

  beforeEach(() => {
    document.body.innerHTML = `
        <div id="screen-mission" class="screen">
            <canvas id="game-canvas"></canvas>
        </div>
        <div id="screen-settings" class="screen" style="display:none"></div>
    `;
    
    // Ensure clean state
    if ((window as any).__INPUT_DISPATCHER_INSTANCE__) {
        (window as any).__INPUT_DISPATCHER_INSTANCE__.destroy();
    }
    dispatcher = new InputDispatcher();

    mockScreenManager = {
      getCurrentScreen: vi.fn(() => "mission"),
      goBack: vi.fn(),
      getScreenElement: vi.fn((id) => document.getElementById(`screen-${id}`)),
    };
    mockMenuController = {
      getRenderableState: vi.fn().mockReturnValue({}),
      menuState: "ACTION_SELECT",
      goBack: vi.fn(),
      handleMenuInput: vi.fn(function(this: any, key: string) {
        if (key === "q") this.goBack();
      }),
    };
    togglePause = vi.fn();
    handleMenuInput = vi.fn((key, shift) => mockMenuController.handleMenuInput(key));
    abortMission = vi.fn();
    onUnitDeselect = vi.fn();
    getSelectedUnitId = vi.fn(() => null);

    inputManager = new InputManager({
      inputDispatcher: dispatcher,
      screenManager: mockScreenManager as any,
      menuController: mockMenuController as any,
      togglePause,
      handleMenuInput,
      abortMission,
      onUnitDeselect,
      handleCanvasClick: vi.fn(),
      onToggleDebug: vi.fn(),
      onToggleLos: vi.fn(),
      currentGameState: vi.fn(() => ({ status: "Active" })),
      isDebriefing: () => false,
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

    globalShortcuts = new GlobalShortcuts(dispatcher, togglePause, () =>
      mockScreenManager.goBack(),
    );
    globalShortcuts.init();
  });

  afterEach(() => {
    inputManager.destroy();
    globalShortcuts.destroy();
    dispatcher.destroy();
  });

  it("should call menuController.handleMenuInput('q') when 'q' is pressed in mission submenu", () => {
    mockMenuController.menuState = "ORDERS_SELECT";
    const event = new KeyboardEvent("keydown", { key: "q", bubbles: true });
    window.dispatchEvent(event);
    expect(handleMenuInput).toHaveBeenCalledWith("q", false);
  });

  it("should call onUnitDeselect() when 'q' is pressed in mission ACTION_SELECT with unit selected", () => {
    mockMenuController.menuState = "ACTION_SELECT";
    getSelectedUnitId.mockReturnValue("u1");
    const event = new KeyboardEvent("keydown", { key: "q", bubbles: true });
    window.dispatchEvent(event);
    expect(onUnitDeselect).toHaveBeenCalled();
  });

  it("should NOT call abortMission() when 'q' is pressed in mission ACTION_SELECT with NO unit selected", () => {
    mockMenuController.menuState = "ACTION_SELECT";
    getSelectedUnitId.mockReturnValue(null);
    const event = new KeyboardEvent("keydown", { key: "q", bubbles: true });
    window.dispatchEvent(event);
    expect(abortMission).not.toHaveBeenCalled();
    // But it SHOULD fall back to global shortcuts which calls goBack
    expect(mockScreenManager.goBack).toHaveBeenCalled();
  });

  it("should call abortMission() when 'Escape' is pressed in mission ACTION_SELECT with NO unit selected", () => {
    mockMenuController.menuState = "ACTION_SELECT";
    getSelectedUnitId.mockReturnValue(null);
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    window.dispatchEvent(event);
    expect(abortMission).toHaveBeenCalled();
  });

  it("should call screenManager.goBack() when 'q' is pressed in non-mission screen", () => {
    mockScreenManager.getCurrentScreen.mockReturnValue("settings");
    const event = new KeyboardEvent("keydown", { key: "q", bubbles: true });
    window.dispatchEvent(event);
    expect(mockScreenManager.goBack).toHaveBeenCalled();
  });

  it("should call screenManager.goBack() when 'Escape' is pressed in non-mission screen", () => {
    mockScreenManager.getCurrentScreen.mockReturnValue("settings");
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    window.dispatchEvent(event);
    expect(mockScreenManager.goBack).toHaveBeenCalled();
  });
});
