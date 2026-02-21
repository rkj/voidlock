/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MissionSetupManager } from "@src/renderer/app/MissionSetupManager";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { MissionType } from "@src/shared/types";

vi.mock("@src/renderer/visuals/AssetManager", () => ({
  AssetManager: {
    getInstance: vi.fn().mockReturnValue({
      getUnitSprite: vi.fn().mockReturnValue({ complete: true }),
      getEnemySprite: vi.fn().mockReturnValue({ complete: true }),
      getMiscSprite: vi.fn().mockReturnValue({ complete: true }),
      getIcon: vi.fn().mockReturnValue({ complete: true }),
    }),
  },
}));

vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
      getColor: vi.fn().mockReturnValue("#000000"),
    }),
  },
}));

vi.mock("@src/renderer/ConfigManager", () => {
  const defaults = {
    mapWidth: 10,
    mapHeight: 10,
    spawnPointCount: 3,
    fogOfWarEnabled: true,
    debugOverlayEnabled: false,
    losOverlayEnabled: false,
    agentControlEnabled: true,
    allowTacticalPause: true,
    unitStyle: "TacticalIcons",
    mapGeneratorType: "DenseShip",
    missionType: "Default",
    lastSeed: 12345,
    themeId: "default",
    startingThreatLevel: 0,
    baseEnemyCount: 3,
    enemyGrowthPerMission: 1,
    bonusLootCount: 0,
    manualDeployment: true,
    squadConfig: { soldiers: [], inventory: {} },
  };
  return {
    ConfigManager: {
      getDefault: vi.fn().mockReturnValue(defaults),
      loadCustom: vi.fn().mockReturnValue(null),
      loadCampaign: vi.fn().mockReturnValue(null),
      loadGlobal: vi
        .fn()
        .mockReturnValue({ unitStyle: "TacticalIcons", themeId: "default" }),
      saveCustom: vi.fn(),
      saveCampaign: vi.fn(),
      saveGlobal: vi.fn(),
      loadGlobalConfig: vi.fn().mockReturnValue({}),
    },
  };
});

describe("MissionSetupManager - Seed Overwrite Repro (voidlock-82zwg)", () => {
  let manager: MissionSetupManager;
  let context: any;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="mission-setup-context"></div>
      <h1 id="mission-setup-title"></h1>
      <button id="btn-goto-equipment"></button>
      <div id="map-config-section">
        <input id="map-seed" />
        <input id="map-width" />
        <input id="map-height" />
        <input id="map-spawn-points" />
        <select id="map-generator-type"></select>
        <select id="mission-type"></select>
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
    `;

    context = {
      campaignManager: {
        getState: vi.fn().mockReturnValue({
          rules: {
            difficulty: "Standard",
            allowTacticalPause: true,
            mapGeneratorType: "DenseShip",
          },
          history: [],
          currentSector: 1,
          roster: [],
        }),
      },
      themeManager: {
        setTheme: vi.fn(),
      },
      modalService: {
        alert: vi.fn(),
      },
    };

    manager = new MissionSetupManager(
      context.campaignManager,
      context.themeManager,
      context.modalService,
    );
  });

  it("should NOT overwrite node seed with stale LocalStorage seed in loadAndApplyConfig", () => {
    const nodeSeed = 99999;
    const staleSeed = 11111;

    // 1. Set the campaign node
    const node = { id: "node-1", mapSeed: nodeSeed } as any;
    manager.currentCampaignNode = node;

    // 2. Mock ConfigManager to return a STALE config
    (ConfigManager.loadCampaign as any).mockReturnValue({
      lastSeed: staleSeed,
      mapWidth: 10,
      mapHeight: 10,
      squadConfig: { soldiers: [], inventory: {} },
      missionType: MissionType.Default,
      mapGeneratorType: "DenseShip",
    });

    // 3. Call loadAndApplyConfig(true) - this is what happens when navigating back to Mission Setup
    manager.loadAndApplyConfig(true);

    // VERIFICATION: currentSeed should still be 99999, NOT 11111
    expect(manager.currentSeed).toBe(nodeSeed);
    
    // UI verification
    const seedInput = document.getElementById("map-seed") as HTMLInputElement;
    expect(seedInput.value).toBe(nodeSeed.toString());
  });

  it("should prioritize CampaignNode derived size and spawn points in loadAndApplyConfig", () => {
    const nodeRank = 3; // Should result in 9x9 map (6 + floor(3*1.0))
    const expectedSize = 9;
    const expectedSpawnPoints = 2; // 1 + floor((9-6)/2)

    // 1. Set the campaign node
    const node = { id: "node-1", mapSeed: 12345, rank: nodeRank } as any;
    manager.currentCampaignNode = node;

    // 2. Mock ConfigManager to return a STALE config (e.g. 10x10)
    (ConfigManager.loadCampaign as any).mockReturnValue({
      lastSeed: 12345,
      mapWidth: 10,
      mapHeight: 10,
      spawnPointCount: 3,
      squadConfig: { soldiers: [], inventory: {} },
      missionType: MissionType.Default,
      mapGeneratorType: "DenseShip",
    });

    // 3. Call loadAndApplyConfig(true)
    manager.loadAndApplyConfig(true);

    // This will likely fail currently if it only loads from config
    expect(manager.currentMapWidth).toBe(expectedSize);
    expect(manager.currentMapHeight).toBe(expectedSize);
    expect(manager.currentSpawnPointCount).toBe(expectedSpawnPoints);
  });

  it("should correctly initialize from node even if loadAndApplyConfig is called first", () => {
     const nodeSeed = 99999;
     const node = { id: "node-1", mapSeed: nodeSeed } as any;
     
     // Stale data in localStorage
     (ConfigManager.loadCampaign as any).mockReturnValue({
       lastSeed: 123,
       mapWidth: 10,
       mapHeight: 10,
       squadConfig: { soldiers: [], inventory: {} },
     });

     manager.prepareMissionSetup(node, 12, 5);

     expect(manager.currentSeed).toBe(nodeSeed);
     expect(manager.currentMapWidth).toBe(12);
     
     const seedInput = document.getElementById("map-seed") as HTMLInputElement;
     expect(seedInput.value).toBe(nodeSeed.toString());
  });
});
