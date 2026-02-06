import { StorageProvider } from "@src/engine/persistence/StorageProvider";
import { LocalStorageProvider } from "@src/engine/persistence/LocalStorageProvider";
import { CloudSyncService } from "./CloudSyncService";
import { CampaignState } from "@src/shared/campaign_types";
import { Logger } from "@src/shared/Logger";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";

/**
 * Manages game saves by wrapping LocalStorage (primary) and CloudSyncService (backup).
 * Implements a local-first, async-cloud strategy with conflict resolution.
 */
export class SaveManager implements StorageProvider {
  private localStorage: StorageProvider;
  private cloudSync: CloudSyncService;
  private syncInProgress: boolean = false;

  constructor(localStorage?: StorageProvider, cloudSync?: CloudSyncService) {
    this.localStorage = localStorage || new LocalStorageProvider();
    this.cloudSync = cloudSync || new CloudSyncService();
  }

  /**
   * Save data to storage. Always saves locally first for speed, then syncs to cloud.
   * @param key Unique key for the data.
   * @param data Data to save (will be serialized to JSON).
   */
  public save(key: string, data: unknown): void {
    // Always save locally first (fast, reliable)
    this.localStorage.save(key, data);

    // If it's the campaign save, trigger async cloud sync
    if (key === CAMPAIGN_DEFAULTS.STORAGE_KEY && data) {
      this.syncToCloud(key, data as CampaignState);
    }
  }

  /**
   * Load data from storage.
   * @param key Unique key for the data.
   * @returns The parsed data, or null if not found.
   */
  public load<T>(key: string): T | null {
    // Synchronous load only returns local data to prevent blocking
    return this.localStorage.load<T>(key);
  }

  /**
   * Loads data from storage and optionally performs a cloud sync check.
   * Use this during application startup or when explicit sync is desired.
   * @param key Unique key for the data.
   * @returns The latest data after conflict resolution.
   */
  public async loadWithSync<T>(key: string): Promise<T | null> {
    // Try local first (fast)
    const local = this.localStorage.load<T>(key);

    // Only sync campaign data to cloud
    if (key !== CAMPAIGN_DEFAULTS.STORAGE_KEY) {
      return local;
    }

    try {
      // Check cloud for newer version
      const cloud = await this.cloudSync.loadCampaign(key) as unknown as T;

      if (!local && !cloud) return null;
      if (!cloud) return local;
      if (!local) return cloud;

      // Conflict resolution
      const resolved = this.resolveConflict(local as CampaignState, cloud as CampaignState);
      
      // If cloud won, update local storage
      if (resolved === (cloud as unknown as CampaignState)) {
        this.localStorage.save(key, resolved);
      }

      return resolved as unknown as T;
    } catch (err) {
      Logger.warn("SaveManager: Failed to load from cloud, using local:", err);
      return local;
    }
  }

  /**
   * Remove data from storage.
   * @param key Unique key for the data.
   */
  public remove(key: string): void {
    this.localStorage.remove(key);
    // Note: Cloud deletion could be added here if needed, 
    // but usually we want to keep cloud backups even if local is cleared.
  }

  /**
   * Clear all data from storage.
   */
  public clear(): void {
    this.localStorage.clear();
  }

  /**
   * Performs async cloud sync.
   */
  private syncToCloud(campaignId: string, data: CampaignState): void {
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    this.cloudSync.saveCampaign(campaignId, data)
      .catch((err) => Logger.warn("SaveManager: Cloud sync failed:", err))
      .finally(() => {
        this.syncInProgress = false;
      });
  }

  /**
   * Resolves conflicts between local and cloud saves using version comparison.
   */
  private resolveConflict(
    local: CampaignState,
    cloud: CampaignState,
  ): CampaignState {
    const localVer = local.saveVersion || 0;
    const cloudVer = cloud.saveVersion || 0;

    if (cloudVer > localVer) {
      Logger.info(`SaveManager: Cloud save is newer (v${cloudVer} > v${localVer}). Using cloud save.`);
      return cloud;
    }

    if (localVer > cloudVer) {
      Logger.info(`SaveManager: Local save is newer (v${localVer} > v${cloudVer}). Cloud will be updated on next save.`);
    }

    return local;
  }
}
