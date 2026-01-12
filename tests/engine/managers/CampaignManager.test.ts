import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { MapGeneratorType } from "@src/shared/types";

describe("CampaignManager", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should start a new campaign with correct initial state", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState();

    expect(state).not.toBeNull();
    expect(state?.seed).toBe(12345);
    expect(state?.status).toBe("Active");
    expect(state?.rules.deathRule).toBe("Clone");
    expect(state?.scrap).toBe(500);
    expect(state?.roster.length).toBe(4);
    expect(state?.nodes.length).toBeGreaterThan(0);
    expect(
      state?.nodes.filter((n) => n.status === "Accessible").length,
    ).toBeGreaterThan(0);
  });

  it("should start a new campaign with a specific theme", () => {
    manager.startNewCampaign(12345, "Normal", true, "industrial");
    const state = manager.getState();

    expect(state?.rules.themeId).toBe("industrial");
  });

  it("should have MapGeneratorType.DenseShip as default for all difficulties", () => {
    manager.startNewCampaign(1, "Easy");
    expect(manager.getState()?.rules.mapGeneratorType).toBe("DenseShip");

    manager.startNewCampaign(1, "Normal");
    expect(manager.getState()?.rules.mapGeneratorType).toBe("DenseShip");

    manager.startNewCampaign(1, "Hard");
    expect(manager.getState()?.rules.mapGeneratorType).toBe("DenseShip");

    manager.startNewCampaign(1, "Ironman");
    expect(manager.getState()?.rules.mapGeneratorType).toBe("DenseShip");
  });

  it("should allow overriding mapGeneratorType in startNewCampaign", () => {
    manager.startNewCampaign(
      12345,
      "Normal",
      true,
      "default",
      undefined,
      MapGeneratorType.TreeShip,
    );
    const state = manager.getState();

    expect(state?.rules.mapGeneratorType).toBe("TreeShip");
  });

  it("should save and load campaign state using StorageProvider", () => {
    manager.startNewCampaign(12345, "Normal");
    const originalState = JSON.parse(JSON.stringify(manager.getState()));

    // Create a new instance with the same storage
    CampaignManager.resetInstance();
    const newManager = CampaignManager.getInstance(storage);
    const success = newManager.load();

    expect(success).toBe(true);
    expect(newManager.getState()).toEqual(originalState);
  });

  it("should process mission results and update state", () => {
    manager.startNewCampaign(12345, "Normal");
    const availableNodes = manager.getAvailableNodes();
    const targetNodeId = availableNodes[0].id;

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

    manager.processMissionResult(report);
    const state = manager.getState();

    const node = state?.nodes.find((n) => n.id === targetNodeId);
    expect(node?.status).toBe("Cleared");
    expect(state?.scrap).toBe(600);
    expect(state?.intel).toBe(5);
    expect(state?.history.length).toBe(1);

    const soldier = state?.roster.find((s) => s.id === "soldier_0");
    expect(soldier?.xp).toBe(100);
    expect(soldier?.kills).toBe(3);
    expect(soldier?.missions).toBe(1);
  });

  it("should unlock next nodes after clearing a node", () => {
    manager.startNewCampaign(12345, "Normal");
    const startNode = manager.getAvailableNodes()[0];
    const nextNodeIds = startNode.connections;

    expect(nextNodeIds.length).toBeGreaterThan(0);

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

    manager.processMissionResult(report);

    nextNodeIds.forEach((id) => {
      const node = manager.getState()?.nodes.find((n) => n.id === id);
      expect(node?.status).toBe("Accessible");
    });
  });

  it("should support different difficulty levels", () => {
    manager.startNewCampaign(1, "Easy");
    expect(manager.getState()?.rules.deathRule).toBe("Simulation");

    manager.startNewCampaign(1, "Hard");
    expect(manager.getState()?.rules.deathRule).toBe("Iron");
  });

  it("should reset the campaign state", () => {
    manager.startNewCampaign(12345, "Normal");
    expect(manager.getState()).not.toBeNull();

    manager.reset();
    expect(manager.getState()).toBeNull();
    expect(storage.load("voidlock_campaign_v1")).toBeNull();
  });

  it("should mark campaign as Defeat when Ironman mission is lost", () => {
    manager.startNewCampaign(12345, "Ironman"); 
    const availableNodes = manager.getAvailableNodes();
    const targetNodeId = availableNodes[0].id;

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

    manager.processMissionResult(report);
    const state = manager.getState();

    expect(state?.status).toBe("Defeat");
  });

  it("should throw error if getInstance called without storage on first time", () => {
    CampaignManager.resetInstance();
    expect(() => CampaignManager.getInstance()).toThrow();
  });

  describe("Roster Management", () => {
    beforeEach(() => {
      manager.startNewCampaign(12345, "Normal"); // deathRule: Clone, scrap: 500
    });

    it("should recruit a new soldier", () => {
      manager.recruitSoldier("assault", "New Recruit");
      const state = manager.getState();
      expect(state?.scrap).toBe(400);
      expect(state?.roster.length).toBe(5);
      const newSoldier = state?.roster.find((s) => s.name === "New Recruit");
      expect(newSoldier).toBeDefined();
      expect(newSoldier?.archetypeId).toBe("assault");
      expect(newSoldier?.status).toBe("Healthy");
    });

    it("should throw error when recruiting with insufficient scrap", () => {
      manager.startNewCampaign(12345, "Normal");
      // Spend all scrap
      const state = manager.getState()!;
      state.scrap = 50;
      expect(() => manager.recruitSoldier("assault", "Poor Guy")).toThrow(
        "Insufficient scrap to recruit soldier.",
      );
    });

    it("should heal a wounded soldier", () => {
      const state = manager.getState()!;
      const soldier = state.roster[0];
      soldier.status = "Wounded";
      soldier.hp = 10;

      manager.healSoldier(soldier.id);

      expect(state.scrap).toBe(450);
      expect(soldier.status).toBe("Healthy");
      expect(soldier.hp).toBe(soldier.maxHp);
    });

    it("should throw error when healing a healthy soldier", () => {
      const state = manager.getState()!;
      const soldier = state.roster[0];
      expect(() => manager.healSoldier(soldier.id)).toThrow(
        "Soldier is not wounded.",
      );
    });

    it("should revive a dead soldier in Clone mode", () => {
      const state = manager.getState()!;
      const soldier = state.roster[0];
      soldier.status = "Dead";
      soldier.hp = 0;

      manager.reviveSoldier(soldier.id);

      expect(state.scrap).toBe(250);
      expect(soldier.status).toBe("Healthy");
      expect(soldier.hp).toBe(soldier.maxHp);
    });

    it("should throw error when reviving in Iron mode", () => {
      manager.startNewCampaign(12345, "Hard"); // Iron mode
      const state = manager.getState()!;
      const soldier = state.roster[0];
      soldier.status = "Dead";

      expect(() => manager.reviveSoldier(soldier.id)).toThrow(
        "Revival only allowed in 'Clone' mode.",
      );
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

      expect(soldier.equipment).toEqual(newEquipment);
    });

    it("should deduct scrap via spendScrap", () => {
      const state = manager.getState()!;
      const initialScrap = state.scrap;
      manager.spendScrap(50);
      expect(state.scrap).toBe(initialScrap - 50);
    });

    it("should throw error when spendScrap called with insufficient funds", () => {
      const state = manager.getState()!;
      state.scrap = 10;
      expect(() => manager.spendScrap(20)).toThrow("Insufficient scrap.");
    });
  });
});
