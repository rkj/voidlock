/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnitState } from "@src/shared/types";

// Mock dependencies before importing main.ts
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

// We need a way to trigger the GameClient callbacks
let stateUpdateCallback: ((state: any) => void) | null = null;

const mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
  init: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  queryState: vi.fn(),
  onStateUpdate: vi.fn((cb) => {
    stateUpdateCallback = cb;
  }),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  getTimeScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 12345, commands: [] }),
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
      if (report.result === "Won") {
        const node = mockCampaignState.nodes.find(
          (n: any) => n.id === report.nodeId,
        );
        if (node?.type === "Boss") {
          mockCampaignState.status = "Victory";
        }
        mockCampaignState.history.push(report);
      }
    }),
    save: vi.fn(),
    startNewCampaign: vi.fn((seed, diff, overrides) => {
        console.log("MOCK startNewCampaign called");
        mockCampaignState = {
            status: "Active",
            nodes: [
                {
                    id: "node-boss",
                    type: "Boss",
                    status: "Accessible",
                    rank: 5,
                    difficulty: 3,
                    mapSeed: 999,
                    connections: [],
                    position: { x: 500, y: 0 },
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

describe("Campaign End Integration", () => {
  beforeEach(async () => {
    // Reset state
    mockCampaignState = null;

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

        <div id="screen-mission-setup" class="screen" style="display:none"></div>
        <div id="screen-mission" class="screen" style="display:none"></div>
        <div id="screen-debrief" class="screen" style="display:none"></div>
        <div id="screen-campaign-summary" class="screen" style="display:none"></div>
        <div id="squad-builder"></div>
      </div>
    `;

    // Import main.ts
    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    await bootstrap();

    // Trigger DOMContentLoaded
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should trigger Victory state and show victory report after Boss mission win", async () => {
    // 1. Entering campaign
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Handle new campaign wizard
    const initBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Initialize Expedition"),
    ) as HTMLElement;
    if (initBtn) {
      initBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // 2. Select Boss node and launch
    const bossNode = mockCampaignState.nodes.find((n: any) => n.type === "Boss");
    const nodeEl = document.querySelector(`.campaign-node[data-id="${bossNode.id}"]`) as HTMLElement;
    expect(nodeEl).toBeTruthy();
    nodeEl.click();

    // 3. Launch from setup
    await new Promise((resolve) => setTimeout(resolve, 50));
    document.getElementById("btn-launch-mission")?.click();
    
    // Simulate mission win via state update
    if (stateUpdateCallback) {
      stateUpdateCallback({
        t: 1000,
        status: "Won",
        objectives: [{ state: "Completed" }],
        units: [{ hp: 100, maxHp: 100, tacticalNumber: 1, name: "S1", id: "s1", kills: 10, state: 0 }],
        stats: { aliensKilled: 10, casualties: 0, scrapGained: 100 },
        map: { width: 10, height: 10, cells: [] },
        settings: {},
      });
    }

    // Verify debrief screen shown
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.getElementById("screen-debrief")?.style.display).toBe("flex");

    // 4. Click Continue on debrief
    const continueBtn = Array.from(document.querySelectorAll(".debrief-button")).find(
      (b) => b.textContent?.includes("Return to Operational Terminal"),
    ) as HTMLElement;
    expect(continueBtn).toBeTruthy();
    continueBtn.click();

    // Verify victory status
    expect(mockCampaignState.status).toBe("Victory");

    // The summary screen should be shown
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.getElementById("screen-campaign-summary")?.style.display).not.toBe("none");
    expect(document.body.textContent).toContain("CONTRACT SUCCESS");
  });
});
