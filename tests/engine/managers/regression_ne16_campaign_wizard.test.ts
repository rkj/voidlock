import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignManager Regression NE16", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should allow overriding tactical pause when starting a new campaign", () => {
    // Ironman normally has allowTacticalPause: false
    // We want to verify we can force it to true (or vice versa)
    manager.startNewCampaign(12345, "Ironman", true);
    let state = manager.getState();
    expect(state?.rules.difficulty).toBe("Ironman");
    expect(state?.rules.allowTacticalPause).toBe(true);

    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(storage);
    
    // Normal normally has allowTacticalPause: true
    manager.startNewCampaign(67890, "Normal", false);
    state = manager.getState();
    expect(state?.rules.difficulty).toBe("Clone"); // Normal maps to Clone
    expect(state?.rules.allowTacticalPause).toBe(false);
  });
});
