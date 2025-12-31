import { describe, it, expect } from "vitest";
import { CampaignState, GameRules, CampaignNode } from "./campaign_types";

describe("Campaign Types", () => {
  it("should allow creating a valid CampaignState object", () => {
    const rules: GameRules = {
      mode: "Preset",
      deathRule: "Iron",
      difficultyScaling: 1.0,
      resourceScarcity: 1.0,
    };

    const node: CampaignNode = {
      id: "node-1",
      type: "Combat",
      status: "Accessible",
      difficulty: 1,
      mapSeed: 12345,
      connections: [],
      position: { x: 0, y: 0 },
    };

    const state: CampaignState = {
      version: "0.1.0",
      seed: 42,
      rules,
      scrap: 100,
      intel: 0,
      currentSector: 1,
      currentNodeId: null,
      nodes: [node],
      roster: [],
      history: [],
      unlockedArchetypes: ["assault", "medic"],
    };

    expect(state.version).toBe("0.1.0");
    expect(state.nodes[0].type).toBe("Combat");
    expect(state.unlockedArchetypes).toContain("assault");
  });
});
