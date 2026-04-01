/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { MissionType, UnitState, GameState, MapGeneratorType } from "@src/shared/types";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
  init: vi.fn(), 
  pause: vi.fn(), 
  resume: vi.fn(),
  queryState: vi.fn(),
  onStateUpdate: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  getTimeScale: vi.fn().mockReturnValue(1.0),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commands: [] }),
  forceWin: vi.fn(),
  forceLose: vi.fn(),
  loadReplay: vi.fn(),
  applyCommand: vi.fn(),
  seek: vi.fn(),
  getFullState: vi.fn(),
  setTickRate: vi.fn(),
};

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => mockGameClient),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    destroy: vi.fn(),
    setCellSize: vi.fn(),
    setUnitStyle: vi.fn(),
    setOverlay: vi.fn(),
    getCellCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    getWorldCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  })),
}));

vi.mock("@src/renderer/ThemeManager", () => {
  const mockInstance = {
    init: vi.fn().mockResolvedValue(undefined),
    setTheme: vi.fn(),
    getAssetUrl: vi.fn().mockReturnValue("mock-url"),
    getColor: vi.fn().mockReturnValue("#000"),
    getIconUrl: vi.fn().mockReturnValue("mock-icon-url"),
    getCurrentThemeId: vi.fn().mockReturnValue("default"),
    applyTheme: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return {
    ThemeManager: mockConstructor,
  };
});

vi.mock("@src/renderer/controllers/TutorialManager", () => ({
  TutorialManager: vi.fn().mockImplementation(() => ({
    enable: vi.fn(),
    disable: vi.fn(),
    reset: vi.fn(),
    triggerEvent: vi.fn(),
    onScreenShow: vi.fn(),
    isProloguePassiveStep: vi.fn().mockReturnValue(false),
  })),
}));

vi.mock("@src/renderer/ui/AdvisorOverlay", () => ({
  AdvisorOverlay: vi.fn().mockImplementation(() => ({
    showMessage: vi.fn().mockImplementation((msg, onDismiss) => {
      if (onDismiss) onDismiss();
    }),
    showToast: vi.fn(),
  })),
}));

async function waitForSelector(selector: string, timeout = 5000): Promise<HTMLElement> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) return el;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`Timeout waiting for selector: ${selector}`);
}

