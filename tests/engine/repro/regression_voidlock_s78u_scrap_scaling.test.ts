import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("Scrap Scaling Regression (voidlock-s78u)", () => {
  let manager: CampaignManager;

  beforeEach(() => {
    CampaignManager.resetInstance();
    const storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should start with 1000 scrap on Simulation difficulty", () => {
    manager.startNewCampaign(1, "Simulation");
    expect(manager.getState()?.scrap).toBe(1000);
  });

  it("should start with 500 scrap on Clone difficulty", () => {
    manager.startNewCampaign(1, "Clone");
    expect(manager.getState()?.scrap).toBe(500);
  });

  it("should start with 300 scrap on Standard difficulty", () => {
    manager.startNewCampaign(1, "Standard");
    expect(manager.getState()?.scrap).toBe(300);
  });

  it("should start with 150 scrap on Ironman difficulty", () => {
    manager.startNewCampaign(1, "Ironman");
    expect(manager.getState()?.scrap).toBe(150);
  });
});
