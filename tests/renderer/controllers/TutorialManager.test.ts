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
    manager = new TutorialManager(gameClient, campaignManager as any, onMessage, uiOrchestrator);
    
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
    // Pre-seed prerequisites
    localStorage.setItem("voidlock_tutorial_state", JSON.stringify(["start", "first_move", "enemy_sighted"]));
    manager.enable();
    
    const state = createBaseState();
    state.t = 200;
    state.objectives[0].visible = true;
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
    listener(state);
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "objective_sighted" }));
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
    (manager as any).getRenderer = vi.fn().mockReturnValue(mockRenderer);

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
    // Pre-seed prerequisites
    localStorage.setItem("voidlock_tutorial_state", JSON.stringify(["start", "first_move"]));
    manager.enable();
    
    const state = createBaseState();
    state.t = 200;
    state.enemies = [{ id: "e1", pos: { x: 2, y: 2 }, hp: 10 } as any];
    state.visibleCells.push("2,2");
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
    listener(state);
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "enemy_sighted" }));
  });

  it("should show extraction message when main objective is completed", () => {
    // Pre-seed prerequisites
    localStorage.setItem("voidlock_tutorial_state", JSON.stringify(["start", "first_move", "enemy_sighted", "objective_sighted"]));
    manager.enable();
    
    const state = createBaseState();
    state.t = 200;
    state.objectives[0].state = "Completed";
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
    listener(state);
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "objective_completed" }));
  });
});
