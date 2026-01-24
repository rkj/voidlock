/**
 * Interface for persistent storage.
 * Allows the CampaignManager to be agnostic of the storage medium (LocalStorage, File, etc.)
 */
export interface StorageProvider {
  /**
   * Save data to storage.
   * @param key Unique key for the data.
   * @param data Data to save (will be serialized to JSON).
   */
  save(key: string, data: unknown): void;

  /**
   * Load data from storage.
   * @param key Unique key for the data.
   * @returns The parsed data, or null if not found.
   */
  load<T>(key: string): T | null;

  /**
   * Remove data from storage.
   * @param key Unique key for the data.
   */
  remove(key: string): void;

  /**
   * Clear all data from storage.
   */
  clear(): void;
}