describe("Comprehensive User Journeys", () => {
  let app: GameApp;

  beforeEach(async () => {
    localStorage.clear();

    // Standard DOM setup for tests
    document.body.innerHTML = `
      <div id="game-shell">
        <div id="screen-main-menu" class="screen" style="display: none">
          <button id="btn-menu-campaign">Campaign</button>
          <button id="btn-menu-custom">Custom</button>
          <button id="btn-menu-statistics">Stats</button>
          <button id="btn-menu-settings">Settings</button>
        </div>
        <div id="screen-campaign-shell" class="screen flex-col" style="display: none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
            <div id="screen-campaign" class="screen" style="display: none"></div>
            <div id="screen-barracks" class="screen" style="display: none"></div>
            <div id="screen-equipment" class="screen" style="display: none"></div>
            <div id="screen-statistics" class="screen" style="display: none"></div>
            <div id="screen-settings" class="screen" style="display: none"></div>
            <div id="screen-engineering" class="screen" style="display: none"></div>
          </div>
          <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-mission-setup" class="screen" style="display: none"></div>
        <div id="screen-mission" class="screen" style="display: none">
          <div id="top-bar">
            <div id="game-status"></div>
            <div id="top-threat-fill"></div>
            <div id="top-threat-value">0%</div>
            <button id="btn-pause-toggle">Pause</button>
            <input type="range" id="game-speed" />
            <button id="btn-give-up">Give Up</button>
          </div>
          <div id="soldier-list"></div>
          <canvas id="game-canvas"></canvas>
          <div id="right-panel"></div>
        </div>
        <div id="screen-debrief" class="screen" style="display: none"></div>
        <div id="screen-campaign-summary" class="screen" style="display: none"></div>
        <div id="advisor-overlay"></div>
        <div id="modal-container"></div>
      </div>
    `;

    app = new GameApp();
    await app.initialize();
    app.registry.campaignManager.reset();
    app.registry.metaManager.reset();
  });

  afterEach(() => {
    if (app) app.stop();
  });

  it("Journey 1: New Campaign Start Wizard", async () => {
    // 1. Click Campaign from Main Menu
    document.getElementById("btn-menu-campaign")?.click();
    
    // 2. See the New Campaign Wizard
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
    
    // 3. Select difficulty
    const ironmanCard = await waitForSelector(".difficulty-card");
    // Click Ironman card if found
    const allCards = Array.from(document.querySelectorAll(".difficulty-card"));
    const ironman = allCards.find(c => c.textContent?.includes("Ironman")) as HTMLElement;
    if (ironman) ironman.click();
    
    // 4. Start Campaign
    const startBtn = await waitForSelector('[data-focus-id="btn-start-campaign"]');
    startBtn.click();

    // 5. Verify we are now in the campaign (sector map, no prologue auto-select)
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
    expect(app.registry.campaignManager.getState()?.status).toBe("Active");
  });

  it("Journey 2: Asset Management Hub & Back", async () => {
    // 1. Start a campaign first
    const cm = app.registry.campaignManager;
    cm.startNewCampaign(123, "Standard");

    app.start();
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Select a node first
    const nodeEl = document.querySelector(".campaign-node.accessible") as HTMLElement;
    expect(nodeEl).toBeTruthy();
    if (nodeEl) nodeEl.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Navigate to Asset Management Hub tab
    const readyRoomTab = Array.from(
      document.querySelectorAll("#campaign-shell-top-bar button"),
    ).find((b) => b.textContent?.includes("Asset Management Hub")) as HTMLElement;
    expect(readyRoomTab).toBeTruthy();
    readyRoomTab.click();

    expect(document.getElementById("screen-equipment")?.style.display).toBe("flex");

    // 3. Click Back to return to Campaign Map
    const backBtn = document.querySelector('[data-focus-id="btn-back"]') as HTMLElement;
    expect(backBtn).toBeTruthy();
    backBtn.click();

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
  });

  it("Journey 3: Successful Mission Cycle", async () => {
    // 1. Setup active campaign
    const cm = app.registry.campaignManager;
    cm.startNewCampaign(123, "Standard");

    app.start();
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Select accessible node
    const state = cm.getState()!;
    const accessibleNode = state.nodes.find(n => n.status === "Accessible")!;
    expect(accessibleNode).toBeTruthy();
    cm.selectNode(accessibleNode.id);

    const nodeEl = await waitForSelector(".campaign-node.accessible");
    nodeEl.click();

    // 3. Launch Mission from Equipment Screen
    await new Promise(resolve => setTimeout(resolve, 100));
    const equipmentLaunchBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Authorize")) as HTMLElement;
    expect(equipmentLaunchBtn).toBeTruthy();
    equipmentLaunchBtn.click();

    // 4. Verify Mission screen
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(document.getElementById("screen-mission")?.style.display).toBe("flex");

    // 5. Complete Mission (Won)
    const missionRunner = app.registry.missionRunner;
    (missionRunner as any).onMissionComplete({
      nodeId: accessibleNode.id,
      seed: 456,
      result: "Won",
      won: true,
      kills: 10,
      casualties: [],
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 120,
      soldierResults: [],
    });

    // 6. Verify Debrief
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(document.getElementById("screen-debrief")?.style.display).toBe("flex");

    // 7. Return to Operational Map
    const returnBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
    expect(returnBtn).toBeTruthy();
    returnBtn.click();

    await new Promise(resolve => setTimeout(resolve, 1000));
    // After first mission, NavOrch may auto-select next node or stay on campaign
    // Either campaign or equipment screen should be visible
    const campaignVisible = document.getElementById("screen-campaign")?.style.display === "flex";
    const equipmentVisible = document.getElementById("screen-equipment")?.style.display === "flex";
    expect(campaignVisible || equipmentVisible).toBe(true);
  });

  it("Journey 4: Campaign Mission Loss & Game Over", async () => {
    // 1. Setup Ironman campaign
    const cm = app.registry.campaignManager;
    cm.startNewCampaign(123, "Ironman");

    app.start();
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Select first node
    const state = cm.getState()!;
    const accessibleNode = state.nodes.find(n => n.status === "Accessible")!;
    expect(accessibleNode).toBeTruthy();
    cm.selectNode(accessibleNode.id);

    const firstNode = document.querySelector(".campaign-node.accessible") as HTMLElement;
    expect(firstNode).toBeTruthy();
    firstNode.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Launch Mission
    const equipmentLaunchBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Authorize")) as HTMLElement;
    expect(equipmentLaunchBtn).toBeTruthy();
    equipmentLaunchBtn.click();

    // 3. Fail Mission (Lost)
    await new Promise(resolve => setTimeout(resolve, 100));
    const missionRunner = app.registry.missionRunner;
    (missionRunner as any).onMissionComplete({
      nodeId: accessibleNode.id,
      seed: 123,
      result: "Lost",
      won: false,
      kills: 0,
      casualties: [],
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 10,
      soldierResults: [],
    });

    // 4. Debrief
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(document.getElementById("screen-debrief")?.style.display).toBe("flex");

    // 5. Return -> Summary (because Ironman + Loss = Defeat)
    const returnBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
    expect(returnBtn).toBeTruthy();
    returnBtn.click();

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(document.getElementById("screen-campaign-summary")?.style.display).toBe("flex");
    expect(document.getElementById("screen-campaign-summary")?.textContent).toContain("CONTRACT TERMINATED");
  });
});
