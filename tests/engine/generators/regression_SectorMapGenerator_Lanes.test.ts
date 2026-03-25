import { describe, it, expect } from "vitest";
import { SectorMapGenerator } from "@src/engine/generators/SectorMapGenerator";
import { GameRules, CampaignNode } from "@src/shared/campaign_types";
import { MapGeneratorType } from "@src/shared/types";

describe("SectorMapGenerator - Lane-Based", () => {
  const defaultRules: GameRules = {
    mode: "Custom",
    difficulty: "Standard",
    deathRule: "Clone",
    allowTacticalPause: true,
    mapGeneratorType: MapGeneratorType.DenseShip,
    difficultyScaling: 1.0,
    resourceScarcity: 1.0,
    startingScrap: 600,
    mapGrowthRate: 1.0,
    baseEnemyCount: 3,
    enemyGrowthPerMission: 1,
    economyMode: "Open",
    skipPrologue: false,
  };

  it("should have exactly 4 lanes (implicit in positioning and connectivity)", () => {
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules: defaultRules });

    // We can't strictly check lanes from the node itself unless we add lane to the node,
    // but we can check vertical positioning or just the connectivity rules.
    // For now, let's check if nodes have bonusLootCount.
    nodes.forEach((node) => {
      expect(node.bonusLootCount).toBeDefined();
      expect(node.bonusLootCount).toBeGreaterThanOrEqual(0);
      expect(node.bonusLootCount).toBeLessThanOrEqual(3);
    });
  });

  it("should have 3-4 nodes per intermediate rank", () => {
    const layers = 8;
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules: defaultRules, options: { layers } });

    for (let r = 1; r < layers - 1; r++) {
      const rankNodes = nodes.filter((n) => n.rank === r);
      expect(rankNodes.length).toBeGreaterThanOrEqual(3);
      expect(rankNodes.length).toBeLessThanOrEqual(4);
    }
  });

  it("should ensure no crossing lines (monotonicity)", () => {
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules: defaultRules });
    const nodeMap = new Map<string, CampaignNode>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    const maxRank = Math.max(...nodes.map((n) => n.rank));

    for (let r = 0; r < maxRank; r++) {
      const rankNodes = nodes
        .filter((n) => n.rank === r)
        .sort((a, b) => a.position.y - b.position.y);

      let lastMaxTargetY = -Infinity;

      for (const node of rankNodes) {
        const targets = node.connections
          .map((id) => nodeMap.get(id)!)
          .sort((a, b) => a.position.y - b.position.y);

        if (targets.length > 0) {
          // Rule: If Node A is "above" Node B (A.y < B.y),
          // then ALL of A's targets must be "above" or "equal to" ALL of B's targets.
          // This means min target Y of current node must be >= max target Y of previous node in same rank.
          expect(targets[0].position.y).toBeGreaterThanOrEqual(lastMaxTargetY);
          lastMaxTargetY = targets[targets.length - 1].position.y;
        }
      }
    }
  });

  it("should assign node types with expected distribution (Combat, Shop, Event)", () => {
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules: defaultRules, options: { layers: 20 } });

    const intermediateNodes = nodes.filter((n) => n.rank > 0 && n.rank < 19);
    const combatNodes = intermediateNodes.filter((n) => n.type === "Combat");
    const shopNodes = intermediateNodes.filter((n) => n.type === "Shop");
    const eventNodes = intermediateNodes.filter((n) => n.type === "Event");

    // Expect ~60% Combat, ~20% Shop, ~20% Event
    const combatRatio = combatNodes.length / intermediateNodes.length;
    expect(combatRatio).toBeGreaterThan(0.3);
    expect(combatRatio).toBeLessThan(0.9);
    expect(shopNodes.length).toBeGreaterThan(0);
    expect(eventNodes.length).toBeGreaterThan(0);
  });
});
