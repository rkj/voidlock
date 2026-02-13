// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InputManager } from "@src/renderer/InputManager";

describe("KeyboardControlsVerification", () => {
  let inputManager: InputManager;
  let mockScreenManager: any;
  let mockMenuController: any;
  let cycleUnits: any;
  let panMap: any;

  beforeEach(() => {
    document.body.innerHTML =
      '<div id="game-container"><canvas id="game-canvas"></canvas></div>';
    mockScreenManager = {
      getCurrentScreen: vi.fn(() => "mission"),
    };
    mockMenuController = {
      menuState: "ACTION_SELECT",
    };
    cycleUnits = vi.fn();
    panMap = vi.fn();

    inputManager = new InputManager(
      mockScreenManager,
      mockMenuController,
      {} as any, // modalService
      vi.fn(), // togglePause
      vi.fn(), // handleMenuInput
      vi.fn(), // abortMission
      vi.fn(), // onUnitDeselect
      vi.fn(), // getSelectedUnitId
      vi.fn(), // handleCanvasClick
      vi.fn(), // onToggleDebug
      vi.fn(), // onToggleLos
      vi.fn(), // currentGameState
      () => false, // isDebriefing
      vi.fn(), // onDeployUnit
      vi.fn(), // onUndeployUnit
      vi.fn(), // getCellCoordinates
      cycleUnits,
      panMap,
      vi.fn(), // panMapBy
      vi.fn(), // zoomMap
    );
    inputManager.init();
  });

  afterEach(() => {
    inputManager.destroy();
  });

  it("should call cycleUnits on Tab", () => {
    const event = new KeyboardEvent("keydown", { key: "Tab" });
    document.dispatchEvent(event);
    expect(cycleUnits).toHaveBeenCalledWith(false);
  });

  it("should call cycleUnits(true) on Shift+Tab", () => {
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true });
    document.dispatchEvent(event);
    expect(cycleUnits).toHaveBeenCalledWith(true);
  });

  it("should call panMap on Arrow keys", () => {
    const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    keys.forEach((key) => {
      const event = new KeyboardEvent("keydown", { key });
      document.dispatchEvent(event);
      expect(panMap).toHaveBeenCalledWith(key);
    });
  });
});
