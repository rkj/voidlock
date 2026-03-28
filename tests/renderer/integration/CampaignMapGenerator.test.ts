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
      history: [],
      nodes: [
        { id: "n1", type: "Combat", status: "Accessible", missionType: "Default", pos: { x: 0, y: 0 }, position: { x: 100, y: 100 }, connections: [], mapSeed: 123, rank: 1 }
      ],
      currentNodeId: null,
      roster: [
        { id: "u1", name: "Alpha", archetypeId: "assault", hp: 100, maxHp: 100, kills: 0, xp: 0, status: "Healthy", equipment: {} }
      ],
      rules: { economyMode: "Open", deathRule: "Reinforced", mapGeneratorType: "TreeShip", mapGrowthRate: 1.0 },
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
        soldiers: mocks.mockCampaignState.roster,
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
      totalCampaignsStarted: 5,
      campaignsWon: 3,
      campaignsLost: 2,
      totalCasualties: 2,
      totalMissionsPlayed: 10,
      totalMissionsWon: 3,
      totalScrapEarned: 1000,
    }),
    addChangeListener: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
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
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue(mockInstance),
      resetInstance: vi.fn(),
    }
  };
});

describe("Campaign Map Generator Integration", () => {
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

    CampaignManager.resetInstance();
    app = new GameApp();
    await app.initialize();
  });

  it("should use the mapGeneratorType from campaign rules when starting a mission", async () => {
    // 1. Enter campaign
    const campaignBtn = document.getElementById("btn-menu-campaign");
    campaignBtn?.click();

    // 2. Select node
    const nodeEl = document.querySelector(".campaign-node") as HTMLElement;
    expect(nodeEl).toBeTruthy();
    nodeEl.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 3. Launch mission
    const launchBtn = document.getElementById("btn-launch-mission");
    launchBtn?.click();

    // Verify GameClient was initialized with TreeShip generator
    expect(app.registry.gameClient.init).toHaveBeenCalledWith(
      expect.objectContaining({
        mapGeneratorType: "TreeShip"
      })
    );
  });
});
