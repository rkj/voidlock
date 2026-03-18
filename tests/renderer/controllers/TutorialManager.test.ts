/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TutorialManager } from "@src/renderer/controllers/TutorialManager";
import { GameState, MissionType, EnemyType } from "@src/shared/types";

describe("TutorialManager", () => {
  let gameClient: any;
  let onMessage: any;
  let uiOrchestrator: any;
  let manager: TutorialManager;
  let selectedUnitId: string | null = null;

  beforeEach(() => {
    gameClient = {
      addStateUpdateListener: vi.fn(),
      removeStateUpdateListener: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      freezeForDialog: vi.fn(),
      unfreezeAfterDialog: vi.fn(),
    };
    onMessage = vi.fn().mockImplementation((msg, cb) => {
      if (cb) cb();
    });
    uiOrchestrator = {
      setMissionHUDVisible: vi.fn(),
    };
    const campaignManager = {
      getState: vi.fn().mockReturnValue({ history: [] }),
    };
    const menuController = {
      menuState: "ACTION_SELECT",
      pendingAction: null,
    };
    const renderer = {
      getPixelCoordinates: vi.fn().mockReturnValue({ x: 100, y: 100 }),
      cellSize: 20,
    };
    selectedUnitId = null;
    manager = new TutorialManager(
      gameClient, 
      campaignManager as any, 
      menuController as any,
      onMessage, 
      () => selectedUnitId,
      uiOrchestrator,
      () => renderer as any
    );
    
    // Clear localStorage to avoid state leakage between tests
    localStorage.clear();
  });

  const createBaseState = (): GameState => ({
    t: 0,
    seed: 123,
    missionType: MissionType.Prologue,
    status: "Playing",
    map: { width: 10, height: 10, cells: [] } as any,
    units: [{ id: "u1", pos: { x: 1, y: 1 }, hp: 10, maxHp: 10, engagementPolicy: "ENGAGE" } as any],
    enemies: [],
    visibleCells: ["1,1"],
    discoveredCells: ["1,1"],
    objectives: [
      { id: "obj-main", kind: "Recover", state: "Pending", visible: false, targetCell: { x: 5, y: 5 } } as any
    ],
    stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, scrapGained: 0, casualties: 0, prologueRescues: 0 },
    settings: { isPaused: false } as any,
    squadInventory: {},
    loot: [],
    mines: [],
    turrets: [],
  });

  it("should NOT hide HUD at the start of the prologue", () => {
    manager.enable();
    const state = createBaseState();
    state.t = 16;
    // Trigger update
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
    listener(state);
    
    expect(uiOrchestrator.setMissionHUDVisible).not.toHaveBeenCalled();
  });

  it("should show start message on observe step", () => {
    manager.enable();
    const state = createBaseState();
    state.t = 16;
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
    listener(state); // Enters 'observe'
    
    // expect(gameClient.pause).toHaveBeenCalled(); // Responsibility moved to AdvisorOverlay
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "start" }), expect.any(Function));
  });

  it("should highlight elements", () => {
    const div = document.createElement("div");
    div.id = "test-el";
    document.body.appendChild(div);

    manager.highlightElement("#test-el");
    expect(div.classList.contains("tutorial-highlight")).toBe(true);

    manager.clearHighlight();
    expect(div.classList.contains("tutorial-highlight")).toBe(false);
  });

  it("should highlight cells", () => {
    const mockRenderer = {
      getPixelCoordinates: vi.fn().mockReturnValue({ x: 100, y: 100 }),
      cellSize: 40,
      getCellCoordinates: vi.fn(),
    };
    
    const campaignManager = {
      getState: vi.fn().mockReturnValue({ history: [] }),
    };
    
    document.querySelectorAll(".tutorial-cell-highlight").forEach(el => el.remove());
    
    const menuController = {
      menuState: "ACTION_SELECT",
      pendingAction: null,
    };
    
    manager = new TutorialManager(
      gameClient,
      campaignManager as any,
      menuController as any,
      onMessage,
      () => selectedUnitId,
      uiOrchestrator,
      () => mockRenderer as any
    );

    manager.highlightCell(5, 5);
    const highlightEl = document.querySelector(".tutorial-cell-highlight") as HTMLElement;
    expect(highlightEl).toBeTruthy();
    expect(highlightEl.style.display).toBe("block");
    expect(highlightEl.style.left).toBe("100px");
    expect(highlightEl.style.top).toBe("100px");

    manager.clearHighlight();
    expect(highlightEl.style.display).toBe("none");
  });

  it("should show combat message when entering combat step", () => {
    manager.enable();
    const state = createBaseState();
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];

    // observe
    listener(state);
    // complete observe
    state.units[0].pos = { x: 3, y: 1 };
    listener(state); // enters ui_tour
    // complete ui_tour
    state.t += 105;
    listener(state); // enters pause
    // complete pause
    state.settings.isPaused = true;
    listener(state); // enters doors
    // complete doors
    state.map.doors = [{ id: "door-1", segment: [{ x: 2, y: 3 }], state: "Open" } as any];
    listener(state); // enters combat
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "enemy_sighted" }), expect.any(Function));
  });

  it("should show objectives message when entering move step", () => {
    manager.enable();
    const state = createBaseState();
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];

    listener(state); // observe
    state.units[0].pos = { x: 3, y: 1 };
    listener(state); // ui_tour
    state.t += 105;
    listener(state); // pause
    state.settings.isPaused = true;
    listener(state); // doors
    state.map.doors = [{ id: "door-1", segment: [{ x: 2, y: 3 }], state: "Open" } as any];
    listener(state); // combat
    state.enemies = [{ id: "e1", pos: { x: 5, y: 5 }, hp: 5, maxHp: 10, type: EnemyType.Tutorial } as any];
    listener(state); // engagement_ignore
    state.units[0].engagementPolicy = "IGNORE";
    listener(state); // engagement_engage
    state.units[0].engagementPolicy = "ENGAGE";
    state.stats.aliensKilled = 1;
    listener(state); // move
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "objective_sighted" }), expect.any(Function));
  });

  it("should show extraction message when entering extract step", () => {
    manager.enable();
    const state = createBaseState();
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];

    listener(state); // observe
    state.units[0].pos = { x: 3, y: 1 };
    listener(state); // ui_tour
    state.t += 105;
    listener(state); // pause
    state.settings.isPaused = true;
    listener(state); // doors
    state.map.doors = [{ id: "door-1", segment: [{ x: 2, y: 3 }], state: "Open" } as any];
    listener(state); // combat
    state.enemies = [{ id: "e1", pos: { x: 5, y: 5 }, hp: 5, maxHp: 10, type: EnemyType.Tutorial } as any];
    listener(state); // engagement_ignore
    state.units[0].engagementPolicy = "IGNORE";
    listener(state); // engagement_engage
    state.units[0].engagementPolicy = "ENGAGE";
    state.stats.aliensKilled = 1;
    listener(state); // move
    state.units[0].pos = { x: 5, y: 5 };
    listener(state); // pickup
    state.objectives[0].state = "Completed";
    listener(state); // extract
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "objective_completed" }), expect.any(Function));
  });
});
