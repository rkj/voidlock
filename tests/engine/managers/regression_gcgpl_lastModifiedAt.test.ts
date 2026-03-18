import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/campaign/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("Regression: lastModifiedAt (voidlock-gcgpl)", () => {
  let campaignManager: CampaignManager;
  let mockStorage: MockStorageProvider;

  beforeEach(() => {
    mockStorage = new MockStorageProvider();
    CampaignManager.resetInstance();
    campaignManager = CampaignManager.getInstance(mockStorage);
  });

  it("should set lastModifiedAt when starting a new campaign", () => {
    const before = Date.now();
    campaignManager.startNewCampaign(12345, "Clone");
    const state = campaignManager.getState()!;
    const after = Date.now();

    expect(state.lastModifiedAt).toBeGreaterThanOrEqual(before);
    expect(state.lastModifiedAt).toBeLessThanOrEqual(after);
  });

  it("should update lastModifiedAt when saving", async () => {
    campaignManager.startNewCampaign(12345, "Clone");
    const initialModifiedAt = campaignManager.getState()!.lastModifiedAt;

    // Wait a bit to ensure timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    campaignManager.save();
    const updatedModifiedAt = campaignManager.getState()!.lastModifiedAt;

    expect(updatedModifiedAt).toBeGreaterThan(initialModifiedAt);
  });

  it("should repair missing lastModifiedAt in validateAndRepair", () => {
    const invalidState = {
      version: "0.1.0",
      seed: 123,
      nodes: [],
      roster: [],
      // lastModifiedAt missing
    };

    // @ts-ignore - testing repair logic with invalid data
    const repaired = campaignManager["validateAndRepair"](invalidState);
    expect(repaired).not.toBeNull();
    expect(repaired!.lastModifiedAt).toBe(0);
  });
});
