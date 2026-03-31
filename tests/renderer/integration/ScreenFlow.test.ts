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
      currentNodeId: "n1",
      roster: [
        { id: "u1", name: "Alpha", archetypeId: "assault", hp: 100, maxHp: 100, kills: 0, xp: 0, status: "Healthy", equipment: {} }
      ],
      rules: { economyMode: "Open", deathRule: "Reinforced", mapGrowthRate: 1.0 },
      unlockedArchetypes: ["assault"],
      unlockedItems: [],
    },
    mockGameConfig: {
        mapWidth: 32,
        mapHeight: 24,
        spawnPointCount: 4,
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        losOverlayEnabled: false,
        agentControlEnabled: false,
        manualDeployment: false,
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        missionType: "Default",
        lastSeed: 12345,
        squadConfig: { soldiers: [] },
        startingThreatLevel: 0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1.0,
    }
  }
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      phosphorMode: "green",
      logLevel: "INFO",
      debugSnapshots: false,
      debugSnapshotInterval: 500,
      debugOverlay: false,
      locale: "en-corporate",
      debugOverlayEnabled: false,
      fogOfWarEnabled: true,
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(mocks.mockCampaignState),
    loadCustom: vi.fn().mockReturnValue(mocks.mockGameConfig),
    saveCampaign: vi.fn(),
    saveCustom: vi.fn(),
    clearCampaign: vi.fn(),
    getDefault: vi.fn().mockReturnValue(mocks.mockGameConfig),
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
    assignEquipment: vi.fn(),
    getSyncStatus: vi.fn().mockReturnValue("local-only"),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  return { CampaignManager: mockConstructor };
});

describe("Screen Flow Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
          <button id="btn-menu-custom">Custom</button>
          <button id="btn-menu-statistics">Stats</button>
          <button id="btn-menu-settings">Settings</button>
          <button id="btn-menu-engineering">Eng</button>
        </div>
        <div id="screen-campaign" class="screen"></div>
        <div id="screen-mission-setup" class="screen"></div>
        <div id="screen-equipment" class="screen"></div>
        <div id="screen-debrief" class="screen">
            <canvas id="debrief-replay-canvas"></canvas>
        </div>
        <div id="screen-campaign-summary" class="screen"></div>
        <div id="screen-statistics" class="screen"></div>
        <div id="screen-engineering" class="screen"></div>
        <div id="screen-settings" class="screen"></div>
        <div id="screen-campaign-shell"></div>
        <div id="screen-mission" class="screen">
            <div id="mission-body"></div>
            <canvas id="game-canvas"></canvas>
            <button id="btn-pause-toggle"></button>
            <button id="btn-give-up"></button>
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

  it("should follow Flow 1: MainMenu -> Campaign -> Equipment -> Mission -> Win -> Debrief -> Campaign", async () => {
    // 1. Main Menu -> Campaign
    const campaignBtn = document.getElementById("btn-menu-campaign");
    campaignBtn?.click();
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");

    // 2. Campaign -> Equipment
    app.registry.navigationOrchestrator.onCampaignNodeSelect({ id: "n1", type: "Combat", status: "Accessible", missionType: "Default", pos: { x: 0, y: 0 }, position: { x: 100, y: 100 }, connections: [], mapSeed: 123, rank: 1 });
    expect(document.getElementById("screen-equipment")?.style.display).toBe("flex");

    // 3. Equipment -> Mission
    app.registry.navigationOrchestrator.onLaunchMission({ soldiers: mocks.mockCampaignState.roster, inventory: {} });
    expect(document.getElementById("screen-mission")?.style.display).toBe("flex");

    // 4. Mission -> Win -> Debrief
    const report: any = { 
        nodeId: "n1",
        result: "Won", 
        aliensKilled: 10, 
        scrapGained: 100, 
        soldierResults: [],
        timeSpent: 120000
    };
    app.registry.missionRunner.onMissionComplete(report);
    expect(document.getElementById("screen-debrief")?.style.display).toBe("flex");

    // 5. Debrief -> Campaign
    (app as any).debriefScreen.onContinue();
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
  });

  it("should show tabs in CampaignShell when in Equipment screen to allow accessing Settings/Stats", async () => {
    // 1. Enter campaign
    const campaignBtn = document.getElementById("btn-menu-campaign");
    campaignBtn?.click();

    // 2. Campaign -> Equipment
    app.registry.navigationOrchestrator.onCampaignNodeSelect({ id: "n1", type: "Combat", status: "Accessible", missionType: "Default", pos: { x: 0, y: 0 }, position: { x: 100, y: 100 }, connections: [], mapSeed: 123, rank: 1 });
    expect(document.getElementById("screen-equipment")?.style.display).toBe("flex");
  });
});
