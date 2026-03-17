/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TutorialManager } from "../../../src/renderer/controllers/TutorialManager";
import { GameState, MissionType, CommandType, UnitState, EnemyType } from "../../../src/shared/types";

import { Director } from "../../../src/engine/Director";
import { PRNG } from "../../../src/shared/PRNG";
import { ItemEffectService } from "../../../src/engine/managers/ItemEffectService";

describe("Tutorial Redesign Regression Suite (ADR 0058)", () => {
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
    selectedUnitId = null;
    manager = new TutorialManager(
      gameClient, 
      campaignManager as any, 
      menuController as any,
      onMessage, 
      () => selectedUnitId,
      uiOrchestrator
    );
    
    // Clear localStorage
    localStorage.clear();
    
    // Setup basic DOM for highlights
    document.body.innerHTML = `
      <div id="screen-mission">
        <div id="top-bar"></div>
        <div id="tutorial-directive" class="tutorial-directive-container">
            <span id="tutorial-directive-text"></span>
        </div>
        <div id="soldier-panel">
            <div class="soldier-card" data-unit-id="u1"></div>
        </div>
        <div id="mission-body">
            <div id="right-panel"></div>
        </div>
        <div id="mobile-action-panel"></div>
        <canvas id="game-canvas" width="800" height="600"></canvas>
      </div>
    `;
  });

  const createBaseState = (): GameState => ({
    t: 0,
    seed: 123,
    missionType: MissionType.Prologue,
    status: "Playing",
    map: { width: 10, height: 10, cells: [] } as any,
    units: [{ id: "u1", pos: { x: 1, y: 1 }, hp: 100, maxHp: 100, engagementPolicy: "ENGAGE" } as any],
    enemies: [],
    visibleCells: ["1,1"],
    discoveredCells: ["1,1"],
    objectives: [
      { id: "obj-main", kind: "Recover", state: "Pending", visible: false } as any
    ],
    stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, scrapGained: 0, casualties: 0, prologueRescues: 0 },
    settings: { isPaused: false, timeScale: 1.0 } as any,
    squadInventory: {},
    loot: [],
    mines: [],
    turrets: [],
  });

  describe("1) HUD Visibility", () => {
    it("should ensure HUD elements are visible at prologue start", () => {
      manager.enable();
      const state = createBaseState();
      state.t = 16;
      
      const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
      listener(state);
      
      // HUD should NOT be hidden
      expect(uiOrchestrator.setMissionHUDVisible).not.toHaveBeenCalledWith(false);
      
      const topBar = document.getElementById("top-bar");
      const soldierPanel = document.getElementById("soldier-panel");
      const rightPanel = document.getElementById("right-panel");
      
      expect(topBar?.style.display).not.toBe("none");
      expect(soldierPanel?.style.display).not.toBe("none");
      expect(rightPanel?.style.display).not.toBe("none");
    });
  });

  describe("2) Sequential Step Advancement (Observe-then-Command)", () => {
    it("should advance through the 9 steps in sequence", () => {
      manager.enable();
      const state = createBaseState();
      const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
      const directiveText = () => document.getElementById("tutorial-directive-text")?.textContent;

      // Step 1: observe
      state.t = 16;
      listener(state);
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "start" }), expect.any(Function));
      expect(directiveText()).toContain("ASSET DEPLOYMENT INITIALIZED");
      onMessage.mockClear();
      
      // Complete Step 1: observe
      state.units[0].pos = { x: 3, y: 1 }; // moved > 1.5 distance
      listener(state);
      
      // Step 2: ui_tour
      expect(directiveText()).toContain("Tactical feed overview");
      expect(onMessage).not.toHaveBeenCalled();
      
      // Complete Step 2: ui_tour (5 seconds pass)
      state.t += 105; 
      listener(state);
      
      // Step 3: pause
      expect(directiveText()).toContain("pause");
      
      // Complete Step 3: pause
      state.settings.isPaused = true;
      listener(state);

      // Step 4: doors
      expect(directiveText()).toContain("Structural boundaries");
      
      // Complete Step 4: doors
      state.map.doors = [{ id: "door-1", segment: [{ x: 2, y: 3 }], state: "Open" } as any];
      listener(state);
      
      // Step 5: combat
      expect(directiveText()).toContain("HOSTILE CONTACT");
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "enemy_sighted" }), expect.any(Function));
      onMessage.mockClear();
      
      // Complete Step 5: combat (enemy takes damage)
      state.enemies = [{ id: "e1", pos: { x: 5, y: 5 }, hp: 5, maxHp: 10, type: EnemyType.Tutorial } as any];
      state.visibleCells.push("5,5");
      listener(state);
      
      // Step 6: engagement_ignore
      expect(directiveText()).toContain("Test Remote Intervention");
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "first_command" }), expect.any(Function));
      onMessage.mockClear();
      
      // Complete Step 6: engagement_ignore
      state.units[0].engagementPolicy = "IGNORE";
      listener(state);
      
      // Step 7: engagement_engage
      expect(directiveText()).toContain("Weapon lockout active");
      
      // Complete Step 7: engagement_engage
      state.units[0].engagementPolicy = "ENGAGE";
      state.enemies = []; // enemy died
      state.stats.aliensKilled = 1;
      listener(state);
      
      // Step 8: move
      expect(directiveText()).toContain("Redirect asset to recovery target");
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "objective_sighted" }), expect.any(Function));
      onMessage.mockClear();
      
      // Complete Step 8: move (reach objective room)
      state.objectives[0].targetCell = { x: 5, y: 5 };
      state.units[0].pos = { x: 5, y: 4 }; // Close to objective
      listener(state);
      
      // Step 9: pickup
      expect(directiveText()).toContain("Initiate collection");
      
      // Complete Step 9: pickup
      state.objectives[0].state = "Completed";
      state.status = "Won";
      listener(state);
      
      // Step 10: extract
      expect(directiveText()).toContain("Operation successful");
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "objective_completed" }), expect.any(Function));
      onMessage.mockClear();
      
      // Complete Step 9: extract (Won)
      state.status = "Won";
      listener(state);
      
      // Done - directive should be cleared
      expect(document.getElementById("tutorial-directive")?.classList.contains("active")).toBe(false);
    });
  });

  describe("3) Input Gating", () => {
    it("should restrict allowed actions per step", () => {
      manager.enable();
      const state = createBaseState();
      const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
      
      // Step 1: observe
      listener(state);
      expect(manager.isActionAllowed("SELECT_UNIT")).toBe(false);
      expect(manager.isActionAllowed("MOVE_TO")).toBe(false);
      
      // Advance to step 2: ui_tour
      state.units[0].pos = { x: 3, y: 1 };
      listener(state);
      expect(manager.isActionAllowed("MOVE_TO")).toBe(false);

      // Advance to step 3: pause
      state.t += 105;
      listener(state);
      expect(manager.isActionAllowed("TOGGLE_PAUSE")).toBe(true);

      // Advance to step 4: doors
      state.settings.isPaused = true;
      listener(state);
      expect(manager.isActionAllowed("MOVE_TO")).toBe(false);

      // Advance to step 5: combat
      state.map.doors = [{ id: "door-1", segment: [{ x: 2, y: 3 }], state: "Open" } as any];
      listener(state);
      expect(manager.isActionAllowed("SET_ENGAGEMENT")).toBe(false);

      // Advance to step 6: engagement_ignore
      state.enemies = [{ id: "e1", pos: { x: 5, y: 5 }, hp: 5, maxHp: 10, type: EnemyType.Tutorial } as any];
      listener(state);
      expect(manager.isActionAllowed("SET_ENGAGEMENT")).toBe(true);
      expect(manager.isActionAllowed("MOVE_TO")).toBe(false);

      // Advance to step 6: engagement_engage
      state.units[0].engagementPolicy = "IGNORE";
      listener(state);
      expect(manager.isActionAllowed("SET_ENGAGEMENT")).toBe(true);

      // Advance to step 7: move
      state.units[0].engagementPolicy = "ENGAGE";
      state.stats.aliensKilled = 1;
      listener(state);
      expect(manager.isActionAllowed("MOVE_TO")).toBe(true);
      expect(manager.isActionAllowed("PICKUP")).toBe(false);
      
      // Advance to step 8: pickup
      state.objectives[0].targetCell = { x: 5, y: 5 };
      state.units[0].pos = { x: 5, y: 4 };
      listener(state);
      expect(manager.isActionAllowed("PICKUP")).toBe(true);
      
      // Advance to step 9: extract
      state.objectives[0].state = "Completed";
      listener(state);
      expect(manager.isActionAllowed("EXTRACT")).toBe(true);
    });
  });

  describe("4) Director Suppression", () => {
    it("should suppress spawning in prologue", () => {
        const onSpawn = vi.fn();
        const director = new Director(
            [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
            new PRNG(123),
            onSpawn,
            new ItemEffectService(),
            0,
            { width: 10, height: 10, cells: [] },
            0,
            MissionType.Prologue
        );

        director.preSpawn();
        expect(onSpawn).toHaveBeenCalled();
        const spawnedEnemy = onSpawn.mock.calls[0][0];
        expect(spawnedEnemy.id).toBe("tutorial-enemy");

        onSpawn.mockClear();
        director.update(100000);
        expect(onSpawn).not.toHaveBeenCalled();
    });
  });

  describe("5) Scripted Rescue", () => {
    it("should trigger rescue message when soldier HP drops", () => {
      manager.enable();
      const state = createBaseState();
      const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
      
      listener(state);
      state.stats.prologueRescues = 1;
      listener(state);
      
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
        id: "prologue_rescue_1",
        text: expect.stringContaining("Asset integrity stabilized"),
      }));
    });
  });

  describe("7) Highlight System", () => {
    it("should highlight specified elements", () => {
      manager.highlightElement(".soldier-card");
      const el = document.querySelector(".soldier-card");
      expect(el?.classList.contains("tutorial-highlight")).toBe(true);
      
      manager.clearHighlight();
      expect(el?.classList.contains("tutorial-highlight")).toBe(false);
    });

    it("should highlight specified cells", () => {
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
      
      manager.clearHighlight();
      expect(highlightEl.style.display).toBe("none");
    });
  });
});
