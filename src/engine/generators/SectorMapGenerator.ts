import type {
  CampaignNode,
  CampaignNodeType,
  GameRules} from "../../shared/types";
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

    const growthRate = rules.mapGrowthRate || 1.0;
    const defaultLayers = Math.ceil(6 / growthRate) + 1;
    const layers = options.targetLength || options.layers || defaultLayers;

    const width = options.width || 800;
    const height = options.height || 600;

    const { nodes, grid } = this.populateGrid({ prng, layers, rules, width, height });
    this.connectRanks({ prng, layers, grid });

    return nodes;
  }

  private populateGrid({ prng, layers, rules, width, height }: {
    prng: PRNG; layers: number; rules: GameRules; width: number; height: number;
  }): { nodes: CampaignNode[]; grid: (CampaignNode | null)[][] } {
    const nodes: CampaignNode[] = [];
    const grid: (CampaignNode | null)[][] = Array.from({ length: layers }, () =>
      Array(SectorMapGenerator.LANES).fill(null),
    );

    const startLane = prng.nextInt(1, 2);
    const bossLane = prng.nextInt(1, 2);

    for (let r = 0; r < layers; r++) {
      const activeLanes = this.getActiveLanes({ prng, r, layers, startLane, bossLane });
      const layerX = (r / (layers - 1)) * width;

      for (const lane of activeLanes) {
        const id = `node_${r}_${lane}`;
        const type = this.getNodeType(r, layers, prng);

        const laneHeight = height / SectorMapGenerator.LANES;
        const jitterY = (prng.next() - 0.5) * (laneHeight * 0.4);
        const nodeY = (lane + 0.5) * laneHeight + jitterY;

        const node: CampaignNode = {
          id,
          type,
          status: r === 0 ? "Accessible" : "Revealed",
          difficulty: 1 + r * rules.difficultyScaling,
          rank: r,
          mapSeed: prng.nextInt(0, 1000000),
          missionType:
            r === 0 && !rules.skipPrologue
              ? MissionType.Prologue
              : this.getNodeMissionType(type, prng),
          connections: [],
          position: {
            x: layerX,
            y: nodeY,
          },
          bonusLootCount: prng.nextInt(0, 3),
        };
        grid[r][lane] = node;
        nodes.push(node);
      }
    }

    return { nodes, grid };
  }

  private getActiveLanes({ prng, r, layers, startLane, bossLane }: {
    prng: PRNG; r: number; layers: number; startLane: number; bossLane: number;
  }): number[] {
    if (r === 0) return [startLane];
    if (r === layers - 1) return [bossLane];

    const numNodes = prng.nextInt(3, 4);
    const possibleLanes = [0, 1, 2, 3].filter((l) => {
      const distFromStart = Math.abs(l - startLane);
      const distFromBoss = Math.abs(l - bossLane);
      return distFromStart <= r && distFromBoss <= layers - 1 - r;
    });

    const lanes = [...possibleLanes];
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = prng.nextInt(0, i);
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    return lanes.slice(0, Math.min(numNodes, lanes.length)).sort();
  }

  private connectRanks({ prng, layers, grid }: {
    prng: PRNG; layers: number; grid: (CampaignNode | null)[][];
  }): void {
    for (let r = 0; r < layers - 1; r++) {
      const currentRankNodes = grid[r].filter((n): n is CampaignNode => n !== null);
      const nextRankNodes = grid[r + 1].filter((n): n is CampaignNode => n !== null);

      this.makeForwardConnections({ prng, currentRankNodes, nextRankNodes });
      this.ensureAllNodesHaveIncoming({ currentRankNodes, nextRankNodes });
      this.ensureAllNodesHaveOutgoing({ nextRankNodes, currentRankNodes });
    }
  }

  private makeForwardConnections({ prng, currentRankNodes, nextRankNodes }: {
    prng: PRNG; currentRankNodes: CampaignNode[]; nextRankNodes: CampaignNode[];
  }): void {
    let lastTargetIdx = 0;

    for (let i = 0; i < currentRankNodes.length; i++) {
      const node = currentRankNodes[i];
      const lane = parseInt(node.id.split("_")[2]);

      const potentialTargets = nextRankNodes.filter((target) => {
        const targetLane = parseInt(target.id.split("_")[2]);
        return targetLane >= lane - 1 && targetLane <= lane + 1;
      });

      const validTargets = potentialTargets.filter((target) => {
        const targetIdx = nextRankNodes.indexOf(target);
        return targetIdx >= lastTargetIdx;
      });

      if (validTargets.length === 0) continue;

      const numConnections = prng.next() > 0.7 && validTargets.length > 1 ? 2 : 1;
      for (let c = 0; c < numConnections; c++) {
        const idx = prng.nextInt(0, validTargets.length - 1);
        const target = validTargets[idx];
        if (!node.connections.includes(target.id)) {
          node.connections.push(target.id);
        }
      }
      node.connections.sort((a, b) => {
        const laneA = parseInt(a.split("_")[2]);
        const laneB = parseInt(b.split("_")[2]);
        return laneA - laneB;
      });

      const maxTargetId = node.connections[node.connections.length - 1];
      const maxTargetNode = nextRankNodes.find((n) => n.id === maxTargetId);
      if (maxTargetNode) {
        lastTargetIdx = nextRankNodes.indexOf(maxTargetNode);
      }
    }
  }

  private ensureAllNodesHaveIncoming({ currentRankNodes, nextRankNodes }: {
    currentRankNodes: CampaignNode[]; nextRankNodes: CampaignNode[];
  }): void {
    for (const nextNode of nextRankNodes) {
      const hasIncoming = currentRankNodes.some((curr) =>
        curr.connections.includes(nextNode.id),
      );
      if (hasIncoming) continue;

      const nextLane = parseInt(nextNode.id.split("_")[2]);
      const possibleSources = currentRankNodes.filter((curr) => {
        const currLane = parseInt(curr.id.split("_")[2]);
        if (currLane < nextLane - 1 || currLane > nextLane + 1) return false;

        const prevNodes = currentRankNodes.slice(0, currentRankNodes.indexOf(curr));
        const allPrevTargetsValid = prevNodes.every((prev) => {
          if (prev.connections.length === 0) return true;
          const lastTargetId = prev.connections[prev.connections.length - 1];
          const lastTargetLane = parseInt(lastTargetId.split("_")[2]);
          return lastTargetLane <= nextLane;
        });

        const afterNodes = currentRankNodes.slice(currentRankNodes.indexOf(curr) + 1);
        const allNextTargetsValid = afterNodes.every((nxt) => {
          if (nxt.connections.length === 0) return true;
          const firstTargetId = nxt.connections[0];
          const firstTargetLane = parseInt(firstTargetId.split("_")[2]);
          return firstTargetLane >= nextLane;
        });

        return allPrevTargetsValid && allNextTargetsValid;
      });

      if (possibleSources.length === 0) continue;

      possibleSources.sort((a, b) => {
        const distA = Math.abs(parseInt(a.id.split("_")[2]) - nextLane);
        const distB = Math.abs(parseInt(b.id.split("_")[2]) - nextLane);
        return distA - distB;
      });
      possibleSources[0].connections.push(nextNode.id);
      possibleSources[0].connections.sort((a, b) => {
        const laneA = parseInt(a.split("_")[2]);
        const laneB = parseInt(b.split("_")[2]);
        return laneA - laneB;
      });
    }
  }

  private ensureAllNodesHaveOutgoing({ nextRankNodes, currentRankNodes }: {
    nextRankNodes: CampaignNode[]; currentRankNodes: CampaignNode[];
  }): void {
    for (const node of currentRankNodes) {
      if (node.connections.length > 0) continue;

      const lane = parseInt(node.id.split("_")[2]);
      const fallbackTargets = nextRankNodes.filter((t) => {
        const tLane = parseInt(t.id.split("_")[2]);
        return tLane >= lane - 1 && tLane <= lane + 1;
      });
      if (fallbackTargets.length === 0) continue;

      fallbackTargets.sort((a, b) => {
        const distA = Math.abs(parseInt(a.id.split("_")[2]) - lane);
        const distB = Math.abs(parseInt(b.id.split("_")[2]) - lane);
        return distA - distB;
      });
      node.connections.push(fallbackTargets[0].id);
    }
  }

  private getNodeMissionType(
    nodeType: CampaignNodeType,
    prng: PRNG,
  ): MissionType | undefined {
    if (nodeType === "Shop" || nodeType === "Event") {
      return undefined;
    }

    const types = [
      MissionType.RecoverIntel,
      MissionType.ExtractArtifacts,
      MissionType.DestroyHive,
      MissionType.EscortVIP,
    ];

    return types[prng.nextInt(0, types.length - 1)];
  }

  private getNodeType(
    rank: number,
    totalLayers: number,
    prng: PRNG,
  ): CampaignNodeType {
    if (rank === 0) return "Combat";
    if (rank === 1) return "Combat"; // Guarantee Mission 2 tutorial flow
    if (rank === totalLayers - 1) return "Boss";

    const roll = prng.next();
    if (roll < 0.6) return "Combat";
    if (roll < 0.8) return "Elite";
    if (roll < 0.9) return "Shop";
    return "Event";
  }
}
