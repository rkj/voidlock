/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
  init: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  onStateUpdate: vi.fn(),
  queryState: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  getTimeScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commands: [] }),
  forceWin: vi.fn(),
  forceLose: vi.fn(),
  loadReplay: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
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
  return {
    ThemeManager: mockConstructor,
  };
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
  return {
    AssetManager: mockConstructor,
  };
});

// Mock CampaignManager
let mockCampaignState: any = null;
vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = {
    getState: vi.fn(() => mockCampaignState),
    getStorage: vi.fn().mockReturnValue({
        getCloudSync: vi.fn().mockReturnValue({
            initialize: vi.fn().mockResolvedValue(undefined),
            setEnabled: vi.fn(),
        }),
        load: vi.fn(),
    }),
    getSyncStatus: vi.fn().mockReturnValue("local-only"),
    addChangeListener: vi.fn(),
    removeChangeListener: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    assignEquipment: vi.fn(),
    processMissionResult: vi.fn(),
    startNewCampaign: vi.fn((seed, diff, overrides) => {
        mockCampaignState = {
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
                    name: "S1",
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
            unlockedArchetypes: ["scout"],
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
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    CampaignManager: mockConstructor,
  };
});

describe("Regression voidlock-14fv: Campaign Mission Setup Reload", () => {
  let app: GameApp;

  beforeEach(async () => {
    mockCampaignState = null;
    vi.clearAllMocks();

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
        </div>

        <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content">
            <div id="screen-campaign" class="screen" style="display:none"></div>
            <div id="screen-equipment" class="screen" style="display:none"></div>
            <div id="screen-engineering" class="screen" style="display:none"></div>
            <div id="screen-statistics" class="screen" style="display:none"></div>
            <div id="screen-settings" class="screen" style="display:none"></div>
          </div>
          <div id="campaign-shell-footer"></div>
        </div>

        <div id="screen-mission-setup" class="screen screen-centered" style="display:none">
            <div id="mission-setup-context"></div>
            <button id="btn-launch-mission">Launch</button>
            <div id="unit-style-preview"></div>
            <div id="squad-builder"></div>
            <button id="btn-goto-equipment">Equipment</button>
            <button id="btn-setup-back">Back</button>
            <select id="map-generator-type"><option value="DenseShip">Dense</option></select>
            <input type="checkbox" id="toggle-fog-of-war" checked />
            <input type="checkbox" id="toggle-debug-overlay" />
            <input type="checkbox" id="toggle-los-overlay" />
            <input type="checkbox" id="toggle-agent-control" checked />
            <input type="checkbox" id="toggle-manual-deployment" />
            <input type="checkbox" id="toggle-allow-tactical-pause" checked />
            <input type="number" id="map-width" value="10" />
            <input type="number" id="map-height" value="10" />
            <input type="number" id="map-spawn-points" value="3" />
            <input type="range" id="map-starting-threat" value="0" />
            <input type="range" id="map-base-enemies" value="3" />
            <input type="range" id="map-enemy-growth" value="1" />
        </div>
        <div id="screen-mission" class="screen" style="display:none">
            <div id="right-panel"></div>
        </div>
        <div id="screen-debrief" style="display:none"></div>
        <div id="screen-campaign-summary" style="display:none"></div>
        <div id="keyboard-help-overlay" style="display:none"></div>
      </div>
    `;

    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    app = await bootstrap();
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should restore campaign mission setup after reload", async () => {
    // 1. Start Campaign
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Handle wizard
    const initBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Initialize Expedition"),
    ) as HTMLElement;
    if (initBtn) {
      initBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // 2. Select node
    const combatNode = mockCampaignState.nodes.find((n: any) => n.type === "Combat")!;
    const nodeEl = document.querySelector(
      `.campaign-node[data-id="${combatNode.id}"]`,
    ) as HTMLElement;
    expect(nodeEl).toBeTruthy();
    nodeEl.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify we are on Equipment screen
    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );

    // 3. Verify mission config was saved to LocalStorage
    const campaignConfig = JSON.parse(
      localStorage.getItem("voidlock_campaign_config")!,
    );
    expect(campaignConfig.campaignNodeId).toBe("node-1");

    // 4. Reset modules and re-import to simulate reload
    vi.resetModules();
    const { bootstrap: bootstrap2 } = await import("@src/renderer/main");
    const app2 = await bootstrap2();
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 5. Verify we are RESTORED to Equipment screen
    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );
    
    // Check if the restored screen has the correct state
    const appAny2 = app2 as any;
    expect(appAny2.registry.missionSetupManager.currentCampaignNode?.id).toBe("node-1");
  });
});
