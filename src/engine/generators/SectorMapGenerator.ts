import {
  CampaignNode,
  CampaignNodeType,
  GameRules,
} from "../../shared/campaign_types";
import { PRNG } from "../../shared/PRNG";

export interface SectorMapOptions {
  layers?: number;
  targetLength?: number; // NEW: Alias for layers to reach specific rank
  nodesPerLayer?: number;
  width?: number;
  height?: number;
}

/**
 * Generates a procedurally generated sector map as a Directed Acyclic Graph (DAG).
 */
export class SectorMapGenerator {
  /**
   * Generates a sector map.
   * @param seed The seed for the PRNG.
   * @param rules The game rules for difficulty scaling.
   * @param options Generation options.
   * @returns An array of CampaignNodes.
   */
  public generate(
    seed: number,
    rules: GameRules,
    options: SectorMapOptions = {},
  ): CampaignNode[] {
    const prng = new PRNG(seed);
    
    // Calculate layers to reach 12x12 cap from 6x6 base
    // 12 = 6 + floor(MaxRank * mapGrowthRate)
    // floor(MaxRank * mapGrowthRate) = 6
    // If rate = 1.0, MaxRank = 6. Total layers = 7 (0 to 6)
    // If rate = 0.5, MaxRank = 12. Total layers = 13 (0 to 12)
    const growthRate = rules.mapGrowthRate || 1.0;
    const defaultLayers = Math.ceil(6 / growthRate) + 1;
    const layers = options.targetLength || options.layers || defaultLayers;

    const nodesPerLayer = options.nodesPerLayer || 3;
    const width = options.width || 800;
    const height = options.height || 600;

    const nodes: CampaignNode[] = [];
    const layersOfNodes: CampaignNode[][] = [];

    // 1. Generate nodes for each layer
    for (let l = 0; l < layers; l++) {
      const currentLayerNodes: CampaignNode[] = [];
      const numNodes =
        l === 0 || l === layers - 1 ? 1 : prng.nextInt(2, nodesPerLayer);

      const layerX = (l / (layers - 1)) * width;

      for (let i = 0; i < numNodes; i++) {
        const id = `node_${l}_${i}`;
        const type = this.getRandomNodeType(l, layers, prng);

        // Vertical spacing with jitter
        const baseStageHeight = height / (numNodes + 1);
        const jitterY = (prng.next() - 0.5) * (baseStageHeight * 0.5);
        const nodeY = (i + 1) * baseStageHeight + jitterY;

        const node: CampaignNode = {
          id,
          type,
          status: l === 0 ? "Accessible" : "Revealed",
          difficulty: 1 + l * rules.difficultyScaling,
          rank: l,
          mapSeed: prng.nextInt(0, 1000000),
          connections: [],
          position: {
            x: layerX,
            y: nodeY,
          },
        };
        nodes.push(node);
        currentLayerNodes.push(node);
      }
      layersOfNodes.push(currentLayerNodes);
    }

    // 2. Connect layers
    for (let l = 0; l < layers - 1; l++) {
      const currentLayer = layersOfNodes[l];
      const nextLayer = layersOfNodes[l + 1];

      // Ensure every node in current layer connects to at least one in next layer
      currentLayer.forEach((node) => {
        const targetIndex = prng.nextInt(0, nextLayer.length - 1);
        node.connections.push(nextLayer[targetIndex].id);

        // Optional: add a second connection
        if (nextLayer.length > 1 && prng.next() > 0.7) {
          let secondTarget;
          do {
            secondTarget = prng.nextInt(0, nextLayer.length - 1);
          } while (nextLayer[secondTarget].id === node.connections[0]); // Simple check since we only had one

          // Re-check if we already have it in case logic evolves
          if (!node.connections.includes(nextLayer[secondTarget].id)) {
            node.connections.push(nextLayer[secondTarget].id);
          }
        }
      });

      // Ensure every node in next layer has at least one incoming connection
      nextLayer.forEach((nextNode) => {
        const hasIncoming = currentLayer.some((curr) =>
          curr.connections.includes(nextNode.id),
        );
        if (!hasIncoming) {
          const sourceIndex = prng.nextInt(0, currentLayer.length - 1);
          currentLayer[sourceIndex].connections.push(nextNode.id);
        }
      });
    }

    return nodes;
  }

  private getRandomNodeType(
    layer: number,
    totalLayers: number,
    prng: PRNG,
  ): CampaignNodeType {
    if (layer === 0) return "Combat";
    if (layer === totalLayers - 1) return "Boss";

    const roll = prng.next();
    if (roll < 0.6) return "Combat";
    if (roll < 0.8) return "Elite";
    if (roll < 0.9) return "Shop";
    return "Event";
  }
}
