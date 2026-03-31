import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { EventManager } from "../../../src/engine/campaign/EventManager";
import { MissionReconciler } from "../../../src/engine/campaign/MissionReconciler";
import { MockStorageProvider } from "../../../src/engine/persistence/MockStorageProvider";
import { PRNG } from "../../../src/shared/PRNG";
import { EventChoice } from "../../../src/shared/campaign_types";

describe("Campaign Events", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;
  let eventManager: EventManager;
  let reconciler: any;

  beforeEach(() => {
    storage = new MockStorageProvider();
    
    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
    manager.startNewCampaign(12345, "Simulation");
    eventManager = new EventManager();
    // EventManager expects reconciler as instance with advanceCampaignWithoutMission method
    reconciler = {
      advanceCampaignWithoutMission: MissionReconciler.advanceCampaignWithoutMission.bind(MissionReconciler),
    };
  });

  it("should apply rewards correctly", () => {
    const state = manager.getState()!;
    const initialScrap = state.scrap;
    const initialIntel = state.intel;

    const eventNode = state.nodes.find((n) => n.type === "Event")!;
    eventNode.status = "Accessible";
    const choice: EventChoice = {
      label: "Test Choice",
      reward: { scrap: 100, intel: 20 },
    };

    const prng = new PRNG(1);
    const result = eventManager.applyEventChoice({
      state,
      nodeId: eventNode.id,
      choice,
      prng,
      reconciler,
    });

    expect(state.scrap).toBe(initialScrap + 100);
    expect(state.intel).toBe(initialIntel + 20);
    expect(result.text).toContain("Gained 100 Credits");
    expect(result.text).toContain("Gained 20 Intel");
    expect(eventNode.status).toBe("Cleared");
  });

  it("should apply costs and handle insufficient funds", () => {
    const state = manager.getState()!;
    state.scrap = 50;

    const eventNode = state.nodes.find((n) => n.type === "Event")!;
    const choice: EventChoice = {
      label: "Expensive Choice",
      cost: { scrap: 100 },
    };

    const prng = new PRNG(1);
    expect(() =>
      eventManager.applyEventChoice({
        state,
        nodeId: eventNode.id,
        choice,
        prng,
        reconciler,
      }),
    ).toThrow("Not enough Credits.");
    expect(state.scrap).toBe(50);
  });

  it("should handle risk and damage correctly", () => {
    const state = manager.getState()!;
    const eventNode = state.nodes.find((n) => n.type === "Event")!;

    const choice: EventChoice = {
      label: "Risky Choice",
      risk: { chance: 1.0, damage: 0.5 }, // 100% chance to take 50% damage
    };

    const prng = new PRNG(1);

    const result = eventManager.applyEventChoice({
      state,
      nodeId: eventNode.id,
      choice,
      prng,
      reconciler,
    });

    const injuredSoldier = state.roster.find((s) => s.hp < s.maxHp);
    expect(injuredSoldier).toBeDefined();
    expect(result.text).toContain("took");
    expect(result.text).toContain("damage");
  });

  it("should handle ambush correctly", () => {
    const state = manager.getState()!;
    const eventNode = state.nodes.find((n) => n.type === "Event")!;
    eventNode.status = "Accessible";

    const choice: EventChoice = {
      label: "Ambush Choice",
      risk: { chance: 1.0, ambush: true },
    };

    const prng = new PRNG(1);
    const result = eventManager.applyEventChoice({
      state,
      nodeId: eventNode.id,
      choice,
      prng,
      reconciler,
    });

    expect(result.ambush).toBe(true);
    expect(result.text).toContain("It's an ambush!");
    expect(eventNode.type).toBe("Combat");
    expect(eventNode.status).toBe("Accessible"); // Not cleared yet because of ambush
  });

  it("should handle free recruitment", () => {
    const state = manager.getState()!;
    const initialRosterSize = state.roster.length;
    const eventNode = state.nodes.find((n) => n.type === "Event")!;

    const choice: EventChoice = {
      label: "Recruit Choice",
      reward: { recruit: true },
    };

    const prng = new PRNG(1);
    const result = eventManager.applyEventChoice({
      state,
      nodeId: eventNode.id,
      choice,
      prng,
      reconciler,
    });

    expect(state.roster.length).toBe(initialRosterSize + 1);
    expect(result.text).toContain("Recruited");
    expect(eventNode.status).toBe("Cleared");
  });
});
