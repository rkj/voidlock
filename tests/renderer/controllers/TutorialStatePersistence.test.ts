/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TutorialManager } from "../../../src/renderer/controllers/TutorialManager";
import { setLocale } from "../../../src/renderer/i18n";
import { GameState, MissionType } from "../../../src/shared/types";

describe("Tutorial State Persistence Repro", () => {
  let gameClient: any;
  let onMessage: any;
  let manager: TutorialManager;

  beforeEach(() => {
    setLocale("en-corporate");
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
    const campaignManager = {
      getState: vi.fn().mockReturnValue({ history: [] }),
    };
    const menuController = {
      menuState: "ACTION_SELECT",
      pendingAction: null,
    };
    
    manager = new TutorialManager({
      gameClient: gameClient,
      campaignManager: campaignManager as any,
      menuController: menuController as any,
      onMessage: onMessage,
      getRenderer: () => null
    });
    
    // Clear localStorage
    localStorage.clear();
    
    // Setup basic DOM for highlights
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
    objectives: [
      { id: "obj-main", kind: "Recover", state: "Pending", visible: false } as any
    ],
    stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, scrapGained: 0, casualties: 0, prologueRescues: 0 },
    settings: { isPaused: false, timeScale: 1.0 } as any,
    commandLog: [],
  });

  it("should REPRODUCE resetting to step 0 after refresh", () => {
    const directiveText = () => document.getElementById("tutorial-directive-text")?.textContent;
    manager.enable();
    const state = createBaseState();
    const listener = gameClient.addStateUpdateListener.mock.calls[0][0];

    // 1. Enter Step 1: observe
    state.t = 16;
    listener(state);
    expect(directiveText()).toContain("ASSET DEPLOYMENT INITIALIZED");

    // 2. Complete Step 1: observe -> Move to Step 2: ui_tour
    state.units[0].pos = { x: 3, y: 1 }; // moved > 1.5 distance
    listener(state);
    expect(directiveText()).toContain("Tactical feed overview");

    // 3. Simulate "Refresh" (re-enable manager)
    manager.disable();
    
    // Create new manager instance (like a page load)
    const campaignManager = {
      getState: vi.fn().mockReturnValue({ history: [] }),
    };
    const menuController = {
      menuState: "ACTION_SELECT",
      pendingAction: null,
    };
    const newManager = new TutorialManager({
      gameClient: gameClient,
      campaignManager: campaignManager as any,
      menuController: menuController as any,
      onMessage: onMessage,
      getRenderer: () => null
    });
    
    newManager.enable();
    const newListener = gameClient.addStateUpdateListener.mock.calls[1][0];
    
    // 4. Send a state update
    state.t = 32;
    newListener(state);
    
    // FIX VERIFICATION: It should NOT revert to "ASSET DEPLOYMENT INITIALIZED"
    expect(directiveText()).not.toContain("ASSET DEPLOYMENT INITIALIZED");
    expect(directiveText()).toContain("Tactical feed overview");
  });
});
