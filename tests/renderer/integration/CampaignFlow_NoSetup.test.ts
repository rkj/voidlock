/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { MissionType } from "@src/shared/types";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
  init: vi.fn(), pause: vi.fn(), resume: vi.fn(),
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
  getReplayData: vi.fn().mockReturnValue({}),
  forceWin: vi.fn(),
  forceLose: vi.fn(),
  loadReplay: vi.fn(),
  applyCommand: vi.fn(),
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

const mockModalService = {
  alert: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn().mockResolvedValue(true),
  prompt: vi.fn().mockResolvedValue("New Recruit"),
  show: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

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
    reset: vi.fn(),
    deleteSave: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    CampaignManager: mockConstructor,
  };
});

describe("Campaign Flow Without Setup Integration", () => {
  beforeEach(async () => {
    mockCampaignState = null;
    vi.clearAllMocks();

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Set up DOM
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

        <div id="screen-mission-setup" class="screen h-full" style="display:none">
            <div id="unit-style-preview"></div>
            <div id="squad-builder"></div>
            <button id="btn-launch-mission">Launch</button>
            <button id="btn-goto-equipment">Equipment</button>
            <button id="btn-setup-back">Back</button>
            <select id="map-generator-type"><option value="DenseShip">Dense</option></select>
            <select id="mission-type"><option value="Default">Default</option></select>
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
        <div id="screen-debrief" class="screen" style="display:none"></div>
        <div id="screen-campaign-summary" class="screen" style="display:none"></div>
        <div id="keyboard-help-overlay" style="display:none"></div>
      </div>
    `;

    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    await bootstrap();
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should show campaign screen directly if a campaign is active", async () => {
    // Manually set an active campaign
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
      roster: [],
      scrap: 100,
      intel: 0,
      currentSector: 1,
      currentNodeId: null,
      history: [],
      rules: {
        mode: "Preset",
        difficulty: "Standard",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
      },
    };

    // 1. Main Menu -> Campaign
    const btnCampaign = document.getElementById("btn-menu-campaign");
    btnCampaign?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should skip wizard and show campaign screen
    expect(document.getElementById("screen-campaign")?.style.display).toBe(
      "flex",
    );
    expect(document.querySelector(".campaign-setup-wizard")).toBeNull();
  });
});
