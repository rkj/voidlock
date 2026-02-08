/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing main.ts
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commandLog: [] }),
  forceWin: vi.fn(),
  forceLose: vi.fn(),
  loadReplay: vi.fn(),
};

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => mockGameClient),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
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
let currentCampaignState: any = null;

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => currentCampaignState),
        load: vi.fn(),
        processMissionResult: vi.fn(),
        save: vi.fn(),
        startNewCampaign: vi.fn((_seed, _diff, _pause, _theme) => {
          currentCampaignState = {
            status: "Active",
            nodes: [
              {
                id: "node-1",
                type: "Combat",
                status: "Accessible",
                difficulty: 1,
                mapSeed: 123,
                connections: [],
                position: { x: 0, y: 0 },
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
                soldierAim: 80,
                equipment: {
                  rightHand: "pulse_rifle",
                  leftHand: null,
                  body: "basic_armor",
                  feet: null,
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
              allowTacticalPause: true,
              themeId: "default",
              mode: "Preset",
              difficulty: "normal",
              deathRule: "Simulation",
              mapGeneratorType: "DenseShip",
              difficultyScaling: 1,
              resourceScarcity: 1,
            },
          };
        }),
        reset: vi.fn(() => {
          currentCampaignState = null;
        }),
        deleteSave: vi.fn(() => {
          currentCampaignState = null;
        }),
        healSoldier: vi.fn(),
        recruitSoldier: vi.fn(),
        assignEquipment: vi.fn(),
        applyEventChoice: vi.fn(),
        advanceCampaignWithoutMission: vi.fn(),
      }),
    },
  };
});

describe("Regression: Campaign Shell Visibility (voidlock-tbuh)", () => {
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

    // Set up DOM
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
        <button id="btn-menu-custom">Custom Mission</button>
        <button id="btn-menu-statistics">Statistics</button>
        <button id="btn-menu-reset">Reset Data</button>
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

      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="mission-setup-context"></div>
        <div id="map-config-section">
          <select id="map-generator-type">
            <option value="Procedural">Procedural</option>
          </select>
          <input type="number" id="map-seed" />
          <div id="preset-map-controls">
            <input type="number" id="map-width" value="14" />
            <input type="number" id="map-height" value="14" />
            <input type="number" id="map-spawn-points" value="1" />
            <input type="range" id="map-starting-threat" value="0" />
            <span id="map-starting-threat-value">0</span>
            <input type="range" id="map-base-enemies" value="3" />
            <input type="range" id="map-enemy-growth" value="1.0" />
          </div>
        </div>
        <div id="unit-style-preview"></div>
        <div id="squad-builder"></div>
        <button id="btn-goto-equipment">Equipment</button>
        <button id="btn-setup-back">Back</button>
      </div>
      <div id="screen-mission" class="screen" style="display:none">
        <div id="top-bar">
          <div id="game-status"></div>
          <div id="top-threat-fill"></div>
          <div id="top-threat-value">0%</div>
          <button id="btn-pause-toggle">Pause</button>
          <input type="range" id="game-speed" />
          <span id="speed-value">1.0x</span>
          <button id="btn-give-up">Give Up</button>
        </div>
        <div id="soldier-list"></div>
        <canvas id="game-canvas"></canvas>
        <div id="right-panel"></div>
      </div>
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

  it("should hide campaign shell when entering mission setup from campaign screen", async () => {
    const shell = document.getElementById("screen-campaign-shell");
    const missionSetup = document.getElementById("screen-mission-setup");

    // 1. Main Menu -> Campaign (Initial wizard)
    document.getElementById("btn-menu-campaign")?.click();
    expect(shell?.style.display).toBe("flex");

    // 2. Start Campaign
    const startBtn = document.querySelector(
      ".campaign-setup-wizard .primary-button",
    ) as HTMLElement;
    startBtn.click();
    expect(shell?.style.display).toBe("flex");

    // 3. Click an accessible node
    const nodeEl = document.querySelector(
      ".campaign-node.accessible",
    ) as HTMLElement;
    expect(nodeEl).toBeTruthy();
    nodeEl.click();

    // 4. Verify we are on Equipment screen (skipping Mission Setup)
    const equipment = document.getElementById("screen-equipment");
    expect(equipment?.style.display).toBe("flex");

    // Spec 8.5: Campaign Mode MUST be rendered within the CampaignShell
    expect(shell?.style.display).toBe("flex");
  });
});
