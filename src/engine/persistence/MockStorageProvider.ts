import { StorageProvider } from "./StorageProvider";

/**
 * In-memory StorageProvider implementation for testing.
 */
export class MockStorageProvider implements StorageProvider {
  private storage: Map<string, string> = new Map();

  public save(key: string, data: unknown): void {
    this.storage.set(key, JSON.stringify(data));
  }

  public load<T>(key: string): T | null {
    const json = this.storage.get(key);
    if (json === undefined) return null;
    return JSON.parse(json) as T;
  }

  public remove(key: string): void {
    this.storage.delete(key);
  }

  public clear(): void {
    this.storage.clear();
  }
}
