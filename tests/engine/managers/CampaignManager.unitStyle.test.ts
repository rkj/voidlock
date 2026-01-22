import { describe, it, expect, beforeEach, vi } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { UnitStyle } from "@src/shared/types";

describe("CampaignManager - unitStyle", () => {
  let storage: MockStorageProvider;
  let manager: CampaignManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(storage);
  });

  it("should persist unitStyle when starting a new campaign", () => {
    manager.startNewCampaign(
      123,
      "Standard",
      true,
      "default",
      UnitStyle.TacticalIcons,
    );
    const state = manager.getState();
    expect(state?.rules.unitStyle).toBe(UnitStyle.TacticalIcons);

    // Save and reload
    manager.save();
    CampaignManager.resetInstance();
    const newManager = CampaignManager.getInstance(storage);
    newManager.load();
    expect(newManager.getState()?.rules.unitStyle).toBe(
      UnitStyle.TacticalIcons,
    );
  });

  it("should handle optional unitStyle (defaulting to undefined in Rules but Sprites is intended fallback)", () => {
    manager.startNewCampaign(123, "Standard", true, "default");
    const state = manager.getState();
    expect(state?.rules.unitStyle).toBeUndefined();
  });
});
