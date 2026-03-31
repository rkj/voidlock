import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignManager - unitStyle (Obsolete - Now Global)", () => {
  let storage: MockStorageProvider;
  let manager: CampaignManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    
    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
  });

  it("should start a new campaign without unitStyle in rules", () => {
    manager.startNewCampaign(123, "Standard", true);
    const state = manager.getState();
    expect(state).not.toBeNull();
    // @ts-ignore
    expect(state?.rules.unitStyle).toBeUndefined();
  });
});
