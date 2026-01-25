// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InputManager } from "@src/renderer/InputManager";
import { MenuController } from "@src/renderer/MenuController";
import { ScreenManager } from "@src/renderer/ScreenManager";

describe("Q and ESC Key Navigation", () => {
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
    handleCanvasClick = vi.fn();
    onToggleDebug = vi.fn();
    onToggleLos = vi.fn();
    currentGameState = vi.fn(() => ({}));

    const mockModalService = {
      alert: vi.fn(),
      confirm: vi.fn().mockResolvedValue(true),
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
      () => false,
    );
    inputManager.init();
  });

  afterEach(() => {
    inputManager.destroy();
  });

  it("should call menuController.goBack() when 'q' is pressed in mission submenu", () => {
    mockMenuController.menuState = "ORDERS_SELECT";
    const event = new KeyboardEvent("keydown", { key: "q" });
    document.dispatchEvent(event);
    expect(mockMenuController.goBack).toHaveBeenCalled();
  });

  it("should call onUnitDeselect() when 'q' is pressed in mission ACTION_SELECT with unit selected", () => {
    mockMenuController.menuState = "ACTION_SELECT";
    getSelectedUnitId.mockReturnValue("u1");
    const event = new KeyboardEvent("keydown", { key: "q" });
    document.dispatchEvent(event);
    expect(onUnitDeselect).toHaveBeenCalled();
  });

  it("should NOT call abortMission() when 'q' is pressed in mission ACTION_SELECT with NO unit selected", () => {
    mockMenuController.menuState = "ACTION_SELECT";
    getSelectedUnitId.mockReturnValue(null);
    window.confirm = vi.fn(() => true);
    const event = new KeyboardEvent("keydown", { key: "q" });
    document.dispatchEvent(event);
    expect(abortMission).not.toHaveBeenCalled();
  });

  it("should call abortMission() when 'Escape' is pressed in mission ACTION_SELECT with NO unit selected", async () => {
    mockMenuController.menuState = "ACTION_SELECT";
    getSelectedUnitId.mockReturnValue(null);
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);

    // Wait for the promise in InputManager
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(abortMission).toHaveBeenCalled();
  });

  it("should call screenManager.goBack() when 'q' is pressed in non-mission screen", () => {
    mockScreenManager.getCurrentScreen.mockReturnValue("mission-setup");
    const event = new KeyboardEvent("keydown", { key: "q" });
    document.dispatchEvent(event);
    expect(mockScreenManager.goBack).toHaveBeenCalled();
  });

  it("should call screenManager.goBack() when 'Escape' is pressed in non-mission screen", () => {
    mockScreenManager.getCurrentScreen.mockReturnValue("mission-setup");
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);
    expect(mockScreenManager.goBack).toHaveBeenCalled();
  });
});
