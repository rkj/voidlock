/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MapGeneratorType } from "@src/shared/types";
import { CampaignState } from "@src/shared/campaign_types";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  init: vi.fn(),
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
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
let currentCampaignState: CampaignState | null = null;

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => currentCampaignState),
        getStorage: vi.fn(),
        getSyncStatus: vi.fn().mockReturnValue("local-only"),
        addChangeListener: vi.fn(),
        removeChangeListener: vi.fn(),
        load: vi.fn(),
        processMissionResult: vi.fn(),
        save: vi.fn(),
        startNewCampaign: vi.fn((seed, diff, pause, theme) => {
          currentCampaignState = {
            status: "Active",
            seed,
            version: "1.0.0",
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
              mode: "Custom",
              difficulty: diff,
              deathRule: "Simulation",
              allowTacticalPause: pause,
              mapGeneratorType: MapGeneratorType.DenseShip,
              difficultyScaling: 1,
              resourceScarcity: 1,
              startingScrap: 100,
              mapGrowthRate: 1,
              baseEnemyCount: 3,
              enemyGrowthPerMission: 1,
              economyMode: "Open",
              themeId: theme,
            },
          } as CampaignState;
        }),
        reset: vi.fn(),
        deleteSave: vi.fn(),
        healSoldier: vi.fn(),
        recruitSoldier: vi.fn(),
        assignEquipment: vi.fn(),
        spendScrap: vi.fn(),
      }),
    },
  };
});

describe("Repro: Mission Briefing Screen Leak", () => {
  beforeEach(async () => {
    currentCampaignState = null;

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Mock getContext for canvas
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
    }) as any;

    // Set up DOM exactly like index.html
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
          <button id="btn-menu-custom">Custom Mission</button>
          <button id="btn-menu-statistics">Statistics</button>
          <button id="btn-menu-engineering">Engineering</button>
          <button id="btn-menu-settings">Settings</button>
          <button id="btn-menu-reset">Reset</button>
          <p id="menu-version"></p>
        </div>

        <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content">
            <div id="screen-campaign" class="screen" style="display:none"></div>
            <div id="screen-equipment" class="screen" style="display:none"></div>
            <div id="screen-statistics" class="screen" style="display:none"></div>
            <div id="screen-settings" class="screen" style="display:none"></div>
            <div id="screen-engineering" class="screen" style="display:none"></div>
            <div id="screen-campaign-summary" class="screen" style="display:none"></div>
            <div id="screen-mission-setup" class="screen screen-centered" style="display:none">
               <h1 id="mission-setup-title">Mission Configuration</h1>
               <div id="mission-setup-context"></div>
               <div id="map-config-section">
                  <select id="map-generator-type"></select>
                  <input id="map-seed" />
                  <input id="map-width" />
                  <input id="map-height" />
                  <input id="map-spawn-points" />
                  <input id="map-starting-threat" />
                  <input id="map-base-enemies" />
                  <input id="map-enemy-growth" />
                  <input type="checkbox" id="toggle-fog-of-war" />
                  <input type="checkbox" id="toggle-debug-overlay" />
                  <input type="checkbox" id="toggle-los-overlay" />
                  <input type="checkbox" id="toggle-agent-control" />
                  <input type="checkbox" id="toggle-manual-deployment" />
                  <input type="checkbox" id="toggle-allow-tactical-pause" />
               </div>
               <div id="squad-builder"></div>
               <button id="btn-goto-equipment">Next</button>
               <button id="btn-setup-back">Back</button>
               <button id="btn-launch-mission">Launch</button>
            </div>
          </div>
        </div>

        <div id="screen-mission" class="screen" style="display:none">
          <div id="top-bar">
             <button id="btn-pause-toggle"></button>
             <input type="range" id="game-speed" />
             <button id="btn-give-up"></button>
          </div>
          <div id="soldier-panel"></div>
          <div id="right-panel"></div>
          <div id="game-container"><canvas id="game-canvas"></canvas></div>
        </div>
        <div id="screen-debrief" class="screen" style="display:none"></div>
      </div>
      <div id="modal-container"></div>
    `;

    localStorage.clear();

    // Import main.ts
    vi.resetModules();
    await import("@src/renderer/main");
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should NEVER show Mission Setup screen when clicking Confirm Squad in campaign mode", async () => {
    // 1. Start a new campaign
    document.getElementById("btn-menu-campaign")?.click();
    const startBtn = document.querySelector(
      ".campaign-setup-wizard .primary-button",
    ) as HTMLElement;
    startBtn.click();

    // 2. Click a combat node
    const cmState = CampaignManager.getInstance().getState()!;
    const combatNode = cmState.nodes.find((n) => n.type === "Combat")!;
    const nodeEl = document.querySelector(
      `.campaign-node[data-id="${combatNode.id}"]`,
    ) as HTMLElement;
    nodeEl.click();

    // 3. Verify we are in Equipment Screen
    const equipmentScreen = document.getElementById("screen-equipment");
    expect(equipmentScreen?.style.display).toBe("flex");

    // 4. Click 'Back'
    const backBtn = document.querySelector('[data-focus-id="btn-back"]') as HTMLElement;
    expect(backBtn).toBeTruthy();
    backBtn.click();

    // 5. EXPECTATION: We should NOT be in Mission Setup
    const setupScreen = document.getElementById("screen-mission-setup");
    expect(setupScreen?.style.display).toBe("none");
    
    // 6. EXPECTATION: We should be back in Campaign (Sector Map)
    const campaignScreen = document.getElementById("screen-campaign");
    expect(campaignScreen?.style.display).toBe("flex");
  });
});
