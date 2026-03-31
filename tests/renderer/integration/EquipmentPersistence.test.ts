import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing main.ts
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
  
  return {
    ThemeManager: mockConstructor,
  };
});

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = {
    getState: vi.fn(() => currentCampaignState),
    selectNode: vi.fn(),
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
    reconcileMission: vi.fn(),
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
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return {
    CampaignManager: mockConstructor,
  };
});

let currentCampaignState: any = null;
describe("Equipment Persistence Integration", () => {
  beforeEach(async () => {
    currentCampaignState = null;
    vi.clearAllMocks();

    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
    }) as any;

    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
        <button id="btn-menu-custom">Custom Mission</button>
        <p id="menu-version"></p>
      </div>

      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
              <div id="screen-engineering" class="screen" style="display:none"></div>
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-barracks" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
              <div id="screen-settings" class="screen" style="display:none"></div>
          </div>
      </div>

      <div id="screen-mission-setup" class="screen screen-centered" style="display:none">
        <h1>Mission Configuration</h1>
        <div id="unit-style-preview"></div>
        <div id="squad-builder"></div>
        <button id="btn-launch-mission" class="primary-button">Launch Mission</button>
        <button id="btn-goto-equipment">Equipment</button>
      </div>
      <div id="screen-equipment" class="screen" style="display:none"></div>
      <div id="screen-mission" class="screen" style="display:none">
         <canvas id="game-canvas"></canvas>
      </div>
      <div id="screen-barracks" class="screen" style="display:none"></div>
      <div id="screen-mission" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
      <div id="screen-statistics" class="screen" style="display:none"></div>
    `;

    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();
    localStorage.clear();

    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    await bootstrap();
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should call campaignManager.assignEquipment when equipment is saved in campaign mode", async () => {
    const { CampaignManager } = await import("@src/renderer/campaign/CampaignManager");
    const manager = new CampaignManager(new MockStorageProvider(), new MetaManager(new MockStorageProvider()));

    // 1. Start Campaign
    document.getElementById("btn-menu-campaign")?.click();
    const startBtn = document.querySelector(
      ".campaign-setup-wizard .primary-button",
    ) as HTMLElement;
    startBtn.click();

    // 2. Select node and go to mission setup
    const nodeEl = document.querySelector(
      ".campaign-node.accessible",
    ) as HTMLElement;
    nodeEl.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    // In mission setup, select the scout
    const scoutCb = document.querySelector(
      "#squad-builder input[type='checkbox']",
    ) as HTMLInputElement;
    if (scoutCb && !scoutCb.checked) scoutCb.click();

    // 3. Go to Equipment Screen
    document.getElementById("btn-goto-equipment")?.click();
    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );

    // 4. Find the 'Confirm Squad' button and click it
    // Note: The EquipmentScreen renders its own UI.
    const launchBtn = Array.from(document.querySelectorAll("#screen-equipment button")).find(
      (b) => b.textContent?.includes("Authorize Operation"),
    );
    expect(launchBtn).toBeTruthy();

    launchBtn?.click();

    // 5. Verify assignEquipment was called for soldier 's1'
    expect(manager.assignEquipment).toHaveBeenCalled();
    // It should be called with soldier ID 's1' and some equipment
    expect(manager.assignEquipment).toHaveBeenCalledWith(
      "s1",
      expect.anything(),
    );
  });
});
