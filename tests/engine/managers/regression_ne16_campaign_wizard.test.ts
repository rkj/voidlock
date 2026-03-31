import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignManager Regression NE16", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    
    storage = new MockStorageProvider();
    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
  });

  it("should allow overriding tactical pause when starting a new campaign", () => {
    // Ironman normally has allowTacticalPause: false
    // We want to verify we can force it to true (or vice versa)
    manager.startNewCampaign(12345, "Ironman", true);
    let state = manager.getState();
    expect(state?.rules.difficulty).toBe("Ironman");
    expect(state?.rules.allowTacticalPause).toBe(true);

    
    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));

    // Standard normally has allowTacticalPause: true
    manager.startNewCampaign(67890, "Standard", false);
    state = manager.getState();
    expect(state?.rules.difficulty).toBe("Standard");
    expect(state?.rules.allowTacticalPause).toBe(false);
  });
});
