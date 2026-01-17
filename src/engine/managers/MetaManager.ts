import { MetaStats } from "../../shared/campaign_types";
import { StorageProvider } from "../persistence/StorageProvider";

const STORAGE_KEY = "voidlock_meta_v1";

/**
 * Manages global statistics tracked across all campaigns.
 */
export class MetaManager {
  private static instance: MetaManager | null = null;
  private storage: StorageProvider;
  private stats: MetaStats;

  /**
   * Private constructor to enforce singleton pattern.
   * @param storage The storage provider to use for persistence.
   */
  private constructor(storage: StorageProvider) {
    this.storage = storage;
    this.stats = this.loadInitialStats();
  }

  /**
   * Returns the singleton instance of the MetaManager.
   * @param storage Optional storage provider (required for first call).
   */
  public static getInstance(storage?: StorageProvider): MetaManager {
    if (!MetaManager.instance) {
      if (!storage) {
        throw new Error(
          "MetaManager: StorageProvider required for first initialization.",
        );
      }
      MetaManager.instance = new MetaManager(storage);
    }
    return MetaManager.instance;
  }

  /**
   * Reset the singleton instance (useful for tests).
   */
  public static resetInstance(): void {
    MetaManager.instance = null;
  }

  private loadInitialStats(): MetaStats {
    const data = this.storage.load<MetaStats>(STORAGE_KEY);
    if (data) {
      return data;
    }
    return {
      totalCampaignsStarted: 0,
      campaignsWon: 0,
      campaignsLost: 0,
      totalKills: 0,
      totalCasualties: 0,
      totalMissionsPlayed: 0,
      totalMissionsWon: 0,
      totalScrapEarned: 0,
    };
  }

  /**
   * Returns the current global statistics.
   */
  public getStats(): MetaStats {
    return { ...this.stats };
  }

  /**
   * Records that a new campaign has started.
   */
  public recordCampaignStarted(): void {
    this.stats.totalCampaignsStarted++;
    this.save();
  }

  /**
   * Records the final result of a campaign.
   * @param won Whether the campaign was won or lost.
   */
  public recordCampaignResult(won: boolean): void {
    if (won) {
      this.stats.campaignsWon++;
    } else {
      this.stats.campaignsLost++;
    }
    this.save();
  }

  /**
   * Updates combat and economy statistics from a mission.
   * @param kills Number of enemies killed in the mission.
   * @param casualties Number of soldiers killed in the mission.
   * @param won Whether the mission was won.
   * @param scrapGained Amount of scrap earned in the mission.
   */
  public recordMissionResult(
    kills: number,
    casualties: number,
    won: boolean,
    scrapGained: number,
  ): void {
    this.stats.totalKills += kills;
    this.stats.totalCasualties += casualties;
    this.stats.totalMissionsPlayed++;
    if (won) {
      this.stats.totalMissionsWon++;
    }
    this.stats.totalScrapEarned += scrapGained;
    this.save();
  }

  /**
   * Persists the current statistics to storage.
   */
  private save(): void {
    this.storage.save(STORAGE_KEY, this.stats);
  }
}
