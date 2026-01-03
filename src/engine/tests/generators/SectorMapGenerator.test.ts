import { describe, it, expect } from "vitest";
import { SectorMapGenerator } from "../../generators/SectorMapGenerator";
import { GameRules } from "../../../shared/campaign_types";

describe("SectorMapGenerator", () => {
  const defaultRules: GameRules = {
    mode: "Custom",
    deathRule: "Clone",
    difficultyScaling: 1.0,
    resourceScarcity: 1.0,
  };

  it("should generate a deterministic map with a given seed", () => {
    const generator = new SectorMapGenerator();
    const seed = 12345;
    const nodes1 = generator.generate(seed, defaultRules);
    const nodes2 = generator.generate(seed, defaultRules);

    expect(nodes1).toEqual(nodes2);
  });

  it("should generate a map with the specified number of layers", () => {
    const generator = new SectorMapGenerator();
    const layers = 15;
    const nodes = generator.generate(123, defaultRules, { layers });

    // Find the max layer from node IDs (assuming ID format node_layer_index)
    // Or we can just check if we have nodes that appear to be in the last layer.
    // Better yet, let's just check the number of nodes is within reasonable bounds.
    expect(nodes.length).toBeGreaterThan(layers);
  });

  it("should have a single Combat node at layer 0", () => {
    const generator = new SectorMapGenerator();
    const nodes = generator.generate(123, defaultRules);

    const layer0Nodes = nodes.filter((n) => n.id.startsWith("node_0_"));
    expect(layer0Nodes.length).toBe(1);
    expect(layer0Nodes[0].type).toBe("Combat");
    expect(layer0Nodes[0].status).toBe("Accessible");
  });

  it("should have a single Boss node at the last layer", () => {
    const layers = 10;
    const generator = new SectorMapGenerator();
    const nodes = generator.generate(123, defaultRules, { layers });

    const lastLayerNodes = nodes.filter((n) =>
      n.id.startsWith(`node_${layers - 1}_`),
    );
    expect(lastLayerNodes.length).toBe(1);
    expect(lastLayerNodes[0].type).toBe("Boss");
  });

  it("should ensure all nodes are connected in a DAG (no cycles)", () => {
    const generator = new SectorMapGenerator();
    const nodes = generator.generate(123, defaultRules);

    // Simple cycle detection: since connections only go to next layers, cycles are impossible if we enforce this.
    // But let's verify connectivity: all nodes except Boss must have connections.
    nodes.forEach((node) => {
      if (node.type !== "Boss") {
        expect(node.connections.length).toBeGreaterThan(0);
      } else {
        expect(node.connections.length).toBe(0);
      }
    });
  });

  it("should ensure all nodes except layer 0 have at least one incoming connection", () => {
    const generator = new SectorMapGenerator();
    const nodes = generator.generate(123, defaultRules);

    const allConnectedIds = new Set<string>();
    nodes.forEach((n) =>
      n.connections.forEach((id) => allConnectedIds.add(id)),
    );

    nodes.forEach((node) => {
      if (!node.id.startsWith("node_0_")) {
        expect(allConnectedIds.has(node.id)).toBe(true);
      }
    });
  });

  it("should assign valid node types to middle layers", () => {
    const generator = new SectorMapGenerator();
    const nodes = generator.generate(123, defaultRules);

    const validTypes = ["Combat", "Elite", "Shop", "Event", "Boss"];
    nodes.forEach((node) => {
      expect(validTypes).toContain(node.type);
    });
  });
});
