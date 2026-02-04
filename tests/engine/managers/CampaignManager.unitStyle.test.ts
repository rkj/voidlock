import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignManager - unitStyle (Obsolete - Now Global)", () => {
  let storage: MockStorageProvider;
  let manager: CampaignManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(storage);
  });

  it("should start a new campaign without unitStyle in rules", () => {
    manager.startNewCampaign(123, "Standard", true);
    const state = manager.getState();
    expect(state).not.toBeNull();
    // @ts-ignore
    expect(state?.rules.unitStyle).toBeUndefined();
  });
});
