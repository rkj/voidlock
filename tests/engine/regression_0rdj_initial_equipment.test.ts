import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { StorageProvider } from "@src/engine/persistence/StorageProvider";

class MockStorage implements StorageProvider {
  private data: Record<string, any> = {};
  save(key: string, data: any): void { this.data[key] = data; }
  load<T>(key: string): T | null { return this.data[key] || null; }
  remove(key: string): void { delete this.data[key]; }
  clear(): void { this.data = {}; }
}

describe("CampaignManager Regression: Initial Roster Equipment", () => {
  beforeEach(() => {
    CampaignManager.resetInstance();
  });

  it("should populate initial roster with default equipment", () => {
    const storage = new MockStorage();
    const manager = CampaignManager.getInstance(storage);
    manager.startNewCampaign(123, "normal");
    
    const state = manager.getState();
    expect(state).not.toBeNull();
    expect(state!.roster.length).toBe(4);
    
    state!.roster.forEach(soldier => {
      expect(soldier.equipment).not.toEqual({});
      expect(soldier.equipment.rightHand).toBeDefined();
    });
  });
});
