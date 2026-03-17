/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TutorialManager } from "../../../src/renderer/controllers/TutorialManager";
import { GameState, MissionType } from "../../../src/shared/types";

describe("Tutorial State Persistence Repro", () => {
  let gameClient: any;
  let onMessage: any;
  let manager: TutorialManager;

  beforeEach(() => {
    gameClient = {
      addStateUpdateListener: vi.fn(),
      removeStateUpdateListener: vi.fn(),
    };
    onMessage = vi.fn().mockImplementation((msg, cb) => {
      if (cb) cb();
    });
    const campaignManager = {
      getState: vi.fn().mockReturnValue({ history: [] }),
    };
    const menuController = {
      menuState: "ACTION_SELECT",
      pendingAction: null,
    };
    manager = new TutorialManager(
      gameClient, 
      campaignManager as any, 
      menuController as any,
      onMessage, 
      () => null,
      {} as any
    );
    
    localStorage.clear();
    
    document.body.innerHTML = `
      <div id="screen-mission">
        <div id="tutorial-directive" class="tutorial-directive-container">
            <span id="tutorial-directive-text"></span>
        </div>
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
    objectives: [],
    stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, scrapGained: 0, casualties: 0, prologueRescues: 0 },
    settings: { isPaused: false, timeScale: 1.0 } as any,
    squadInventory: {},
    loot: [],
    mines: [],
    turrets: [],
  });

  it("should REPRODUCE resetting to step 0 after refresh", () => {
    manager.enable();
    const state = createBaseState();
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];
    const directiveText = () => document.getElementById("tutorial-directive-text")?.textContent;

    // 1. Advance to Step 1: observe
    state.t = 16;
    listener(state);
    expect(directiveText()).toContain("ASSET DEPLOYMENT INITIALIZED");

    // 2. Complete Step 1: observe -> Move to Step 2: ui_tour
    state.units[0].pos = { x: 3, y: 1 };
    listener(state);
    expect(directiveText()).toContain("Tactical feed overview");

    // 3. Complete Step 2: ui_tour -> Move to Step 3: pause
    state.t += 105;
    listener(state);
    expect(directiveText()).toContain("pause");

    // 4. SIMULATE REFRESH: Disable current manager, create new manager instance
    manager.disable();
    
    const newManager = new TutorialManager(
      gameClient,
      { getState: () => ({ history: [] }) } as any,
      { menuState: "ACTION_SELECT" } as any,
      onMessage,
      () => null,
      {} as any
    );
    newManager.enable();
    const newListener = gameClient.addStateUpdateListener.mock.calls[1][0];

    // 5. Send same state update
    newListener(state);

    // FIXED: It should still be on "pause" step
    expect(directiveText()).toContain("pause");
    expect(directiveText()).not.toContain("ASSET DEPLOYMENT INITIALIZED");
  });
});
