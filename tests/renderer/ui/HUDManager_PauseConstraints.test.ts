// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, MissionType, UnitState, AIProfile } from "@src/shared/types";
import { setLocale } from "@src/renderer/i18n";

describe("HUDManager: Pause Constraints", () => {
  let hud: HUDManager;
  let mockMenuController: any;

  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    status: "Playing",
    units: [],
    enemies: [],
    visibleCells: [],
    map: {
      width: 10,
      height: 10,
      cells: [],
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 9, y: 9 },
      generatorName: "Unknown",
    },
    objectives: [],
    stats: {
      threatLevel: 0,
      aliensKilled: 0,
      casualties: 0,
      totalCredits: 0,
      missionsPlayed: 0,
      missionsWon: 0,
    },
    settings: {
      allowTacticalPause: true,
      debugOverlayEnabled: false,
      isPaused: false,
      targetTimeScale: 1.0,
      timeScale: 1.0,
    },
    commandLog: [],
  };

  beforeEach(() => {
    setLocale("en-standard");
    document.body.innerHTML = '<div id="screen-mission"><div id="mission-body"></div></div>';
    
    mockMenuController = {
      handleMenuInput: vi.fn(),
      getRenderableState: vi.fn().mockReturnValue({ title: "Test", options: [] }),
    };

    hud = new HUDManager({
      menuController: mockMenuController,
      tutorialManager: null,
      onUnitClick: vi.fn(),
      onAbortMission: vi.fn(),
      onMenuInput: vi.fn(),
      onCopyWorldState: vi.fn(),
      onForceWin: vi.fn(),
      onForceLose: vi.fn(),
      onStartMission: vi.fn(),
      onDeployUnit: vi.fn(),
    });
  });

  it("should show '0.0x (Paused)' when allowTacticalPause is false and paused", () => {
    const pausedState: GameState = {
      ...mockState,
      settings: { 
        ...mockState.settings, 
        isPaused: true,
        allowTacticalPause: false,
        timeScale: 0
      },
    };

    hud.update(pausedState, null);

    const speedValue = document.getElementById("speed-value");
    expect(speedValue?.textContent).toBe("0.0x (Paused)");
  });

  it("should show '0.1x (Active Pause)' when allowTacticalPause is true and paused", () => {
    const pausedState: GameState = {
      ...mockState,
      settings: { 
        ...mockState.settings, 
        isPaused: true,
        allowTacticalPause: true,
        timeScale: 0.1
      },
    };

    hud.update(pausedState, null);

    const speedValue = document.getElementById("speed-value");
    expect(speedValue?.textContent).toBe("0.1x (Active Pause)");
  });
});
