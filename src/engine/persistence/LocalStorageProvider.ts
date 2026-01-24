import { StorageProvider } from "./StorageProvider";

/**
 * StorageProvider implementation using browser's LocalStorage.
 */
export class LocalStorageProvider implements StorageProvider {
  public save(key: string, data: unknown): void {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(key, json);
    } catch (e) {
      console.error(`LocalStorageProvider: Failed to save key "${key}"`, e);
    }
  }

  public load<T>(key: string): T | null {
    try {
      const json = localStorage.getItem(key);
      if (json === null) return null;
      return JSON.parse(json) as T;
    } catch (e) {
      console.error(`LocalStorageProvider: Failed to load key "${key}"`, e);
      return null;
    }
  }

  public remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`LocalStorageProvider: Failed to remove key "${key}"`, e);
    }
  }

  public clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.error("LocalStorageProvider: Failed to clear", e);
    }
  }
}
