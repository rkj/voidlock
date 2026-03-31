import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("Regression: lastModifiedAt (voidlock-gcgpl)", () => {
  let campaignManager: CampaignManager;
  let mockStorage: MockStorageProvider;

  beforeEach(() => {
    mockStorage = new MockStorageProvider();
    
    campaignManager = new CampaignManager(mockStorage, new MetaManager(new MockStorageProvider()));
  });

  it("should set lastModifiedAt when starting a new campaign", () => {
    const before = Date.now();
    campaignManager.startNewCampaign(12345, "Standard");
    const state = campaignManager.getState()!;
    const after = Date.now();

    expect(state.lastModifiedAt).toBeGreaterThanOrEqual(before);
    expect(state.lastModifiedAt).toBeLessThanOrEqual(after);
  });

  it("should update lastModifiedAt on state-changing operations", async () => {
    campaignManager.startNewCampaign(12345, "Standard");
    const initialModifiedAt = campaignManager.getState()!.lastModifiedAt;

    // Wait a bit to ensure timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    // spendScrap triggers save() internally
    campaignManager.spendScrap(10);
    const updatedModifiedAt = campaignManager.getState()!.lastModifiedAt;

    expect(updatedModifiedAt).toBeGreaterThan(initialModifiedAt);
  });

  it("should have lastModifiedAt set after startNewCampaign", () => {
    campaignManager.startNewCampaign(12345, "Standard");
    const state = campaignManager.getState()!;
    expect(state.lastModifiedAt).toBeDefined();
    expect(state.lastModifiedAt).toBeGreaterThan(0);
  });
});
