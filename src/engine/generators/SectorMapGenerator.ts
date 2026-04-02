import type {
  CampaignNode,
  CampaignNodeType} from "../../shared/types";
import {
  MissionType,
} from "../../shared/types";
import { PRNG } from "../../shared/PRNG";

export interface SectorMapOptions {
  layers?: number;
  targetLength?: number; // Alias for layers to reach specific rank
  nodesPerLayer?: number;
  width?: number;
  height?: number;
}

/**
 * Generates a procedurally generated sector map as a Directed Acyclic Graph (DAG) using a lane-based approach.
 */
export class SectorMapGenerator {
  private static readonly LANES = 4;

  /**
   * Generates a sector map.
   */
  public static generate(params: {
    seed: number;
    rules: any;
    rankCount?: number;
    options?: SectorMapOptions;
  }): CampaignNode[] {
    const { seed, rules, rankCount, options = {} } = params;
    const prng = new PRNG(seed);

    const growthRate = rules.mapGrowthRate || 1.0;
    const defaultLayers = Math.ceil(6 / growthRate) + 1;
    const layers = rankCount || options.targetLength || options.layers || defaultLayers;

    const width = options.width || 800;
    const height = options.height || 600;

    const { nodes, grid } = SectorMapGenerator.populateGrid({ prng, layers, rules, width, height });
    SectorMapGenerator.connectRanks({ prng, layers, grid });

    return nodes;
  }

  private static populateGrid(params: {
    prng: PRNG;
    layers: number;
    rules: any;
    width: number;
    height: number;
  }): { nodes: CampaignNode[]; grid: CampaignNode[][] } {
    const { prng, layers, rules, width, height } = params;
    const nodes: CampaignNode[] = [];
    const grid: CampaignNode[][] = [];

    for (let r = 0; r < layers; r++) {
      grid[r] = [];
      const nodeCount = r === 0 || r === layers - 1 ? 1 : SectorMapGenerator.LANES;

      for (let l = 0; l < nodeCount; l++) {
        const type = SectorMapGenerator.selectNodeType(r, layers, prng);
        const node: CampaignNode = {
          id: `node-${r}-${l}`,
          type,
          status: r === 0 ? "Accessible" : "Hidden",
          rank: r,
          difficulty: 1 + r * (rules.difficultyScaling || 1),
          mapSeed: prng.nextInt(0, 2147483647),
          connections: [],
          position: {
            x: (width / (layers + 1)) * (r + 1),
            y: (height / (nodeCount + 1)) * (l + 1),
          },
          bonusLootCount: 0,
        };

        if (type === "Combat") {
          if (r === 0 && !rules.skipPrologue) {
            node.missionType = MissionType.Prologue;
          } else {
            node.missionType = SectorMapGenerator.selectMissionType(prng);
          }
        }

        grid[r][l] = node;
        nodes.push(node);
      }
    }

    return { nodes, grid };
  }

  private static selectNodeType(rank: number, maxRank: number, prng: PRNG): CampaignNodeType {
    if (rank === 0) return "Combat";
    if (rank === maxRank - 1) return "Boss";

    const roll = prng.next();
    if (roll < 0.6) return "Combat";
    if (roll < 0.8) return "Shop";
    return "Event";
  }

  private static selectMissionType(prng: PRNG): MissionType {
    const types = [
      MissionType.Default,
      MissionType.RecoverIntel,
      MissionType.DestroyHive,
      MissionType.ExtractArtifacts,
      MissionType.EscortVIP,
    ];
    return types[prng.nextInt(0, types.length - 1)];
  }

  private static connectRanks(params: {
    prng: PRNG;
    layers: number;
    grid: CampaignNode[][];
  }): void {
    const { prng, layers, grid } = params;

    for (let r = 0; r < layers - 1; r++) {
      const currentRank = grid[r];
      const nextRank = grid[r + 1];

      // Sort both ranks by lane position (y) to enable monotonic connections
      const sortedCurrent = [...currentRank].sort((a, b) => a.position.y - b.position.y);
      const sortedNext = [...nextRank].sort((a, b) => a.position.y - b.position.y);

      // Track the minimum allowed target index to prevent crossings
      let minTargetIndex = 0;

      for (const node of sortedCurrent) {
        // Connect to a target at or below the minimum (monotonic constraint)
        const targetIndex = prng.nextInt(minTargetIndex, sortedNext.length - 1);
        node.connections.push(sortedNext[targetIndex].id);
        minTargetIndex = targetIndex;

        // Optional extra connection (must also be monotonic — same or higher index)
        if (sortedNext.length > 1 && prng.next() < 0.3) {
          const extraMin = targetIndex;
          const extraMax = Math.min(targetIndex + 1, sortedNext.length - 1);
          if (extraMax > extraMin || !node.connections.includes(sortedNext[extraMax].id)) {
            const extraTarget = prng.nextInt(extraMin, extraMax);
            if (!node.connections.includes(sortedNext[extraTarget].id)) {
              node.connections.push(sortedNext[extraTarget].id);
              minTargetIndex = extraTarget;
            }
          }
        }
      }

      // Ensure every node in next rank has at least one parent
      for (const nextNode of sortedNext) {
        const hasParent = currentRank.some((n) => n.connections.includes(nextNode.id));
        if (!hasParent) {
          // Find the closest parent by lane position to maintain monotonicity
          const nextIndex = sortedNext.indexOf(nextNode);
          let bestParent = sortedCurrent[0];
          let bestDist = Infinity;
          for (const parent of sortedCurrent) {
            const parentMaxTarget = parent.connections
              .map((id) => sortedNext.findIndex((n) => n.id === id))
              .reduce((max, idx) => Math.max(max, idx), -1);
            // Only allow connection if it doesn't create a crossing
            if (parentMaxTarget <= nextIndex) {
              const dist = Math.abs(parent.position.y - nextNode.position.y);
              if (dist < bestDist) {
                bestDist = dist;
                bestParent = parent;
              }
            }
          }
          bestParent.connections.push(nextNode.id);
        }
      }
    }
  }
}
