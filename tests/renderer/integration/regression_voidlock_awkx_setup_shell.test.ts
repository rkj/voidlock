/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MapGeneratorType } from "@src/shared/types";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
  init: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  onStateUpdate: vi.fn(),
  queryState: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  getTimeScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commandLog: [] }),
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
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { ThemeManager: mockConstructor };
});

vi.mock("@src/renderer/visuals/AssetManager", () => {
  const mockInstance = {
    loadSprites: vi.fn(),
    getUnitSprite: vi.fn(),
    getEnemySprite: vi.fn(),
    getMiscSprite: vi.fn(),
    getIcon: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { AssetManager: mockConstructor };
});

let currentCampaignState: any = null;
vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = {
    getState: vi.fn(() => currentCampaignState),
    load: vi.fn(),
    addChangeListener: vi.fn(),
    removeChangeListener: vi.fn(),
    startNewCampaign: vi.fn((seed, diff, overrides) => {
        currentCampaignState = {
            status: "Active",
            nodes: [
                {
                    id: "node-1",
                    type: "Combat",
                    status: "Accessible",
                    rank: 0,
                    difficulty: 1,
                    mapSeed: 123,
                    connections: [],
                    position: { x: 0, y: 0 },
                    bonusLootCount: 0,
                },
            ],
            roster: [
                {
                    id: "s1",
                    name: "Soldier 1",
                    archetypeId: "scout",
                    status: "Healthy",
                    level: 1,
                    hp: 100,
                    maxHp: 100,
                    xp: 0,
                    kills: 0,
                    missions: 0,
                    recoveryTime: 0,
                    soldierAim: 80,
                    equipment: {
                        rightHand: "pulse_rifle",
                        leftHand: undefined,
                        body: "basic_armor",
                        feet: undefined,
                    },
                },
            ],
            scrap: 100,
            intel: 0,
            currentSector: 1,
            currentNodeId: null,
            history: [],
            unlockedArchetypes: ["scout", "heavy", "medic", "demolition"],
            rules: {
                mode: "Preset",
                difficulty: diff || "Standard",
                deathRule: "Simulation",
                allowTacticalPause: true,
                mapGeneratorType: "DenseShip",
                difficultyScaling: 1,
                resourceScarcity: 1,
                startingScrap: 100,
                mapGrowthRate: 1,
                baseEnemyCount: 3,
                enemyGrowthPerMission: 1,
                economyMode: "Open",
                themeId: "default",
            },
        };
    }),
    getSyncStatus: vi.fn().mockReturnValue("local-only"),
    getStorage: vi.fn().mockReturnValue({
      getCloudSync: vi.fn().mockReturnValue({
        initialize: vi.fn().mockResolvedValue(undefined),
        setEnabled: vi.fn(),
      }),
    }),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { CampaignManager: mockConstructor };
});

vi.mock("@src/renderer/campaign/MetaManager", () => {
  const mockInstance = {
    getStats: vi.fn().mockReturnValue({
      totalKills: 0,
      totalCampaignsStarted: 0,
      campaignsWon: 0,
      campaignsLost: 0,
      totalMissionsWon: 0,
      totalMissionsPlayed: 0,
      totalCasualties: 0,
      totalScrapEarned: 0,
      currentIntel: 0,
      unlockedArchetypes: [],
      unlockedItems: [],
      prologueCompleted: false,
    }),
    load: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { MetaManager: mockConstructor };
});

describe("Mission Setup Shell Visibility (voidlock-awkx)", () => {
  let app: GameApp;

  beforeEach(async () => {
    currentCampaignState = null;
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
      </div>
      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content">
              <div id="screen-engineering" class="screen" style="display:none"></div>
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-barracks" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
              <div id="screen-settings" class="screen" style="display:none"></div>
              <div id="screen-mission-setup" class="screen" style="display:none">
              <div id="screen-settings" class="screen" style="display:none"></div>
              <div id="screen-mission-setup" class="screen" style="display:none">
                <div id="mission-setup-context"></div>
                <button id="btn-goto-equipment">Equipment</button>
                <button id="btn-setup-back">Back</button>
              </div>
          </div>
      </div>
      <div id="screen-equipment" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
      <div id="screen-mission" class="screen" style="display:none">
        <div id="hud-top-bar"></div>
        <div id="hud-soldier-panel"></div>
        <div id="hud-right-panel"></div>
        <div id="hud-mobile-action-panel"></div>
        <div id="game-container">
          <canvas id="game-canvas"></canvas>
        </div>
      </div>
      <div id="modal-container"></div>
    `;
    localStorage.clear();
    app = new GameApp();
    await app.initialize();
  });

  it("should maintain campaign shell visibility when entering mission setup from campaign screen", async () => {
    const shell = document.getElementById("screen-campaign-shell");
    
    // 1. Start Campaign
    document.getElementById("btn-menu-campaign")?.click();
    currentCampaignState = {
      status: "Active",
      nodes: [{ id: "node-1", type: "Combat", status: "Accessible", rank: 0, connections: [], position: { x: 0, y: 0 } }],
      roster: [],
      rules: { difficulty: "normal", allowTacticalPause: true, mapGeneratorType: MapGeneratorType.TreeShip },
    };
    
    // Wait for wizard
    await new Promise(resolve => setTimeout(resolve, 100));
    const startBtn = document.querySelector(".campaign-setup-wizard .primary-button") as HTMLElement;
    startBtn?.click();

    expect(shell?.style.display).toBe("flex");

    // 2. Select node
    const registry = (app as any).registry;
    registry.navigationOrchestrator.handleExternalScreenChange("mission-setup", true);

    expect(shell?.style.display).toBe("flex");
    expect(document.getElementById("screen-mission-setup")?.style.display).toBe("flex");
  });
});
