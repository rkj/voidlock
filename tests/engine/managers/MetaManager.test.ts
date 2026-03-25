import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "../../../src/engine/managers/CampaignManager";
import { MetaManager } from "../../../src/engine/managers/MetaManager";
import { MockStorageProvider } from "../../../src/engine/persistence/MockStorageProvider";

describe("MetaManager", () => {
  let storage: MockStorageProvider;

  beforeEach(() => {
    storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    MetaManager.resetInstance();
  });

  it("tracks global stats via recordMissionResult", () => {
    const meta = MetaManager.getInstance(storage);

    // Simulate a mission win
    meta.recordMissionResult({
      kills: 10,
      casualties: 0,
      won: true,
      scrapGained: 100,
      intelGained: 10,
    });

    expect(meta.getStats().totalKills).toBe(10);
    expect(meta.getStats().totalMissionsPlayed).toBe(1);
    expect(meta.getStats().totalMissionsWon).toBe(1);
    expect(meta.getStats().totalScrapEarned).toBe(100);
    expect(meta.getStats().totalCasualties).toBe(0);
    expect(meta.getStats().currentIntel).toBe(10);

    // Simulate a mission loss with casualties
    meta.recordMissionResult({
      kills: 5,
      casualties: 1,
      won: false,
      scrapGained: 20,
      intelGained: 0,
    });

    expect(meta.getStats().totalKills).toBe(15);
    expect(meta.getStats().totalMissionsPlayed).toBe(2);
    expect(meta.getStats().totalMissionsWon).toBe(1);
    expect(meta.getStats().totalScrapEarned).toBe(120);
    expect(meta.getStats().totalCasualties).toBe(1);
  });

  it("records mission stats through CampaignManager.reconcileMission", () => {
    const meta = MetaManager.getInstance(storage);
    const campaign = CampaignManager.getInstance(storage);

    campaign.startNewCampaign(123, "Simulation");
    const state = campaign.getState()!;
    const accessibleNode = state.nodes.find((n) => n.status === "Accessible")!;
    campaign.selectNode(accessibleNode.id);

    campaign.reconcileMission({
      won: true,
      kills: 10,
      elitesKilled: 0,
      scrapGained: 100,
      intelGained: 10,
      casualties: [],
      xpGained: new Map(),
    });

    expect(meta.getStats().totalKills).toBe(10);
    expect(meta.getStats().totalMissionsPlayed).toBe(1);
    expect(meta.getStats().totalMissionsWon).toBe(1);
    expect(meta.getStats().totalScrapEarned).toBe(100);
  });

  it("records campaign victory via recordCampaignResult", () => {
    const meta = MetaManager.getInstance(storage);

    meta.recordCampaignResult(true);

    expect(meta.getStats().campaignsWon).toBe(1);
    expect(meta.getStats().campaignsLost).toBe(0);
  });

  it("records campaign defeat via recordCampaignResult", () => {
    const meta = MetaManager.getInstance(storage);

    meta.recordCampaignResult(false);

    expect(meta.getStats().campaignsWon).toBe(0);
    expect(meta.getStats().campaignsLost).toBe(1);
  });

  it("tracks campaign starts via recordCampaignStarted", () => {
    const meta = MetaManager.getInstance(storage);

    meta.recordCampaignStarted();
    expect(meta.getStats().totalCampaignsStarted).toBe(1);

    meta.recordCampaignStarted();
    expect(meta.getStats().totalCampaignsStarted).toBe(2);
  });

  it("unlocks archetypes and items", () => {
    const meta = MetaManager.getInstance(storage);

    // Earn intel first
    meta.recordMissionResult({ kills: 0, casualties: 0, won: true, scrapGained: 0, intelGained: 200 });

    meta.unlockArchetype("sniper", 50);
    expect(meta.isArchetypeUnlocked("sniper")).toBe(true);

    meta.unlockItem("autocannon", 50);
    expect(meta.isItemUnlocked("autocannon")).toBe(true);

    expect(meta.getStats().currentIntel).toBe(100); // 200 - 50 - 50
  });
});
