import type { MetaStats } from "../../shared/campaign_types";
import type { StorageProvider } from "../persistence/StorageProvider";
import { CAMPAIGN_DEFAULTS } from "../config/CampaignDefaults";
import { MetaStatsSchema } from "../../shared/schemas";
import { Logger } from "../../shared/Logger";

const STORAGE_KEY = CAMPAIGN_DEFAULTS.META_STORAGE_KEY;

/**
 * Manages global statistics tracked across all campaigns.
 */
export class MetaManager {
  private storage: StorageProvider;
  private stats: MetaStats;

  /**
   * @param storage The storage provider to use for persistence.
   */
  public constructor(storage: StorageProvider) {
    this.storage = storage;
    this.stats = this.loadInitialStats();
  }

  private loadInitialStats(): MetaStats {
    try {
      const data = this.storage.load<unknown>(STORAGE_KEY);
      const result = MetaStatsSchema.safeParse(data || {});
      if (result.success) {
        return result.data as MetaStats;
      } 
        Logger.warn(
          "MetaManager: Validation failed, using defaults.",
          result.error.format(),
        );
        return MetaStatsSchema.parse({});
      
    } catch (e) {
      Logger.warn("MetaManager: Failed to load global statistics.", e);
      return MetaStatsSchema.parse({});
    }
  }

  /**
   * Sets the storage provider to use.
   */
  public setStorage(storage: StorageProvider): void {
    this.storage = storage;
  }

  /**
   * Resets the statistics to defaults.
   */
  public reset(): void {
    this.stats = MetaStatsSchema.parse({});
    this.save();
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
   * Records that the prologue mission has been completed.
   */
  public recordPrologueCompleted(): void {
    this.stats.prologueCompleted = true;
    this.save();
  }

  /**
   * Updates combat and economy statistics from a mission.
   */
  public recordMissionResult({
    kills,
    casualties,
    won,
    scrapGained,
    intelGained = 0,
  }: {
    kills: number;
    casualties: number;
    won: boolean;
    scrapGained: number;
    intelGained?: number;
  }): void {
    this.stats.totalKills += kills;
    this.stats.totalCasualties += casualties;
    this.stats.totalMissionsPlayed++;
    if (won) {
      this.stats.totalMissionsWon++;
    }
    this.stats.totalScrapEarned += scrapGained;
    this.stats.currentIntel += intelGained;
    this.save();
  }

  /**
   * Spends the given amount of intel.
   * @param amount The amount of intel to spend.
   */
  public spendIntel(amount: number): void {
    if (this.stats.currentIntel < amount) {
      throw new Error(
        `MetaManager: Insufficient intel: need ${amount}, have ${this.stats.currentIntel}`,
      );
    }
    this.stats.currentIntel -= amount;
    this.save();
  }

  /**
   * Unlocks a new archetype by spending intel.
   * @param archetypeId The ID of the archetype to unlock.
   * @param cost The cost in intel.
   */
  public unlockArchetype(archetypeId: string, cost: number): void {
    if (this.isArchetypeUnlocked(archetypeId)) return;
    this.spendIntel(cost);
    this.stats.unlockedArchetypes.push(archetypeId);
    this.save();
  }

  /**
   * Unlocks a new item license by spending intel.
   * @param itemId The ID of the item to unlock.
   * @param cost The cost in intel.
   */
  public unlockItem(itemId: string, cost: number): void {
    if (this.isItemUnlocked(itemId)) return;
    this.spendIntel(cost);
    this.stats.unlockedItems.push(itemId);
    this.save();
  }

  /**
   * Checks if an archetype is globally unlocked.
   * @param archetypeId The ID of the archetype.
   */
  public isArchetypeUnlocked(archetypeId: string): boolean {
    return this.stats.unlockedArchetypes.includes(archetypeId);
  }

  /**
   * Checks if an item is globally unlocked.
   * @param itemId The ID of the item.
   */
  public isItemUnlocked(itemId: string): boolean {
    return this.stats.unlockedItems.includes(itemId);
  }

  /**
   * Persists the current statistics to storage.
   */
  private save(): void {
    this.storage.save(STORAGE_KEY, this.stats);
  }
}
