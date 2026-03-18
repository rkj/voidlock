/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/engine/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { MissionType, UnitState, GameState, MapGeneratorType } from "@src/shared/types";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
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

vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#000"),
      getIconUrl: vi.fn().mockReturnValue("mock-icon-url"),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
      applyTheme: vi.fn(),
    }),
  },
}));

vi.mock("@src/renderer/controllers/TutorialManager", () => ({
  TutorialManager: vi.fn().mockImplementation(() => ({
    enable: vi.fn(),
    disable: vi.fn(),
    reset: vi.fn(),
    triggerEvent: vi.fn(),
    onScreenShow: vi.fn(),
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
    // Reset singleton instances
    (CampaignManager as any).instance = null;
    (MetaManager as any).instance = null;

    // Standard DOM setup for tests
    document.body.innerHTML = `
      <div id="game-shell">
        <div id="screen-campaign-shell" style="display: none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content"></div>
          <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-main-menu" class="screen" style="display: none">
          <button id="btn-menu-campaign">Campaign</button>
          <button id="btn-menu-custom">Custom</button>
          <button id="btn-menu-statistics">Stats</button>
          <button id="btn-menu-settings">Settings</button>
        </div>
        <div id="screen-campaign" class="screen" style="display: none"></div>
        <div id="screen-mission-setup" class="screen" style="display: none"></div>
        <div id="screen-equipment" class="screen" style="display: none"></div>
        <div id="screen-mission" class="screen" style="display: none"></div>
        <div id="screen-debrief" class="screen" style="display: none"></div>
        <div id="screen-campaign-summary" class="screen" style="display: none"></div>
        <div id="screen-statistics" class="screen" style="display: none"></div>
        <div id="screen-engineering" class="screen" style="display: none"></div>
        <div id="screen-settings" class="screen" style="display: none"></div>
        <div id="advisor-overlay"></div>
        <div id="modal-container"></div>
      </div>
    `;

    // Mock storage to ensure clean slate
    CampaignManager.getInstance(new MockStorageProvider());
    MetaManager.getInstance(new MockStorageProvider());
    
    CampaignManager.getInstance().reset();
    MetaManager.getInstance().reset();

    app = new GameApp();
    await app.initialize();
  });

  it("Journey 1: New Campaign Start Wizard", async () => {
    // 1. Click Campaign from Main Menu
    document.getElementById("btn-menu-campaign")?.click();
    
    // 2. See the New Campaign Wizard
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
    
    // 3. Select difficulty
    const ironmanCard = Array.from(document.querySelectorAll(".difficulty-card")).find(c => c.textContent?.includes("Ironman")) as HTMLElement;
    expect(ironmanCard).toBeTruthy();
    ironmanCard.click();
    
    // 4. Start Campaign
    const startBtn = await waitForSelector('[data-focus-id="btn-start-campaign"]');
    startBtn.click();

    // 5. Verify we are now in the campaign (skipping Setup and going to Equipment because it's rank 0)
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(document.getElementById("screen-equipment")?.style.display).toBe("flex");
    expect(CampaignManager.getInstance().getState()?.status).toBe("Active");
  });

  it("Journey 2: Asset Management Hub & Back", async () => {
    // 1. Start a campaign first
    const cm = CampaignManager.getInstance();
    cm.startNewCampaign(123, "normal");
    const state = cm.getState()!;
    state.nodes[0].status = "Cleared";
    state.nodes[1].status = "Accessible";
    state.nodes[1].rank = 2; // Ensure rank >= 2 for Back button
    cm.save();

    app.start();
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Select a node first
    const nodeEl = document.querySelector(".campaign-node.accessible") as HTMLElement;
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

    await new Promise(resolve => setTimeout(resolve, 500));
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
  });

  it("Journey 3: Successful Mission Cycle", async () => {
    // 1. Setup active campaign at rank 1 (after prologue)
    const cm = CampaignManager.getInstance();
    cm.startNewCampaign(123, "normal");
    const state = cm.getState()!;
    state.rules.skipPrologue = true;
    state.currentNodeId = "node-1";
    state.nodes[0].status = "Cleared";
    state.nodes[1].status = "Accessible";
    state.history.push({
      nodeId: "prologue",
      seed: 123,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 0,
      soldierResults: [],
    });
    cm.save();
    
    app.start();
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Select accessible node
    const nodeEl = await waitForSelector(".campaign-node.accessible");
    nodeEl.click();

    // 3. Launch Mission from Equipment Screen
    await new Promise(resolve => setTimeout(resolve, 100));
    const equipmentLaunchBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Authorize Operation")) as HTMLElement;
    expect(equipmentLaunchBtn).toBeTruthy();
    equipmentLaunchBtn.click();

    // 4. Verify Mission screen
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(document.getElementById("screen-mission")?.style.display).toBe("flex");

    // 5. Complete Mission (Won)
    const missionRunner = (app as any).registry.missionRunner;
    missionRunner.onMissionComplete({
      nodeId: state.nodes[1].id,
      seed: 456,
      result: "Won",
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
    const returnBtn = document.querySelector("#screen-debrief .debrief-button") as HTMLElement;
    expect(returnBtn).toBeTruthy();
    expect(returnBtn.textContent).toContain("Return");
    returnBtn.click();

    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
  });

  it("Journey 4: Campaign Mission Loss & Game Over", async () => {
    // 1. Setup Ironman campaign
    const cm = CampaignManager.getInstance();
    cm.startNewCampaign(123, "extreme"); // Extreme uses Ironman death rules
    
    app.start();
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Select first node (Equipment screen redirect)
    const firstNode = document.querySelector(".campaign-node.accessible") as HTMLElement;
    if (firstNode) firstNode.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 2. Launch Mission
    const equipmentLaunchBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Authorize Operation")) as HTMLElement;
    expect(equipmentLaunchBtn).toBeTruthy();
    equipmentLaunchBtn.click();

    // 3. Fail Mission (Lost)
    await new Promise(resolve => setTimeout(resolve, 100));
    const missionRunner = (app as any).registry.missionRunner;
    missionRunner.onMissionComplete({
      nodeId: cm.getState()?.nodes[0].id || "",
      seed: 123,
      result: "Lost",
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
    returnBtn.click();

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(document.getElementById("screen-campaign-summary")?.style.display).toBe("flex");
    expect(document.getElementById("screen-campaign-summary")?.textContent).toContain("CONTRACT TERMINATED");
  });
});
