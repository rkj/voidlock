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
    onStateUpdate: vi.fn(),
    queryState: vi.fn(),
    addStateUpdateListener: vi.fn(),
    removeStateUpdateListener: vi.fn(),
    init: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    stop: vi.fn(),
    freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
    setTimeScale: vi.fn(),
    getTimeScale: vi.fn().mockReturnValue(1.0),
  })),
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

vi.mock("@src/renderer/visuals/AssetManager", () => {
  const mockInstance = {
    loadSprites: vi.fn(),
    getUnitSprite: vi.fn(),
    getEnemySprite: vi.fn(),
    getMiscSprite: vi.fn(),
    getIcon: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return {
    AssetManager: mockConstructor,
  };
});

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    getDefault: vi.fn().mockReturnValue({
        mapWidth: 10,
        mapHeight: 10,
        spawnPointCount: 3,
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        losOverlayEnabled: false,
        agentControlEnabled: true,
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        missionType: "Default",
        lastSeed: 123,
        squadConfig: { soldiers: [], inventory: {} },
        startingThreatLevel: 0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        bonusLootCount: 0,
        debugSnapshotInterval: 0,
        manualDeployment: true,
    }),
    loadGlobal: vi.fn().mockReturnValue({ logLevel: "INFO", cloudSyncEnabled: false, unitStyle: "TacticalIcons", themeId: "default" }),
    loadCustom: vi.fn().mockReturnValue({
        mapWidth: 10,
        mapHeight: 10,
        spawnPointCount: 3,
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        losOverlayEnabled: false,
        agentControlEnabled: true,
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        missionType: "Default",
        lastSeed: 123,
        squadConfig: { soldiers: [], inventory: {} },
        startingThreatLevel: 0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        bonusLootCount: 0,
        debugSnapshotInterval: 0,
        manualDeployment: true,
    }),
    saveCustom: vi.fn(),
    loadCampaign: vi.fn(),
    saveCampaign: vi.fn(),
  }
}));

describe("GameApp Map Generator Repro", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-custom">Custom</button>
        </div>
        <div id="screen-campaign-shell" style="display:none">
            <div id="campaign-shell-content">
                <div id="screen-campaign" style="display:none"></div>
                <div id="screen-equipment" style="display:none"></div>
                <div id="screen-engineering" style="display:none"></div>
                <div id="screen-statistics" style="display:none"></div>
                <div id="screen-settings" style="display:none"></div>
            </div>
            <div id="campaign-shell-top-bar"></div>
            <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-mission-setup" class="screen h-full" style="display:none">
            <select id="map-generator-type">
                <option value="DenseShip">Dense</option>
                <option value="TreeShip">Tree</option>
                <option value="Spaceship">Spaceship</option>
            </select>
            <div id="unit-style-preview"></div>
            <div id="squad-builder"></div>
            <button id="btn-launch-mission">Launch</button>
            <button id="btn-goto-equipment">Equipment</button>
            <button id="btn-setup-back">Back</button>
            <select id="mission-type"><option value="Default">Default</option></select>
            <input type="checkbox" id="toggle-fog-of-war" />
            <input type="checkbox" id="toggle-debug-overlay" />
            <input type="checkbox" id="toggle-los-overlay" />
            <input type="checkbox" id="toggle-agent-control" />
            <input type="checkbox" id="toggle-manual-deployment" />
            <input type="checkbox" id="toggle-allow-tactical-pause" />
            <input type="number" id="map-width" value="10" />
            <input type="number" id="map-height" value="10" />
            <input type="number" id="map-spawn-points" value="3" />
            <input type="range" id="map-starting-threat" value="0" />
            <input type="range" id="map-base-enemies" value="3" />
            <input type="range" id="map-enemy-growth" value="1" />
        </div>
        <div id="screen-mission" style="display:none"></div>
        <div id="screen-debrief" style="display:none"></div>
        <div id="screen-campaign-summary" style="display:none"></div>
        <div id="keyboard-help-overlay" style="display:none"></div>
      </div>
    `;

    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    app = await bootstrap();
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should call ConfigManager.saveCustom when map generator type changes", async () => {
    // Navigate to Setup
    document.getElementById("btn-menu-custom")?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mapGenSelect = document.getElementById(
      "map-generator-type",
    ) as HTMLSelectElement;
    expect(mapGenSelect).toBeTruthy();

    // Simulate change to TreeShip
    mapGenSelect.value = MapGeneratorType.TreeShip;
    mapGenSelect.dispatchEvent(new Event("change"));

    // Verify ConfigManager.saveCustom was called
    expect(ConfigManager.saveCustom).toHaveBeenCalled();

    // Check if the saved config has the correct generator type
    const lastCall = vi.mocked(ConfigManager.saveCustom).mock.calls[0][0];
    expect(lastCall.mapGeneratorType).toBe(MapGeneratorType.TreeShip);
  });
});
