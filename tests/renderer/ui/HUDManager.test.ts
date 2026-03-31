// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, UnitState, MissionType, AIProfile } from "@src/shared/types";
import { t, setLocale } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

describe("HUDManager", () => {
  let hud: HUDManager;
  let mockMenuController: any;
  let onUnitClick: any;
  let onAbortMission: any;
  let onMenuInput: any;
  let onCopyWorldState: any;
  let onForceWin: any;
  let onForceLose: any;

  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    status: "Playing",
    units: [
      {
        id: "u1",
        name: "Unit 1",
        archetypeId: "assault",
        pos: { x: 1, y: 1 },
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        isDeployed: true,
        equipment: {},
        kills: 0,
        accuracy: 70,
        speed: 1.0,
        xp: 0,
        stats: {
          damage: 20,
          fireRate: 600,
          accuracy: 95,
          soldierAim: 90,
          attackRange: 10,
          speed: 20,
          equipmentAccuracyBonus: 0,
        },
        aiProfile: AIProfile.RUSH,
        commandQueue: [],
        positionHistory: [],
        innateMaxHp: 100,
        damageDealt: 0,
        objectivesCompleted: 0,
      },
    ],
    enemies: [],
    visibleCells: ["1,1"],
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
      getRenderableState: vi.fn().mockReturnValue({
        title: "Test Menu",
        options: [],
      }),
    };
    onUnitClick = vi.fn();
    onAbortMission = vi.fn();
    onMenuInput = vi.fn();
    onCopyWorldState = vi.fn();
    onForceWin = vi.fn();
    onForceLose = vi.fn();

    hud = new HUDManager({
      menuController: mockMenuController,
      tutorialManager: null,
      onUnitClick,
      onAbortMission,
      onMenuInput,
      onCopyWorldState,
      onForceWin,
      onForceLose,
      onStartMission: vi.fn(),
      onDeployUnit: vi.fn(),
    });
  });

  it("should initialize the HUD structure", () => {
    expect(document.getElementById("top-bar")).not.toBeNull();
    expect(document.getElementById("soldier-panel")).not.toBeNull();
    expect(document.getElementById("right-panel")).not.toBeNull();
  });

  it("should update the top bar with time and threat", () => {
    hud.update(mockState, null);
    
    const timeSpan = document.querySelector(".time-value");
    expect(timeSpan?.textContent).toBe("1.0");

    const threatValue = document.getElementById("top-threat-value");
    expect(threatValue?.textContent).toBe("0%");
  });

  it("should show/hide the threat meter based on status", () => {
    const deploymentState: GameState = {
      ...mockState,
      status: "Deployment",
    };

    hud.update(deploymentState, null);
    const threatContainer = document.getElementById("top-threat-container");
    expect(threatContainer?.style.display).toBe("none");

    hud.update(mockState, null);
    expect(threatContainer?.style.display).not.toBe("none");
  });

  it("should toggle the pause button text", () => {
    const pausedState: GameState = {
      ...mockState,
      settings: { ...mockState.settings, isPaused: true },
    };

    hud.update(pausedState, null);
    const pauseBtn = document.getElementById("btn-pause-toggle");
    expect(pauseBtn?.textContent).toContain(t(I18nKeys.hud.resume).replace("> ", ""));

    hud.update(mockState, null);
    expect(pauseBtn?.textContent).toContain(t(I18nKeys.hud.pause).replace("|| ", ""));
  });

  it("should handle the abort button click", () => {
    hud.update(mockState, null);
    const abortBtn = document.getElementById("btn-give-up");
    abortBtn?.click();
    expect(onAbortMission).toHaveBeenCalled();
  });

  it("should render soldier cards in the soldier panel", () => {
    hud.update(mockState, "u1");
    const soldierList = document.getElementById("soldier-list");
    expect(soldierList?.children.length).toBe(1);
    
    const card = soldierList?.querySelector(".soldier-item");
    expect(card).not.toBeNull();
    expect(card?.classList.contains("selected")).toBe(true);
  });

  it("should render objectives in the right panel", () => {
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
          targetCell: { x: 5, y: 5 },
          visible: true,
        },
      ],
    };

    hud.update(stateWithObjectives, null);

    const objectivesDiv = document.querySelector(".objectives-status");
    expect(objectivesDiv).not.toBeNull();
    expect(objectivesDiv?.innerHTML).toContain(t(I18nKeys.mission.type.kill));
    expect(objectivesDiv?.innerHTML).not.toContain("(Pending)");
    expect(objectivesDiv?.innerHTML).toContain(t(I18nKeys.mission.type.recover));
    expect(objectivesDiv?.innerHTML).not.toContain("(Completed)");
    expect(objectivesDiv?.innerHTML).not.toContain("at (5,5)");

    const icons = objectivesDiv?.querySelectorAll(".obj-icon");
    expect(icons?.[0].getAttribute("title")).toBe(t(I18nKeys.hud.objective_pending));
    expect(icons?.[1].getAttribute("title")).toBe(t(I18nKeys.hud.objective_completed));
  });

  it("should render debug tools when debug overlay is enabled", () => {
    const debugState: GameState = {
      ...mockState,
      settings: { ...mockState.settings, debugOverlayEnabled: true },
    };

    hud.update(debugState, null);

    const debugDiv = document.querySelector(".debug-controls");
    expect(debugDiv).not.toBeNull();
    expect(debugDiv?.innerHTML).toContain(t(I18nKeys.hud.debug.title));
    expect(debugDiv?.querySelector("#btn-copy-world-state")).not.toBeNull();
    expect(debugDiv?.querySelector("#btn-force-win")).not.toBeNull();
    expect(debugDiv?.querySelector("#btn-force-lose")).not.toBeNull();
  });

  it("should display generator name and seed in the correct format", () => {
    const debugState: GameState = {
      ...mockState,
      seed: 9999,
      map: { ...mockState.map, generatorName: "TreeShip" },
      settings: { ...mockState.settings, debugOverlayEnabled: true },
    };

    hud.update(debugState, null);

    const debugDiv = document.querySelector(".debug-controls");
    // "TreeShip" should be displayed as "TreeShipGenerator"
    expect(debugDiv?.innerHTML).toContain("TreeShipGenerator (9999)");
    expect(debugDiv?.innerHTML).toContain(`${t(I18nKeys.hud.debug.mission)}</strong> ${t(I18nKeys.mission.type.default)}`);
  });

  it("should call onCopyWorldState when the copy button is clicked", () => {
    const debugState: GameState = {
      ...mockState,
      settings: { ...mockState.settings, debugOverlayEnabled: true },
    };

    hud.update(debugState, null);
    const copyBtn = document.getElementById("btn-copy-world-state");
    copyBtn?.click();
    expect(onCopyWorldState).toHaveBeenCalled();
  });

  it("should call onForceWin/onForceLose when buttons are clicked", () => {
    const debugState: GameState = {
      ...mockState,
      settings: { ...mockState.settings, debugOverlayEnabled: true },
    };

    hud.update(debugState, null);
    document.getElementById("btn-force-win")?.click();
    expect(onForceWin).toHaveBeenCalled();

    document.getElementById("btn-force-lose")?.click();
    expect(onForceLose).toHaveBeenCalled();
  });
});
