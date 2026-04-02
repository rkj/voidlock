// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Mock dependencies
vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    init: vi.fn(),
    start: vi.fn(),
    onObservation: vi.fn(),
    sendCommand: vi.fn(),
    onMessage: vi.fn(),
    onStateUpdate: vi.fn(),
    addStateUpdateListener: vi.fn(),
    removeStateUpdateListener: vi.fn(),
    getReplayData: vi.fn().mockReturnValue({ commands: [] }),
    loadReplay: vi.fn(),
    stop: vi.fn(),
    setTimeScale: vi.fn(),
    freezeForDialog: vi.fn(),
    unfreezeAfterDialog: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
  })),
}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    mockCampaignState: {
      scrap: 500,
      intel: 10,
      currentSector: 1,
      status: "Active",
      history: [{}], // One mission completed
      nodes: [
        { id: "n1", type: "Combat", status: "Accessible", missionType: "Default", pos: { x: 0, y: 0 }, position: { x: 100, y: 100 }, connections: [], mapSeed: 123, rank: 1 }
      ],
      currentNodeId: "n1",
      roster: [],
      rules: { economyMode: "Open", deathRule: "Reinforced", mapGeneratorType: "DenseShip", mapGrowthRate: 1.0 },
      unlockedArchetypes: ["assault"],
      unlockedItems: [],
    }
  }
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
      logLevel: "INFO",
      debugSnapshotInterval: 100,
      debugOverlayEnabled: false,
      fogOfWarEnabled: true,
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(mocks.mockCampaignState),
    loadCustom: vi.fn().mockReturnValue({
      squadConfig: {
        soldiers: [],
        inventory: {},
      }
    }),
    saveCampaign: vi.fn(),
    saveCustom: vi.fn(),
    clearCampaign: vi.fn(),
    getDefault: vi.fn().mockReturnValue({
        fogOfWarEnabled: true,
        debugOverlayEnabled: false, 
        squadConfig: { soldiers: [] },
        mapWidth: 20,
        mapHeight: 20,
        spawnPointCount: 1,
        lastSeed: 1,
        mapGeneratorType: "DenseShip",
        missionType: "Default",
        allowTacticalPause: true,
        manualDeployment: false,
        agentControlEnabled: false,
    }),
  },
}));

// Mock MetaManager
vi.mock("@src/engine/campaign/MetaManager", () => {
  const mockInstance = {
    getStats: vi.fn().mockReturnValue({
      totalKills: 100,
      totalCampaignsStarted: 1,
      campaignsWon: 0,
      campaignsLost: 0,
      totalCasualties: 0,
      totalMissionsWon: 1,
      totalMissionsPlayed: 1,
      totalScrapEarned: 500,
    }),
    addChangeListener: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return { MetaManager: mockConstructor };
});

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = {
    getState: vi.fn().mockImplementation(() => mocks.mockCampaignState),
    load: vi.fn().mockReturnValue(true),
    save: vi.fn(),
    resetInstance: vi.fn(),
    advanceCampaign: vi.fn(),
    advanceCampaignWithoutMission: vi.fn(),
    processMissionResult: vi.fn(),
    reconcileMission: vi.fn(),
    deleteSave: vi.fn(),
    addChangeListener: vi.fn(),
    removeChangeListener: vi.fn(),
    selectNode: vi.fn(),
    getSyncStatus: vi.fn().mockReturnValue("local-only"),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  return { CampaignManager: mockConstructor };
});

describe("Tutorial Mission 2 Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
        </div>
        <div id="screen-campaign" class="screen"></div>
        <div id="screen-campaign-shell"></div>
        <div id="screen-equipment" class="screen"></div>
        <div id="screen-mission-setup" class="screen"></div>
        <div id="screen-debrief" class="screen"></div>
        <div id="screen-statistics" class="screen"></div>
        <div id="screen-engineering" class="screen"></div>
        <div id="screen-settings" class="screen"></div>
        <div id="screen-campaign-summary" class="screen"></div>
        <div id="mission-body"></div>
        <div id="screen-mission" class="screen">
            <canvas id="game-canvas"></canvas>
        </div>
      </div>
      <div id="modal-container"></div>
    `;

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      drawImage: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      setLineDash: vi.fn(),
    });

    
    app = new GameApp();
    await app.initialize();
  });

  it("should enforce lockdown and show only Asset Management Hub during Mission 2 tutorial", async () => {
    // 1. Enter campaign (Mission 2 state)
    const campaignBtn = document.getElementById("btn-menu-campaign");
    campaignBtn?.click();

    // 2. Verify tabs in CampaignShell
    const tabs = Array.from(document.querySelectorAll(".shell-tab"));
    
    // In Mission 2 tutorial, only Asset Management Hub is shown
    expect(tabs.length).toBe(1);
    expect(tabs[0].textContent).toBe(t(I18nKeys.hud.shell.asset_management_hub));
  });
});
