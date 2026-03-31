// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, MissionType } from "@src/shared/types";
import { setLocale } from "@src/renderer/i18n";

describe("HUDManager Objective Regression PDXS", () => {
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

  it("should hide coordinates when debug overlay is disabled", () => {
    const stateWithObjectives: GameState = {
      ...mockState,
      settings: { ...mockState.settings, debugOverlayEnabled: false },
      objectives: [
        {
          id: "o1",
          kind: "Kill",
          state: "Pending",
          targetCell: { x: 5, y: 5 },
          visible: true,
        },
      ],
    };

    hud.update(stateWithObjectives, null);

    const objectivesDiv = document.querySelector(".objectives-status");
    expect(objectivesDiv?.innerHTML).not.toContain("at (5,5)");
  });

  it("should show coordinates when debug overlay is enabled", () => {
    const stateWithObjectives: GameState = {
      ...mockState,
      settings: { ...mockState.settings, debugOverlayEnabled: true },
      objectives: [
        {
          id: "o1",
          kind: "Kill",
          state: "Pending",
          targetCell: { x: 5, y: 5 },
          visible: true,
        },
      ],
    };

    hud.update(stateWithObjectives, null);

    const objectivesDiv = document.querySelector(".objectives-status");
    expect(objectivesDiv?.innerHTML).toContain("at (5,5)");
  });

  it("should add title attribute to the icon span", () => {
    const stateWithObjectives: GameState = {
      ...mockState,
      objectives: [
        {
          id: "o1",
          kind: "Kill",
          state: "Pending",
          visible: true,
        },
        {
          id: "o2",
          kind: "Recover",
          state: "Completed",
          visible: true,
        },
      ],
    };

    hud.update(stateWithObjectives, null);

    const objectivesDiv = document.querySelector(".objectives-status");
    const icons = objectivesDiv?.querySelectorAll(".obj-icon");
    expect(icons?.[0].getAttribute("title")).toBe("Pending");
    expect(icons?.[1].getAttribute("title")).toBe("Completed");
  });
});
