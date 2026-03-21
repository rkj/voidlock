/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GameState,
  MapGeneratorType,
  UnitState,
  EngineMode,
  MissionType,
} from "@src/shared/types";

// Mock dependencies before importing main.ts
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

// We need a way to trigger the GameClient callbacks
let stateUpdateCallback: ((state: GameState) => void) | null = null;

const mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
  init: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  queryState: vi.fn(),
  onStateUpdate: vi.fn((cb) => {
    stateUpdateCallback = cb;
  }),
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
    processMissionResult: vi.fn((report) => {
      if (mockCampaignState) {
        mockCampaignState.history.push(report);
      }
    }),
    save: vi.fn(),
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
    assignEquipment: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    CampaignManager: mockConstructor,
  };
});

describe("Screen Flow Integration", () => {
  beforeEach(async () => {
    mockCampaignState = null;
    vi.clearAllMocks();

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
      closePath: vi.fn(),
      setLineDash: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      drawImage: vi.fn(),
    }) as any;

    // Set up DOM
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
          <button id="btn-menu-custom">Custom Mission</button>
          <p id="menu-version"></p>
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

    // Mock window.confirm
    window.confirm = vi.fn().mockReturnValue(true);
    // Mock window.alert
    window.alert = vi.fn();

    localStorage.clear();

    // Import main.ts
    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    await bootstrap();

    // Trigger DOMContentLoaded
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should follow Flow 1: MainMenu -> Campaign -> Equipment -> Mission -> Win -> Debrief -> Campaign", async () => {
    // 1. Main Menu -> Campaign
    const btnCampaign = document.getElementById("btn-menu-campaign");
    btnCampaign?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Handle wizard
    const initBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Initialize Expedition"),
    ) as HTMLElement;
    if (initBtn) {
      initBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(document.getElementById("screen-campaign")?.style.display).toBe(
      "flex",
    );

    // 2. Campaign -> Equipment
    const nodes = document.querySelectorAll(".campaign-node");
    expect(nodes.length).toBeGreaterThan(0);
    (nodes[0] as HTMLElement).click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );

    // 3. Equipment -> Mission
    const btnLaunch = document.getElementById("btn-launch-mission");
    btnLaunch?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );

    // 4. Mission -> Win -> Debrief
    if (stateUpdateCallback) {
      stateUpdateCallback({
        t: 1000,
        status: "Won",
        objectives: [{ state: "Completed" }],
        units: [{ hp: 100, maxHp: 100, tacticalNumber: 1, name: "S1", id: "s1", kills: 5, state: 0 }],
        stats: { aliensKilled: 5, casualties: 0, scrapGained: 50 },
        map: { width: 10, height: 10, cells: [] },
        settings: {},
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );

    // 5. Debrief -> Campaign
    const btnContinue = Array.from(document.querySelectorAll(".debrief-button")).find(
      (b) => b.textContent?.includes("Return to Operational Terminal"),
    ) as HTMLElement;
    btnContinue?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // After Mission 1, it should go to Equipment (Mission 2 Ready Room tutorial)
    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );
  });

  it("should follow Flow 2: MainMenu -> Mission Setup -> Equipment -> Mission -> Lose -> Debrief -> Main Menu", async () => {
    // 1. Main Menu -> Mission Setup
    const btnCustom = document.getElementById("btn-menu-custom");
    btnCustom?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-mission-setup")?.style.display).toBe(
      "flex",
    );

    // 2. Mission Setup -> Equipment
    const btnGotoEquipment = document.getElementById("btn-goto-equipment");
    btnGotoEquipment?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );

    // 3. Equipment -> Mission
    // In custom mode, equipment screen might not have launch button, goes back to setup
    const backBtn = document.querySelector('[data-focus-id="btn-back"]') as HTMLElement;
    if (backBtn) {
        backBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
        document.getElementById("btn-launch-mission")?.click();
    } else {
        document.getElementById("btn-launch-mission")?.click();
    }
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );

    // 4. Mission -> Lose -> Debrief
    if (stateUpdateCallback) {
      stateUpdateCallback({
        t: 500,
        status: "Lost",
        objectives: [{ state: "Pending" }],
        units: [{ hp: 0, maxHp: 100, tacticalNumber: 1, name: "S1", id: "s1", kills: 0, state: 1 }],
        stats: { aliensKilled: 0, casualties: 1, scrapGained: 0 },
        map: { width: 10, height: 10, cells: [] },
        settings: {},
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );

    // 5. Debrief -> Main Menu
    const btnContinue = Array.from(document.querySelectorAll(".debrief-button")).find(
      (b) => b.textContent?.includes("Return to Operational Terminal"),
    ) as HTMLElement;
    btnContinue?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-main-menu")?.style.display).toBe(
      "flex",
    );
  });

  it("should show tabs in CampaignShell when in Equipment screen to allow accessing Settings/Stats", async () => {
    // 1. Main Menu -> Campaign
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Wizard
    const initBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Initialize Expedition"),
    ) as HTMLElement;
    if (initBtn) {
      initBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Check tabs are visible
    expect(document.querySelector(".tab-button")).not.toBeNull();

    // 2. Campaign -> Equipment
    const nodes = document.querySelectorAll(".campaign-node");
    expect(nodes.length).toBeGreaterThan(0);
    (nodes[0] as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );

    // Tabs should STILL be visible in Ready Room
    expect(document.querySelector(".tab-button")).not.toBeNull();

    // 3. Equipment -> Settings (via tab click)
    const btnSettings = Array.from(document.querySelectorAll(".tab-button")).find(
      (b) => b.textContent?.includes("Terminal"),
    ) as HTMLElement;
    btnSettings?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-settings")?.style.display).toBe(
      "flex",
    );

    // 4. Settings -> Back (should go back to Equipment)
    const backBtn = document.querySelector('[data-focus-id="btn-settings-back"]') as HTMLElement;
    if (backBtn) {
        backBtn.click();
    } else {
        // Fallback to keyboard back
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );

    // 5. Equipment -> Back to Campaign Map
    const equipmentBackBtn = document.querySelector('[data-focus-id="btn-back"]') as HTMLElement;
    equipmentBackBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-campaign")?.style.display).toBe(
      "flex",
    );
    // Check tabs are visible again
    expect(document.querySelector(".tab-button")).not.toBeNull();
  });
});
