/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TutorialManager } from "../../../src/renderer/controllers/TutorialManager";
import { GameState, MissionType } from "../../../src/shared/types";

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
    };
    onMessage = vi.fn();
    uiOrchestrator = {
      setMissionHUDVisible: vi.fn(),
    };
    const campaignManager = {
      getState: vi.fn().mockReturnValue({ history: [] }),
    };
    selectedUnitId = null;
    manager = new TutorialManager(
      gameClient, 
      campaignManager as any, 
      onMessage, 
      () => selectedUnitId,
      uiOrchestrator
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
    units: [{ id: "u1", pos: { x: 1, y: 1 }, hp: 10, maxHp: 10 } as any],
    enemies: [],
    visibleCells: ["1,1"],
    discoveredCells: ["1,1"],
    objectives: [
      { id: "obj-main", kind: "Recover", state: "Pending", visible: false } as any
    ],
    stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, scrapGained: 0, casualties: 0 },
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

  it("should show start message at t > 100", () => {
    manager.enable();
    const state = createBaseState();
    state.t = 112;
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
    listener(state);
    
    expect(gameClient.pause).toHaveBeenCalled();
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "start" }));
  });

  it("should show objectives message when objective is visible", () => {
    manager.enable();
    const state = createBaseState();
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];

    // Initial state (Step 0: select_unit)
    listener(state);
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "start" }));
    onMessage.mockClear();

    // Advance to Step 1: move
    selectedUnitId = "u1";
    listener(state);
    
    // Advance to Step 2: door
    state.units[0].pos = { x: 2, y: 2 };
    listener(state);

    // Advance to Step 3: combat_intro
    state.map.doors = [{ id: "door-1", segment: [{ x: 2, y: 3 }], state: "Open" } as any];
    listener(state);

    // Advance to Step 4: survive_combat
    state.enemies = [{ id: "e1", pos: { x: 5, y: 5 }, hp: 10, maxHp: 10 } as any];
    state.visibleCells.push("5,5");
    listener(state);
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "enemy_sighted" }));
    onMessage.mockClear();

    // Advance to Step 5: objective
    state.stats.aliensKilled = 1;
    listener(state);

    // Trigger objective visible - wait, step 5 (objective) message triggers on ENTER
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "objective_sighted" }));
  });

  it("should highlight elements", () => {
    const div = document.createElement("div");
    div.id = "test-el";
    document.body.appendChild(div);

    manager.highlightElement("#test-el");
    // highlightElement is async/delayed, but in JSDOM we might need to wait or it might be instant if el exists
    // The current implementation has a retry loop.
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
    
    // We recreate the manager here with the mock renderer to ensure it's used correctly
    const campaignManager = {
      getState: vi.fn().mockReturnValue({ history: [] }),
    };
    
    // Clean up any existing highlight elements from document.body to avoid confusion
    document.querySelectorAll(".tutorial-cell-highlight").forEach(el => el.remove());
    
    manager = new TutorialManager(
      gameClient,
      campaignManager as any,
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

  it("should show combat message when an enemy is visible", () => {
    manager.enable();
    const state = createBaseState();
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];

    // Step 0 -> Step 1
    selectedUnitId = "u1";
    listener(state);
    
    // Step 1 -> Step 2
    state.units[0].pos = { x: 2, y: 2 };
    listener(state);

    // Step 2 -> Step 3
    state.map.doors = [{ id: "door-1", segment: [{ x: 2, y: 3 }], state: "Open" } as any];
    listener(state);
    
    // Trigger Step 3 enter (combat_intro)
    state.enemies = [{ id: "e1", pos: { x: 2, y: 2 }, hp: 10 } as any];
    state.visibleCells.push("2,2");
    listener(state);
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "enemy_sighted" }));
  });

  it("should show extraction message when main objective is completed", () => {
    manager.enable();
    const state = createBaseState();
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];

    // Rapid advance steps
    selectedUnitId = "u1";
    listener(state);
    state.units[0].pos = { x: 2, y: 2 };
    listener(state);
    state.map.doors = [{ id: "door-1", segment: [{ x: 2, y: 3 }], state: "Open" } as any];
    listener(state);
    state.enemies = [{ id: "e1", pos: { x: 5, y: 5 }, hp: 10 } as any];
    state.visibleCells.push("5,5");
    listener(state);
    state.stats.aliensKilled = 1;
    listener(state);
    
    // Enter Step 6 (extract)
    state.objectives[0].state = "Completed";
    listener(state);
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "objective_completed" }));
  });
});
