/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing main.ts
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" }
}));

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commandLog: [] }),
  forceWin: vi.fn(),
  forceLose: vi.fn(),
  loadReplay: vi.fn(),
};

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => mockGameClient),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    setCellSize: vi.fn(),
    setUnitStyle: vi.fn(),
    setOverlay: vi.fn(),
    getCellCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  })),
}));

vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
    }),
  },
}));

// Mock CampaignManager
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
let currentCampaignState: any = null;

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => currentCampaignState),
        load: vi.fn(),
        processMissionResult: vi.fn(),
        save: vi.fn(),
        startNewCampaign: vi.fn((seed, diff, pause, theme) => {
          currentCampaignState = {
            status: "Active",
            nodes: [{ id: "node-1", type: "Combat", status: "Accessible", difficulty: 1, mapSeed: 123, connections: [], position: { x: 0, y: 0 } }],
            roster: [
              { id: "s1", name: "Soldier 1", archetypeId: "scout", status: "Healthy", level: 1, hp: 100, maxHp: 100, xp: 0, soldierAim: 80, equipment: { rightHand: "pulse_rifle", leftHand: null, body: "basic_armor", feet: null } }
            ],
            scrap: 100,
            intel: 0,
            currentSector: 1,
            currentNodeId: null,
            history: [],
            unlockedArchetypes: ["scout", "heavy", "medic", "demolition"],
            rules: {
              allowTacticalPause: pause,
              themeId: theme,
              mode: "Preset",
              difficulty: diff,
              deathRule: "Simulation",
              mapGeneratorType: "DenseShip",
              difficultyScaling: 1,
              resourceScarcity: 1,
            },
          };
        }),
        reset: vi.fn(() => { currentCampaignState = null; }),
        deleteSave: vi.fn(() => { currentCampaignState = null; }),
        assignEquipment: vi.fn(),
      }),
    },
  };
});

describe("Equipment Persistence Integration", () => {
  beforeEach(async () => {
    currentCampaignState = null;
    vi.clearAllMocks();

    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
    }) as any;

    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
      </div>
      <div id="screen-campaign" class="screen" style="display:none"></div>
      <div id="screen-barracks" class="screen" style="display:none"></div>
      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="squad-builder"></div>
        <button id="btn-goto-equipment">Equipment</button>
      </div>
      <div id="screen-equipment" class="screen" style="display:none"></div>
      <div id="screen-mission" class="screen" style="display:none">
         <canvas id="game-canvas"></canvas>
      </div>
      <div id="screen-barracks" class="screen" style="display:none"></div>
      <div id="screen-mission" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
      <div id="screen-statistics" class="screen" style="display:none"></div>
    `;

    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();
    localStorage.clear();

    vi.resetModules();
    await import("@src/renderer/main");
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should call campaignManager.assignEquipment when equipment is saved in campaign mode", async () => {
    const manager = CampaignManager.getInstance();
    
    // 1. Start Campaign
    document.getElementById("btn-menu-campaign")?.click();
    const startBtn = document.querySelector(".campaign-setup-wizard .primary-button") as HTMLElement;
    startBtn.click();

    // 2. Select node and go to mission setup
    const nodeEl = document.querySelector(".campaign-node.accessible") as HTMLElement;
    nodeEl.click();
    
    // In mission setup, select the scout
    const scoutCb = document.querySelector("#squad-builder input[type='checkbox']") as HTMLInputElement;
    if (scoutCb && !scoutCb.checked) scoutCb.click();

    // 3. Go to Equipment Screen
    document.getElementById("btn-goto-equipment")?.click();
    expect(document.getElementById("screen-equipment")?.style.display).toBe("flex");

    // 4. Find the 'CONFIRM SQUAD' button and click it
    // Note: The EquipmentScreen renders its own UI.
    const confirmBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "CONFIRM SQUAD");
    expect(confirmBtn).toBeTruthy();
    
    confirmBtn?.click();

    // 5. Verify assignEquipment was called for soldier 's1'
    expect(manager.assignEquipment).toHaveBeenCalled();
    // It should be called with soldier ID 's1' and some equipment
    expect(manager.assignEquipment).toHaveBeenCalledWith("s1", expect.anything());
  });
});
