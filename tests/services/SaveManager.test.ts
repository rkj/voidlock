import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaveManager } from "@src/services/SaveManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { CloudSyncService } from "@src/services/CloudSyncService";
import { CampaignState } from "@src/shared/campaign_types";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";
import { MapGeneratorType } from "@src/shared/types";

// Mock CloudSyncService
vi.mock("@src/services/CloudSyncService", () => {
  return {
    CloudSyncService: vi.fn().mockImplementation(() => ({
      saveCampaign: vi.fn().mockResolvedValue(undefined),
      loadCampaign: vi.fn().mockResolvedValue(null),
      initialize: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("SaveManager", () => {
  let saveManager: SaveManager;
  let mockLocalStorage: MockStorageProvider;
  let mockCloudSync: any;

  const mockCampaign: CampaignState = {
    version: "1.0.0",
    saveVersion: 1,
    seed: 123,
    status: "Active",
    rules: {
      mode: "Preset",
      difficulty: "Standard",
      deathRule: "Clone",
      allowTacticalPause: true,
      mapGeneratorType: MapGeneratorType.DenseShip,
      difficultyScaling: 1,
      resourceScarcity: 1,
      startingScrap: 500,
      mapGrowthRate: 1,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1,
      economyMode: "Open",
    },
    scrap: 100,
    intel: 50,
    currentSector: 1,
    currentNodeId: "node-1",
    nodes: [],
    roster: [],
    history: [],
    unlockedArchetypes: ["assault", "medic", "scout"],
    unlockedItems: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage = new MockStorageProvider();
    mockCloudSync = new CloudSyncService();
    saveManager = new SaveManager(mockLocalStorage, mockCloudSync);
  });

  it("should save locally immediately", () => {
    saveManager.save(CAMPAIGN_DEFAULTS.STORAGE_KEY, mockCampaign);
    expect(mockLocalStorage.load(CAMPAIGN_DEFAULTS.STORAGE_KEY)).toEqual(mockCampaign);
  });

  it("should trigger cloud sync on save", async () => {
    saveManager.save(CAMPAIGN_DEFAULTS.STORAGE_KEY, mockCampaign);
    // Wait for async cloud sync (we can't easily await it as it's fire-and-forget in save())
    // but since we mocked it, we can check if it was called.
    expect(mockCloudSync.saveCampaign).toHaveBeenCalledWith(CAMPAIGN_DEFAULTS.STORAGE_KEY, mockCampaign);
  });

  it("should load from local if cloud is missing", async () => {
    mockLocalStorage.save(CAMPAIGN_DEFAULTS.STORAGE_KEY, mockCampaign);
    mockCloudSync.loadCampaign.mockResolvedValue(null);

    const result = await saveManager.loadWithSync(CAMPAIGN_DEFAULTS.STORAGE_KEY);
    expect(result).toEqual(mockCampaign);
  });

  it("should resolve conflict by choosing newer version from cloud", async () => {
    const localCampaign = { ...mockCampaign, saveVersion: 1 };
    const cloudCampaign = { ...mockCampaign, saveVersion: 5, scrap: 999 };
    
    mockLocalStorage.save(CAMPAIGN_DEFAULTS.STORAGE_KEY, localCampaign);
    mockCloudSync.loadCampaign.mockResolvedValue(cloudCampaign);

    const result = await saveManager.loadWithSync(CAMPAIGN_DEFAULTS.STORAGE_KEY);
    expect(result).toEqual(cloudCampaign);
    expect(result?.saveVersion).toBe(5);
    expect(result?.scrap).toBe(999);
    
    // Should also update local storage
    expect(mockLocalStorage.load(CAMPAIGN_DEFAULTS.STORAGE_KEY)).toEqual(cloudCampaign);
  });

  it("should resolve conflict by choosing newer version from local", async () => {
    const localCampaign = { ...mockCampaign, saveVersion: 10, scrap: 777 };
    const cloudCampaign = { ...mockCampaign, saveVersion: 5, scrap: 999 };
    
    mockLocalStorage.save(CAMPAIGN_DEFAULTS.STORAGE_KEY, localCampaign);
    mockCloudSync.loadCampaign.mockResolvedValue(cloudCampaign);

    const result = await saveManager.loadWithSync(CAMPAIGN_DEFAULTS.STORAGE_KEY);
    expect(result).toEqual(localCampaign);
    expect(result?.saveVersion).toBe(10);
    expect(result?.scrap).toBe(777);
  });
});
