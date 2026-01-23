/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { MapGeneratorType } from "@src/shared/types";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    onStateUpdate: vi.fn(),
    stop: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
    togglePause: vi.fn(),
    toggleDebugOverlay: vi.fn(),
    toggleLosOverlay: vi.fn(),
  })),
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
    }),
  },
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    saveCustom: vi.fn(),
    saveCampaign: vi.fn(),
    loadCustom: vi.fn().mockReturnValue({
      mapWidth: 14,
      mapHeight: 14,
      spawnPointCount: 5,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
      agentControlEnabled: true,
      allowTacticalPause: true,
      unitStyle: "TacticalIcons",
      mapGeneratorType: "Procedural",
      missionType: "Default",
      lastSeed: 12345,
      squadConfig: { soldiers: [], inventory: {} },
    }),
    loadCampaign: vi.fn().mockReturnValue(null),
    getDefault: vi.fn().mockReturnValue({
      mapWidth: 14,
      mapHeight: 14,
      spawnPointCount: 5,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
      agentControlEnabled: true,
      allowTacticalPause: true,
      unitStyle: "TacticalIcons",
      mapGeneratorType: "Procedural",
      missionType: "Default",
      lastSeed: 12345,
      squadConfig: { soldiers: [], inventory: {} },
    }),
  },
}));

describe("GameApp Map Generator Selection Repro", () => {
  let app: GameApp;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup DOM
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-custom">Custom Mission</button>
        <p id="menu-version"></p>
      </div>

      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-content">
              <div id="screen-campaign" class="screen"></div>
              <div id="screen-barracks" class="screen"></div>
              <div id="screen-equipment" class="screen"></div>
              <div id="screen-statistics" class="screen"></div>
          </div>
      </div>

      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="mission-setup-context"></div>
        <div id="map-config-section">
           <select id="map-generator-type">
             <option value="Procedural">Procedural</option>
           </select>
           <input id="map-seed" />
           <input id="map-width" />
           <input id="map-height" />
           <input id="map-spawn-points" />
           <span id="map-spawn-points-value"></span>
           <input id="map-starting-threat" />
           <span id="map-starting-threat-value"></span>
           <input id="map-base-enemies" />
           <span id="map-base-enemies-value"></span>
           <input id="map-enemy-growth" />
           <span id="map-enemy-growth-value"></span>
        </div>
        <div id="squad-builder"></div>
        <input id="toggle-fog-of-war" type="checkbox" />
        <input id="toggle-debug-overlay" type="checkbox" />
        <input id="toggle-los-overlay" type="checkbox" />
        <input id="toggle-agent-control" type="checkbox" />
        <input id="toggle-allow-tactical-pause" type="checkbox" />
        <select id="select-unit-style"></select>
        <button id="btn-goto-equipment"></button>
        <button id="btn-setup-back"></button>
      </div>

      <div id="screen-mission" class="screen" style="display:none">
        <button id="btn-pause-toggle"></button>
        <input id="game-speed" type="range" />
        <span id="speed-value"></span>
        <input id="time-scale-slider" type="range" />
        <span id="time-scale-value"></span>
        <button id="btn-give-up"></button>
        <canvas id="game-canvas"></canvas>
      </div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;

    app = new GameApp();
    await app.initialize();
  });

  it("should call ConfigManager.saveCustom when map generator type changes", () => {
    const mapGenSelect = document.getElementById("map-generator-type") as HTMLSelectElement;
    expect(mapGenSelect).toBeTruthy();

    // Verify it adds the missing options as per GameApp.ts
    // Procedural was already there, but TreeShip and DenseShip should have been added
    expect(mapGenSelect.options.length).toBeGreaterThanOrEqual(3);

    // Simulate change to TreeShip
    mapGenSelect.value = MapGeneratorType.TreeShip;
    mapGenSelect.dispatchEvent(new Event("change"));

    // Verify ConfigManager.saveCustom was called
    // (This is expected to fail currently as there's no listener)
    expect(ConfigManager.saveCustom).toHaveBeenCalled();
    
    // Check if the saved config has the correct generator type
    const lastCall = vi.mocked(ConfigManager.saveCustom).mock.calls[0][0];
    expect(lastCall.mapGeneratorType).toBe(MapGeneratorType.TreeShip);
  });
});
