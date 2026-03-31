import { describe, it, expect, beforeEach, vi } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MissionReconciler } from "@src/engine/campaign/MissionReconciler";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { MapGeneratorType } from "@src/shared/types";

describe("CampaignManager", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    
    storage = new MockStorageProvider();
    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
  });

  it("should start a new campaign with correct initial state", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState();

    expect(state).not.toBeNull();
    expect(state?.seed).toBe(12345);
    expect(state?.status).toBe("Active");
    expect(state?.rules.deathRule).toBe("Clone");
    expect(state?.scrap).toBe(600);
    expect(state?.roster.length).toBe(4);
    expect(state?.nodes.length).toBeGreaterThan(0);
    expect(
      state?.nodes.filter((n) => n.status === "Accessible").length,
    ).toBeGreaterThan(0);
  });

  it("should have MapGeneratorType.DenseShip as default for all difficulties", () => {
    manager.startNewCampaign(1, "Simulation");
    expect(manager.getState()?.rules.mapGeneratorType).toBe("DenseShip");

    manager.startNewCampaign(1, "Standard");
    expect(manager.getState()?.rules.mapGeneratorType).toBe("DenseShip");

    manager.startNewCampaign(1, "Ironman");
    expect(manager.getState()?.rules.mapGeneratorType).toBe("DenseShip");

    manager.startNewCampaign(1, "Iron");
    expect(manager.getState()?.rules.mapGeneratorType).toBe("DenseShip");
  });

  it("should allow overriding mapGeneratorType in startNewCampaign", () => {
    manager.startNewCampaign(12345, "Standard", true, MapGeneratorType.TreeShip);
    const state = manager.getState();

    expect(state?.rules.mapGeneratorType).toBe("TreeShip");
  });

  it("should save and load campaign state using StorageProvider", async () => {
    manager.startNewCampaign(12345, "Standard");
    const originalState = JSON.parse(JSON.stringify(manager.getState()));

    // Create a new instance with the same storage
    
    const newManager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
    const success = await newManager.load();

    expect(success).toBe(true);
    // Note: equal ignores saveVersion differences if they exist, but they should be equal here
    expect(newManager.getState()).toEqual(originalState);
  });

  it("should process mission results and update state", () => {
    manager.startNewCampaign(12345, "Standard");
    const availableNodes = manager.getAvailableNodes();
    const targetNodeId = availableNodes[0].id;

    // Must select node first so currentNodeId is set
    manager.selectNode(targetNodeId);

    const report: MissionReport = {
      nodeId: targetNodeId,
      seed: 123,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 1000,
      soldierResults: [
        {
          soldierId: "soldier_0",
          xpBefore: 0,
          xpGained: 50,
          kills: 3,
          promoted: false,
          status: "Healthy",
        },
      ],
    };

    manager.reconcileMission(report);
    const state = manager.getState();

    const node = state?.nodes.find((n) => n.id === targetNodeId);
    expect(node?.status).toBe("Cleared");
    expect(state?.scrap).toBe(700); // 600 starting + 100 gained
    expect(state?.intel).toBe(5);
    expect(state?.history.length).toBe(1);

    const soldier = state?.roster.find((s) => s.id === "soldier_0");
    expect(soldier?.xp).toBeGreaterThan(0);
    expect(soldier?.kills).toBe(3);
    expect(soldier?.missions).toBe(1);
  });

  it("should clear node and record history after mission win", () => {
    manager.startNewCampaign(12345, "Standard");
    const startNode = manager.getAvailableNodes()[0];

    manager.selectNode(startNode.id);

    const report: MissionReport = {
      nodeId: startNode.id,
      seed: 123,
      result: "Won",
      aliensKilled: 5,
      scrapGained: 50,
      intelGained: 0,
      timeSpent: 500,
      soldierResults: [],
    };

    manager.reconcileMission(report);

    const state = manager.getState()!;
    const clearedNode = state.nodes.find((n) => n.id === startNode.id);
    expect(clearedNode?.status).toBe("Cleared");
    expect(state.history.length).toBe(1);
  });

  it("should advance campaign without mission (Shop/Event) via MissionReconciler", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState()!;
    const startNode = manager.getAvailableNodes()[0];

    // advanceCampaignWithoutMission is on MissionReconciler, not CampaignManager
    MissionReconciler.advanceCampaignWithoutMission(state, startNode.id, 100, 10);

    expect(state.nodes.find((n) => n.id === startNode.id)?.status).toBe(
      "Cleared",
    );
    expect(state.scrap).toBe(700); // 600 starting + 100 gained
    expect(state.intel).toBe(10);
    expect(state.history.length).toBe(1);
    expect(state.history[0].nodeId).toBe(startNode.id);
    expect(state.history[0].aliensKilled).toBe(0);
  });

  it("should support different difficulty levels", () => {
    manager.startNewCampaign(1, "Simulation");
    expect(manager.getState()?.rules.deathRule).toBe("Simulation");

    manager.startNewCampaign(1, "Ironman");
    expect(manager.getState()?.rules.deathRule).toBe("Iron");
  });

  it("should reset the campaign state", () => {
    manager.startNewCampaign(12345, "Standard");
    expect(manager.getState()).not.toBeNull();

    manager.reset();
    expect(manager.getState()).toBeNull();
  });

  it("should mark campaign as Defeat when Ironman mission is lost", () => {
    manager.startNewCampaign(12345, "Ironman");
    const availableNodes = manager.getAvailableNodes();
    const targetNodeId = availableNodes[0].id;

    manager.selectNode(targetNodeId);

    const report: MissionReport = {
      nodeId: targetNodeId,
      seed: 123,
      result: "Lost",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [],
    };

    manager.reconcileMission(report);
    const state = manager.getState();

    expect(state?.status).toBe("Defeat");
  });

  it("should mark campaign as Victory when Boss mission is won", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState()!;
    // Find a boss node or force one
    let bossNode = state.nodes.find((n) => n.type === "Boss");
    if (!bossNode) {
      bossNode = state.nodes[state.nodes.length - 1];
      bossNode.type = "Boss";
    }

    state.currentNodeId = bossNode.id;

    const report: MissionReport = {
      nodeId: bossNode.id,
      seed: 123,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 500,
      intelGained: 10,
      timeSpent: 1000,
      soldierResults: [],
    };

    manager.reconcileMission(report);
    expect(manager.getState()?.status).toBe("Victory");
  });

  it("should initialize correctly via constructor", () => {
    const metaStorage = new MockStorageProvider();
    const metaManager = new MetaManager(metaStorage);
    const campaignManager = new CampaignManager(storage, metaManager);
    expect(campaignManager).toBeDefined();
  });

  describe("Roster Management", () => {
    beforeEach(() => {
      manager.startNewCampaign(12345, "Standard"); // deathRule: Clone, scrap: 600
    });

    it("should recruit a new soldier", () => {
      const id = manager.recruitSoldier("assault");
      const state = manager.getState();
      expect(state?.scrap).toBe(500); // 600 - 100 recruit cost
      expect(state?.roster.length).toBe(5);
      const newSoldier = state?.roster.find((s) => s.id === id);
      expect(newSoldier).toBeDefined();
      expect(newSoldier?.archetypeId).toBe("assault");
      expect(newSoldier?.status).toBe("Healthy");
    });

    it("should return null when recruiting with insufficient scrap", () => {
      manager.startNewCampaign(12345, "Standard");
      // Spend all scrap
      const state = manager.getState()!;
      state.scrap = 50;
      const result = manager.recruitSoldier("assault");
      expect(result).toBeNull();
    });

    it("should heal a wounded soldier", () => {
      const state = manager.getState()!;
      const soldier = state.roster[0];
      soldier.status = "Wounded";
      soldier.hp = 10;

      const healCost = 50;
      manager.healSoldier(soldier.id, healCost);

      expect(state.scrap).toBe(550); // 600 - 50
      expect(soldier.status).toBe("Healthy");
      expect(soldier.hp).toBe(soldier.maxHp);
    });

    it("should return false when healing a healthy soldier", () => {
      const state = manager.getState()!;
      const soldier = state.roster[0];
      const result = manager.healSoldier(soldier.id, 50);
      expect(result).toBe(false);
    });

    it("should revive a dead soldier in Clone mode", () => {
      const state = manager.getState()!;
      const soldier = state.roster[0];
      soldier.status = "Dead";
      soldier.hp = 0;

      manager.reviveSoldier(soldier.id);

      expect(state.scrap).toBe(350); // 600 - 250 revive cost
      expect(soldier.status).toBe("Healthy");
      expect(soldier.hp).toBe(soldier.maxHp);
    });

    it("should return false when reviving with insufficient scrap in Ironman mode", () => {
      manager.startNewCampaign(12345, "Ironman"); // scrap: 200
      const state = manager.getState()!;
      const soldier = state.roster[0];
      soldier.status = "Dead";

      // Ironman starts with 200 scrap, revive costs 250 — should return false
      const result = manager.reviveSoldier(soldier.id);
      expect(result).toBe(false);
    });

    it("should assign equipment to a soldier", () => {
      const state = manager.getState()!;
      const soldier = state.roster[0];
      const newEquipment = {
        rightHand: "pulse_rifle",
        leftHand: "medkit",
        body: "light_recon",
        feet: "combat_boots",
      };

      manager.assignEquipment(soldier.id, newEquipment);

      expect(soldier.equipment).toEqual(expect.objectContaining(newEquipment));
    });

    it("should deduct scrap via spendScrap", () => {
      const state = manager.getState()!;
      const initialScrap = state.scrap;
      manager.spendScrap(50);
      expect(state.scrap).toBe(initialScrap - 50);
    });

    it("should rename a soldier", () => {
      const state = manager.getState()!;
      const soldier = state.roster[0];
      const oldName = soldier.name;
      const newName = "Ghost Rider";

      manager.renameSoldier(soldier.id, newName);

      expect(soldier.name).toBe(newName);
      expect(soldier.name).not.toBe(oldName);
    });

    it("should throw error when renaming with an empty name", () => {
      const state = manager.getState()!;
      const soldier = state.roster[0];

      expect(() => manager.renameSoldier(soldier.id, "")).toThrow(
        "Invalid name.",
      );
    });

    it("should throw error when spendScrap called with insufficient funds", () => {
      const state = manager.getState()!;
      state.scrap = 10;
      expect(() => manager.spendScrap(20)).toThrow("Insufficient scrap");
    });
  });
});
