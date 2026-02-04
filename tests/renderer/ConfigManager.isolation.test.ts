// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigManager, GameConfig } from "@src/renderer/ConfigManager";
import { MapGeneratorType, MissionType } from "@src/shared/types";

describe("ConfigManager Isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const createDummyConfig = (seed: number): GameConfig => ({
    mapWidth: 10,
    mapHeight: 10,
    spawnPointCount: 1,
    fogOfWarEnabled: true,
    debugOverlayEnabled: false,
    losOverlayEnabled: false,
    agentControlEnabled: true,
    allowTacticalPause: true,
    mapGeneratorType: MapGeneratorType.Procedural,
    missionType: MissionType.Default,
    lastSeed: seed,
    startingThreatLevel: 0,
    baseEnemyCount: 3,
    enemyGrowthPerMission: 1,
    bonusLootCount: 0,
    manualDeployment: false,
    squadConfig: {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    },
  });

  it("should store custom and campaign configs separately", () => {
    const customConfig = createDummyConfig(111);
    const campaignConfig = createDummyConfig(999);

    ConfigManager.saveCustom(customConfig);
    ConfigManager.saveCampaign(campaignConfig);

    const loadedCustom = ConfigManager.loadCustom();
    const loadedCampaign = ConfigManager.loadCampaign();

    expect(loadedCustom?.lastSeed).toBe(111);
    expect(loadedCampaign?.lastSeed).toBe(999);
  });

  it("should not overwrite custom config when saving campaign config", () => {
    const customConfig = createDummyConfig(111);
    ConfigManager.saveCustom(customConfig);

    const campaignConfig = createDummyConfig(999);
    ConfigManager.saveCampaign(campaignConfig);

    const loadedCustom = ConfigManager.loadCustom();
    expect(loadedCustom?.lastSeed).toBe(111);
  });

  it("should load default if no config exists for that type", () => {
    const customConfig = createDummyConfig(111);
    ConfigManager.saveCustom(customConfig);

    const loadedCampaign = ConfigManager.loadCampaign();
    expect(loadedCampaign).toBeNull();
  });

  it("should clear campaign config when clearCampaign is called", () => {
    const campaignConfig = createDummyConfig(999);
    ConfigManager.saveCampaign(campaignConfig);

    expect(ConfigManager.loadCampaign()).not.toBeNull();

    ConfigManager.clearCampaign();

    expect(ConfigManager.loadCampaign()).toBeNull();
  });
});
