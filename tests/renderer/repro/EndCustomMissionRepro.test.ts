/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameState, EngineMode, MissionType } from "@src/shared/types";
import { CampaignManager } from "@src/engine/campaign/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    setCellSize: vi.fn(),
    setUnitStyle: vi.fn(),
    setOverlay: vi.fn(),
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

// Trigger for GameClient callbacks
let stateUpdateCallback: ((state: GameState) => void) | null = null;

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn((cb) => {
    stateUpdateCallback = cb;
  }),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
  stop: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commandLog: [] }),
  loadReplay: vi.fn(),
  setTimeScale: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
};

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => mockGameClient),
}));

vi.mock("@src/services/firebase", () => ({
  db: {},
  auth: {},
  app: {},
  isFirebaseConfigured: false,
}));

describe("End Custom Mission Repro", () => {
  beforeEach(async () => {
    stateUpdateCallback = null;
    CampaignManager.resetInstance();
    CampaignManager.getInstance(new MockStorageProvider());

    // Set up DOM
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-custom">Custom Mission</button>
      </div>
      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="unit-style-preview"></div>
        <div id="map-config-section">
           <select id="map-generator-type"><option value="DenseShip">DenseShip</option></select>
           <input type="number" id="map-seed" value="123" />
           <div id="preset-map-controls">
            <input type="number" id="map-width" value="10" />
            <input type="number" id="map-height" value="10" />
            <input type="number" id="map-spawn-points" value="1" />
            <input type="range" id="map-starting-threat" value="0" />
           </div>
        </div>
        <div id="squad-builder"></div>
        <button id="btn-launch-mission">Launch Mission</button>
        <button id="btn-goto-equipment">Equipment</button>
      </div>
      <div id="screen-equipment" class="screen" style="display:none"></div>
      <div id="screen-mission" class="screen" style="display:none">
        <canvas id="game-canvas"></canvas>
      </div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-shell" style="display:none"></div>
      <div id="screen-campaign" style="display:none"></div>
      <div id="screen-barracks" style="display:none"></div>
      <div id="screen-statistics" style="display:none"></div>
      <div id="screen-engineering" style="display:none"></div>
      <div id="screen-settings" style="display:none"></div>
      <div id="screen-campaign-summary" style="display:none"></div>
      <div id="time-scale-slider"></div>
    `;

    // Import main.ts to initialize GameApp
    vi.resetModules();
    await import("@src/renderer/main");
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should not throw error when ending a custom mission with no active campaign", async () => {
    // Verify campaign is NOT active
    expect(CampaignManager.getInstance().getState()).toBeNull();

    // 1. Navigate to Custom Mission
    document.getElementById("btn-menu-custom")?.click();

    // 2. Launch mission
    // (Simulate dblclick to select some units in squad builder if needed, but launch might work anyway)
    document.getElementById("btn-goto-equipment")?.click();
    const equipmentLaunchBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Confirm")) as HTMLElement;
    equipmentLaunchBtn?.click();

    // Now in mission-setup, click Launch Mission
    document.getElementById("btn-launch-mission")?.click();

    expect(stateUpdateCallback).not.toBeNull();

    // Mock processMissionResult to verify it's NOT called
    const processSpy = vi.spyOn(
      CampaignManager.getInstance(),
      "processMissionResult",
    );

    // 3. Simulate Mission Win
    // This should trigger the callback in GameApp which calls campaignManager.processMissionResult
    expect(() => {
      stateUpdateCallback!({
        status: "Won",
        t: 100,
        seed: 123,
        missionType: MissionType.Default,
        stats: {
          aliensKilled: 5,
          scrapGained: 50,
          threatLevel: 0,
          elitesKilled: 0,
          casualties: 0,
        },
        units: [],
        objectives: [],
        settings: {
          debugOverlayEnabled: false,
          debugSnapshots: false,
          timeScale: 1,
          isPaused: false,
          mode: EngineMode.Simulation,
          losOverlayEnabled: false,
          isSlowMotion: false,
          allowTacticalPause: true,
        },
        map: { width: 10, height: 10, cells: [] },
        enemies: [],
        visibleCells: [],
        discoveredCells: [],
        loot: [],
        mines: [],
        turrets: [],
        squadInventory: {},
      } as GameState);
    }).not.toThrow();

    expect(processSpy).not.toHaveBeenCalled();
  });
});
