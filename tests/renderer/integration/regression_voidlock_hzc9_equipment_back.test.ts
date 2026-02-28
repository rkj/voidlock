/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MapGeneratorType } from "@src/shared/types";
import { CampaignState, CampaignDifficulty } from "@src/shared/campaign_types";

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
  forceWin: vi.fn(),
  forceLose: vi.fn(),
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
        startNewCampaign: vi.fn((seed, difficulty, overrides, themeId) => {
          const rulesDifficulty = (
            difficulty === "Normal" ? "Clone" : difficulty
          ) as CampaignDifficulty;
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
              difficulty: rulesDifficulty,
              deathRule: "Simulation",
              allowTacticalPause: true,
              mapGeneratorType: MapGeneratorType.DenseShip,
              difficultyScaling: 1,
              resourceScarcity: 1,
              startingScrap: 100,
              mapGrowthRate: 1,
              baseEnemyCount: 3,
              enemyGrowthPerMission: 1,
              economyMode: "Open",
              themeId:
                themeId ||
                (typeof overrides === "object"
                  ? overrides?.themeId
                  : undefined),
            },
          } as CampaignState;
        }),
        reset: vi.fn(() => {
          currentCampaignState = null;
        }),
        deleteSave: vi.fn(() => {
          currentCampaignState = null;
        }),
      }),
    },
  };
});

describe("Equipment Back Bug Reproduction", () => {
  beforeEach(async () => {
    currentCampaignState = null;

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Set up DOM
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
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
              <div id="screen-mission-setup" class="screen screen-centered" style="display:none">
                <h1>Mission Configuration</h1>
                <div id="mission-setup-context"></div>
                <div id="map-config-section">
                  <select id="map-generator-type"><option value="Procedural">Procedural</option></select>
                  <input type="number" id="map-seed" />
                  <input type="number" id="map-width" value="14" />
                  <input type="number" id="map-height" value="14" />
                  <input type="range" id="map-spawn-points" value="1" />
                  <input type="range" id="map-starting-threat" value="0" />
                </div>
                <div id="unit-style-preview"></div>
                <div id="squad-builder"></div>
                <button id="btn-goto-equipment">Equipment</button>
                <button id="btn-setup-back">Back</button>
              </div>
          </div>
      </div>
      <div id="screen-mission" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
      <div id="modal-container"></div>
    `;

    localStorage.clear();

    // Import main.ts
    vi.resetModules();
    await import("@src/renderer/main");

    // Trigger DOMContentLoaded
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should not hide campaign shell when backing out of Equipment to Mission Setup", async () => {
    // 1. Main Menu -> Campaign
    document.getElementById("btn-menu-campaign")?.click();

    // 2. Initialize Expedition
    const startBtn = document.querySelector(
      ".campaign-setup-wizard .primary-button",
    ) as HTMLElement;
    if (!startBtn) throw new Error("Start button not found");
    startBtn.click();

    // 3. Pick first mission
    const node = document.querySelector(
      ".campaign-node.accessible",
    ) as HTMLElement;
    if (!node) throw new Error("Node not found");
    node.click();

    // Verify we are in equipment and shell is visible (skipping Mission Setup)
    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );
    expect(
      document.getElementById("screen-campaign-shell")?.style.display,
    ).toBe("flex");

    // 4. Click Back in Equipment screen
    const backBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent === "Back") as HTMLElement;
    expect(backBtn).toBeTruthy();
    backBtn.click();

    // Verify we are back in campaign screen
    expect(document.getElementById("screen-campaign")?.style.display).toBe(
      "flex",
    );

    // Verify Shell is STILL visible (FIXED)
    expect(
      document.getElementById("screen-campaign-shell")?.style.display,
    ).toBe("flex");
  });
});
