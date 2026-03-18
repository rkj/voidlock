import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaveManager } from "@src/services/SaveManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { CloudSyncService } from "@src/services/CloudSyncService";
import { CampaignState } from "@src/shared/campaign_types";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";
import { MapGeneratorType } from "@src/shared/types";

// Mock CloudSyncService with controlled delay
vi.mock("@src/services/CloudSyncService", () => {
  return {
    CloudSyncService: vi.fn().mockImplementation(() => ({
      saveCampaign: vi.fn(),
      loadCampaign: vi.fn(),
      initialize: vi.fn(),
      isSyncEnabled: vi.fn().mockReturnValue(true),
    })),
  };
});

describe("Regression: WriteQueue (voidlock-ntp72)", () => {
  let saveManager: SaveManager;
  let mockLocalStorage: MockStorageProvider;
  let mockCloudSync: any;

  const mockCampaign: CampaignState = {
    version: "1.0.0",
    saveVersion: 1,
    lastModifiedAt: 0,
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
      skipPrologue: false,
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

  it("should coalesce multiple rapid saves and only sync the latest", async () => {
    // Setup a delayed mock for saveCampaign
    let resolver: (v: void) => void;
    const promise = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    mockCloudSync.saveCampaign.mockReturnValue(promise);

    // Trigger first save
    saveManager.save(CAMPAIGN_DEFAULTS.STORAGE_KEY, { ...mockCampaign, scrap: 100 });
    
    // Trigger second and third saves rapidly
    saveManager.save(CAMPAIGN_DEFAULTS.STORAGE_KEY, { ...mockCampaign, scrap: 200 });
    saveManager.save(CAMPAIGN_DEFAULTS.STORAGE_KEY, { ...mockCampaign, scrap: 300 });

    // First call should have happened immediately
    expect(mockCloudSync.saveCampaign).toHaveBeenCalledTimes(1);
    expect(mockCloudSync.saveCampaign).toHaveBeenNthCalledWith(
      1,
      CAMPAIGN_DEFAULTS.STORAGE_KEY,
      expect.objectContaining({ scrap: 100 })
    );

    // Resolve the first save
    // @ts-ignore
    resolver!();
    await vi.waitFor(() => mockCloudSync.saveCampaign.mock.calls.length >= 2);

    // After resolving first save, the queue should have processed the LATEST data (300)
    // and skipped the intermediate data (200)
    expect(mockCloudSync.saveCampaign).toHaveBeenCalledTimes(2);
    expect(mockCloudSync.saveCampaign).toHaveBeenNthCalledWith(
      2,
      CAMPAIGN_DEFAULTS.STORAGE_KEY,
      expect.objectContaining({ scrap: 300 })
    );
  });

  it("should report 'syncing' status when queue is busy", async () => {
    // Setup a delayed mock
    let resolver: (v: void) => void;
    const promise = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    mockCloudSync.saveCampaign.mockReturnValue(promise);

    expect(saveManager.getSyncStatus()).toBe("synced");

    saveManager.save(CAMPAIGN_DEFAULTS.STORAGE_KEY, mockCampaign);
    expect(saveManager.getSyncStatus()).toBe("syncing");

    // Add more to queue
    saveManager.save(CAMPAIGN_DEFAULTS.STORAGE_KEY, { ...mockCampaign, scrap: 500 });
    expect(saveManager.getSyncStatus()).toBe("syncing");

    // Resolve
    // @ts-ignore
    resolver!();
    
    // Wait for internal loop to finish (requires one tick for the while loop to re-check)
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(saveManager.getSyncStatus()).toBe("synced");
  });
});
