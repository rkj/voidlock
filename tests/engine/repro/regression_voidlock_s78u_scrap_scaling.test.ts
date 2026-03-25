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

  it("should start with 600 scrap on Standard difficulty (default)", () => {
    manager.startNewCampaign(1, "Standard");
    expect(manager.getState()?.scrap).toBe(600);
  });

  it("should start with 400 scrap on Iron difficulty", () => {
    manager.startNewCampaign(1, "Iron");
    expect(manager.getState()?.scrap).toBe(400);
  });

  it("should start with 200 scrap on Ironman difficulty", () => {
    manager.startNewCampaign(1, "Ironman");
    expect(manager.getState()?.scrap).toBe(200);
  });
});
