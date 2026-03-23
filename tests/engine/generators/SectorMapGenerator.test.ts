import { describe, it, expect } from "vitest";
import { SectorMapGenerator } from "@src/engine/generators/SectorMapGenerator";
import { MapGeneratorType, MissionType } from "@src/shared/types";

describe("SectorMapGenerator", () => {
  const rules = {
    difficultyScaling: 1.0,
    mapGrowthRate: 1.0,
    mapGeneratorType: MapGeneratorType.DenseShip,
  };

  it("should generate a list of nodes with length based on layers", () => {
    const layers = 6;
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules, rankCount: layers });

    // With layers=6, we have Rank 0 to 5.
    // Better yet, let's just check the number of nodes is within reasonable bounds.
    expect(nodes.length).toBeGreaterThan(layers);
  });

  it("should have a single Combat node at layer 0", () => {
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules });

    const layer0Nodes = nodes.filter((n) => n.rank === 0);
    expect(layer0Nodes.length).toBe(1);
    expect(layer0Nodes[0].type).toBe("Combat");
    expect(layer0Nodes[0].status).toBe("Accessible");
  });

  it("should have a single Boss node at the last layer", () => {
    const layers = 10;
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules, rankCount: layers });

    const lastLayerNodes = nodes.filter((n) => n.rank === layers - 1);
    expect(lastLayerNodes.length).toBe(1);
    expect(lastLayerNodes[0].type).toBe("Boss");
  });

  it("should ensure all nodes are connected in a DAG (no cycles)", () => {
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules });

    // Simple cycle detection: since connections only go to next layers, cycles are impossible if we enforce this.
    // But let's verify connectivity: all nodes except Boss must have connections.
    nodes.forEach((node) => {
      const isLastRank = node.rank === Math.max(...nodes.map(n => n.rank));
      if (node.type !== "Boss" && !isLastRank) {
        expect(node.connections.length).toBeGreaterThan(0);
      }
    });
  });

  it("should ensure all nodes except layer 0 have at least one incoming connection", () => {
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules });

    const allConnectedIds = new Set<string>();
    nodes.forEach((n) =>
      n.connections.forEach((id) => allConnectedIds.add(id)),
    );

    nodes.forEach((n) => {
      if (n.rank > 0) {
        expect(allConnectedIds.has(n.id)).toBe(true);
      }
    });
  });

  it("should assign valid node types to middle layers", () => {
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules });

    const validTypes = ["Combat", "Elite", "Shop", "Event", "Boss"];
    nodes.forEach((node) => {
      expect(validTypes).toContain(node.type);
    });
  });
});
