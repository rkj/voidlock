import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/campaign/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { calculateMapSize } from "@src/shared/campaign_types";

describe("Campaign Map Size Progression (voidlock-kfavd)", () => {
  let storage: MockStorageProvider;
  let manager: CampaignManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(storage);
  });

  it("should have 6x6 map size at Rank 1 (rank index 0)", () => {
    manager.startNewCampaign(12345, "standard");
    const state = manager.getState();
    expect(state).toBeDefined();
    
    const rank0Node = state!.nodes.find(n => n.rank === 0);
    expect(rank0Node).toBeDefined();
    
    const rules = state!.rules;
    const size = calculateMapSize(rank0Node!.rank, rules.mapGrowthRate);
    
    // Spec: Rank 1 (index 0) must be 6x6
    expect(size).toBe(6);
  });

  it("should have 6x6 map size at Rank 2 (rank index 1)", () => {
    manager.startNewCampaign(12345, "standard");
    const state = manager.getState();
    
    const rank1Node = state!.nodes.find(n => n.rank === 1);
    expect(rank1Node).toBeDefined();
    
    const rules = state!.rules;
    const size = calculateMapSize(rank1Node!.rank, rules.mapGrowthRate);
    
    // Spec: Size = 6 + floor((Rank-1)/2)
    // Rank 2 (index 1): 6 + floor(1/2) = 6
    expect(size).toBe(6);
  });

  it("should have 7x7 map size at Rank 3 (rank index 2)", () => {
    manager.startNewCampaign(12345, "standard");
    const state = manager.getState();
    
    const rank2Node = state!.nodes.find(n => n.rank === 2);
    expect(rank2Node).toBeDefined();
    
    const rules = state!.rules;
    const size = calculateMapSize(rank2Node!.rank, rules.mapGrowthRate);
    
    // Spec: Size = 6 + floor((Rank-1)/2)
    // Rank 3 (index 2): 6 + floor(2/2) = 7
    expect(size).toBe(7);
  });
});
