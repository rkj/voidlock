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

  /**
   * Optional: Returns the current synchronization status.
   */
  getSyncStatus?(): string;

  /**
   * Optional: Loads data from storage and optionally performs a cloud sync check.
   * @param key Unique key for the data.
   */
  loadWithSync?<T>(key: string): Promise<T | null>;

  /**
   * Optional: Returns the cloud sync service associated with this provider.
   */
  getCloudSync?(): unknown;
}
