// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, UnitState, MissionType } from "@src/shared/types";

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
    settings: {
      mode: "Simulation" as any,
      debugOverlayEnabled: false,
      debugSnapshots: false,
      losOverlayEnabled: false,
      timeScale: 1.0,
      isPaused: false,
      isSlowMotion: false,
      allowTacticalPause: true,
    },
    squadInventory: {},
    stats: {
      threatLevel: 25,
      aliensKilled: 0,
      elitesKilled: 0,
      casualties: 0,
      scrapGained: 0,
    },
    map: { width: 10, height: 10, cells: [] },
    units: [
      {
        id: "s1",
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        stats: {
          accuracy: 80,
          damage: 10,
          attackRange: 10,
          speed: 20,
          soldierAim: 80,
          equipmentAccuracyBonus: 0,
          fireRate: 500,
        },
        engagementPolicy: "ENGAGE",
      } as any,
    ],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    loot: [],
    mines: [],
    turrets: [],
    objectives: [],
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="game-status"></div>
      <div id="version-display"></div>
      <div id="menu-version"></div>
      <div id="top-threat-fill"></div>
      <div id="top-threat-value"></div>
      <div id="right-panel"></div>
      <div id="soldier-list"></div>
    `;

    mockMenuController = {
      getRenderableState: vi.fn(() => ({
        title: "Actions",
        options: [],
      })),
    };
    onUnitClick = vi.fn();
    onAbortMission = vi.fn();
    onMenuInput = vi.fn();
    onCopyWorldState = vi.fn();
    onForceWin = vi.fn();
    onForceLose = vi.fn();

    hud = new HUDManager(
      mockMenuController,
      onUnitClick,
      onAbortMission,
      onMenuInput,
      vi.fn(), // onSetTimeScale
      onCopyWorldState,
      onForceWin,
      onForceLose,
      vi.fn(), // onStartMission
      vi.fn(), // onDeployUnit
    );
  });

  it("should update top bar stats", () => {
    hud.update(mockState, null);

    const statusEl = document.getElementById("game-status");
    expect(statusEl?.innerHTML).toContain("TIME</span>");
    expect(statusEl?.innerHTML).toContain("1.0</span>s");
    expect(statusEl?.innerHTML).not.toContain("STATUS:");

    const threatValue = document.getElementById("top-threat-value");
    expect(threatValue?.textContent).toBe("25%");
  });

  it("should render soldier list", () => {
    hud.update(mockState, null);

    const list = document.getElementById("soldier-list");
    const items = list?.querySelectorAll(".soldier-item");
    expect(items?.length).toBe(1);
    expect(items?.[0].querySelector(".u-id")?.textContent).toBe("S1");
    expect(items?.[0].querySelector(".u-hp")?.textContent).toBe("100/100");
  });

  it("should update HP bar and stats", () => {
    const woundedState = {
      ...mockState,
      units: [{ ...mockState.units[0], hp: 50 }],
    };

    hud.update(woundedState, null);

    const hpText = document.querySelector(".u-hp");
    expect(hpText?.textContent).toBe("50/100");

    const hpFill = document.querySelector(".hp-fill") as HTMLElement;
    expect(hpFill.style.width).toBe("50%");
  });

  it("should highlight selected unit", () => {
    hud.update(mockState, "s1");

    const item = document.querySelector(".soldier-item");
    expect(item?.classList.contains("selected")).toBe(true);
  });

  it("should display burden icon when unit is carrying an objective", () => {
    const burdenedState = {
      ...mockState,
      units: [{ ...mockState.units[0], carriedObjectiveId: "artifact-0" }],
    };

    hud.update(burdenedState, null);

    const burdenEl = document.querySelector(".u-burden");
    expect(burdenEl?.textContent).toContain("📦");
  });

  it("should call onUnitClick when a soldier item is clicked", () => {
    hud.update(mockState, null);

    const item = document.querySelector(".soldier-item") as HTMLElement;
    item.click();

    expect(onUnitClick).toHaveBeenCalledWith(mockState.units[0], false);
  });

  it("should call onMenuInput when a menu item is clicked", () => {
    mockMenuController.getRenderableState.mockReturnValue({
      title: "Actions",
      options: [{ key: "1", label: "1. Move", dataAttributes: { index: "1" } }],
    });

    hud.update(mockState, null);

    const menuItem = document.querySelector(
      ".menu-item.clickable",
    ) as HTMLElement;
    expect(menuItem).not.toBeNull();

    menuItem.click();
    expect(onMenuInput).toHaveBeenCalledWith("1", false);
  });

  it("should render objectives in the right panel", () => {
    const stateWithObjectives: GameState = {
      ...mockState,
      objectives: [
        { id: "o1", kind: "Kill", state: "Pending", visible: true },
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
    expect(objectivesDiv?.innerHTML).toContain("Kill");
    expect(objectivesDiv?.innerHTML).not.toContain("(Pending)");
    expect(objectivesDiv?.innerHTML).toContain("Recover");
    expect(objectivesDiv?.innerHTML).not.toContain("(Completed)");
    expect(objectivesDiv?.innerHTML).not.toContain("at (5,5)");

    const icons = objectivesDiv?.querySelectorAll(".obj-icon");
    expect(icons?.[0].getAttribute("title")).toBe("Pending");
    expect(icons?.[1].getAttribute("title")).toBe("Completed");
  });

  it("should render debug tools when debug overlay is enabled", () => {
    const debugState: GameState = {
      ...mockState,
      settings: { ...mockState.settings, debugOverlayEnabled: true },
    };

    hud.update(debugState, null);

    const debugDiv = document.querySelector(".debug-controls");
    expect(debugDiv).not.toBeNull();
    expect(debugDiv?.innerHTML).toContain("Debug Tools");
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
    expect(debugDiv?.innerHTML).toContain("Mission:</strong> Default");
  });

  it("should call onCopyWorldState when the copy button is clicked", () => {
    const debugState: GameState = {
      ...mockState,
      settings: { ...mockState.settings, debugOverlayEnabled: true },
    };

    hud.update(debugState, null);

    const btn = document.getElementById("btn-copy-world-state");
    btn?.click();

    expect(onCopyWorldState).toHaveBeenCalled();
  });

  it("should call onForceWin and onForceLose when the respective buttons are clicked", () => {
    const debugState: GameState = {
      ...mockState,
      settings: { ...mockState.settings, debugOverlayEnabled: true },
    };

    hud.update(debugState, null);

    const winBtn = document.getElementById("btn-force-win");
    winBtn?.click();
    expect(onForceWin).toHaveBeenCalled();

    const loseBtn = document.getElementById("btn-force-lose");
    loseBtn?.click();
    expect(onForceLose).toHaveBeenCalled();
  });

  it("should render objectives in game over summary", () => {
    const gameOverState: GameState = {
      ...mockState,
      status: "Won",
      objectives: [{ id: "o1", kind: "Recover", state: "Completed" }],
    };

    hud.update(gameOverState, null);

    const summary = document.querySelector(".game-over-summary");
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain("MISSION ACCOMPLISHED");
    expect(summary?.innerHTML).toContain("Recover");
    expect(summary?.innerHTML).toContain("✔");
  });
});
