/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing main.ts
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

// We need a way to trigger the GameClient callbacks
let stateUpdateCallback: ((state: any) => void) | null = null;

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn((cb) => {
    stateUpdateCallback = cb;
  }),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({}),
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
  show: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

// Mock CampaignManager
const mockCampaignState = null; // No active campaign

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => mockCampaignState),
        load: vi.fn(),
        processMissionResult: vi.fn(),
        save: vi.fn(),
        startNewCampaign: vi.fn(),
        reset: vi.fn(),
        deleteSave: vi.fn(),
        assignEquipment: vi.fn(),
      }),
    },
  };
});

describe("Replay Button Flow Integration", () => {
  beforeEach(async () => {
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
        <div id="map-config-section">
          <select id="map-generator-type">
            <option value="DenseShip">Dense Ship</option>
          </select>
          <input type="number" id="map-seed" />
          <div id="preset-map-controls">
            <input type="number" id="map-width" value="10" />
            <input type="number" id="map-height" value="10" />
            <input type="number" id="map-spawn-points" value="1" />
            <input type="range" id="map-starting-threat" value="0" />
            <span id="map-starting-threat-value">0</span>
          </div>
        </div>
        <div id="unit-style-preview"></div>
        <div id="squad-builder"></div>
        <button id="btn-launch-mission" class="primary-button">Launch Mission</button>
        <button id="btn-goto-equipment">Equipment</button>
        <button id="btn-setup-back">Back</button>
      </div>
      <div id="screen-equipment" class="screen" style="display:none"></div>
      <div id="screen-mission" class="screen" style="display:none">
        <div id="top-bar" style="display:none"></div>
        <div id="soldier-panel" style="display:none"></div>
        <div id="right-panel" style="display:none"></div>
      </div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
      <div id="screen-statistics" class="screen" style="display:none"></div>
      <div id="screen-settings" class="screen" style="display:none"></div>
      <div id="modal-container"></div>
    `;

    // Mock window.confirm
    window.confirm = vi.fn().mockReturnValue(true);
    // Mock window.alert
    window.alert = vi.fn();

    localStorage.clear();

    // Import main.ts
    vi.resetModules();
    await import("@src/renderer/main");

    // Trigger DOMContentLoaded
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should show Replay Mission button in custom mode and relaunch mission when clicked", async () => {
    // 1. Main Menu -> Mission Setup
    const btnCustom = document.getElementById("btn-menu-custom");
    btnCustom?.click();
    expect(document.getElementById("screen-mission-setup")?.style.display).toBe(
      "flex",
    );

    // 2. Mission Setup -> Mission (through Equipment)
    const btnGotoEquipment = document.getElementById(
      "btn-goto-equipment",
    ) as HTMLButtonElement;
    btnGotoEquipment.click();

    const allButtons = document.querySelectorAll("#screen-equipment button");
    const equipmentLaunchBtn = Array.from(allButtons).find((b) =>
      b.textContent?.includes("Confirm"),
    ) as HTMLElement;
    equipmentLaunchBtn?.click();

    // Now in mission-setup, click Launch
    document.getElementById("btn-launch-mission")?.click();

    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );
    expect(mockGameClient.init).toHaveBeenCalledTimes(1);
    const firstCallSeed = mockGameClient.init.mock.calls[0][0];

    // 3. Mission -> Win
    expect(stateUpdateCallback).not.toBeNull();
    stateUpdateCallback!({
      status: "Won",
      t: 10,
      stats: { aliensKilled: 5, scrapGained: 100, threatLevel: 0 },
      units: [],
      objectives: [],
      settings: {
        debugOverlayEnabled: false,
        debugSnapshots: false,
        timeScale: 1.0,
        isPaused: false,
      },
      map: { width: 10, height: 10, cells: [] },
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
      seed: firstCallSeed,
    });

    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );

    // 4. Verify Replay Mission button exists
    const replayBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent === "REPLAY MISSION") as HTMLElement;
    expect(replayBtn).toBeDefined();

    // 5. Click Replay Mission
    replayBtn.click();

    // 6. Verify Mission relaunched with same seed
    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );
    expect(mockGameClient.init).toHaveBeenCalledTimes(2);
    expect(mockGameClient.init.mock.calls[1][0]).toBe(firstCallSeed);
  });
});
