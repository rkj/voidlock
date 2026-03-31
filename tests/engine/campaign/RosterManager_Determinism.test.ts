import { describe, it, expect, vi, beforeEach } from "vitest";
import { SoldierFactory } from "../../../src/engine/campaign/SoldierFactory";
import { RosterManager } from "../../../src/engine/campaign/RosterManager";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { PRNG } from "../../../src/shared/PRNG";
import type { CampaignState } from "../../../src/shared/campaign_types";
import { MapGeneratorType } from "../../../src/shared/types";

describe("RosterManager and SoldierFactory Determinism", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("SoldierFactory should be deterministic given the same PRNG", () => {
    const prng1 = new PRNG(12345);
    const prng2 = new PRNG(12345);

    vi.setSystemTime(new Date("2026-03-28T10:00:00Z"));
    const soldier1 = SoldierFactory.createSoldier("assault", [], { prng: prng1 });

    // Advance time
    vi.setSystemTime(new Date("2026-03-28T10:01:00Z"));
    const soldier2 = SoldierFactory.createSoldier("assault", [], { prng: prng2 });

    // Should now PASS
    expect(soldier1.id).toBe(soldier2.id);
    expect(soldier1.name).toBe(soldier2.name);
    // Should NOT contain Date.now() pattern (which would be 1774692000000 or similar)
    expect(soldier1.id).not.toContain("1774692");
  });

  it("RosterManager.recruitSoldier (via CampaignManager) should be deterministic", () => {
    // Mock storage for two managers
    const mockStorage1 = {
      load: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
    };
    const mockStorage2 = {
      load: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
    };

    const manager1 = new CampaignManager(mockStorage1 as any, new MetaManager(new MockStorageProvider()));
    manager1.startNewCampaign(12345, "Standard");
    
    // Reset instance for the second manager
    
    const manager2 = new CampaignManager(mockStorage2 as any, new MetaManager(new MockStorageProvider()));
    manager2.startNewCampaign(12345, "Standard");

    vi.setSystemTime(new Date("2026-03-28T10:00:00Z"));
    const id1 = manager1.recruitSoldier("assault");

    vi.setSystemTime(new Date("2026-03-28T10:01:00Z"));
    const id2 = manager2.recruitSoldier("assault");

    // Should now PASS
    expect(id1).toBe(id2);
  });
});
