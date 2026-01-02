import {
  CampaignState,
  CampaignNode,
  GameRules,
  MissionReport,
  CampaignSoldier,
} from "../../shared/campaign_types";
import { PRNG } from "../../shared/PRNG";
import { Vector2 } from "../../shared/types";

const STORAGE_KEY = "xenopurge_campaign_v1";

export class CampaignManager {
  private state: CampaignState | null = null;

  constructor() {}

  public startNewCampaign(seed: number, difficulty: string): void {
    const prng = new PRNG(seed);

    const rules: GameRules = this.getRulesForDifficulty(difficulty);

    const nodes = this.generateSectorMap(seed, rules);
    const roster = this.generateInitialRoster(prng);

    this.state = {
      version: "0.38.0", // Current project version
      seed,
      rules,
      scrap: 500,
      intel: 0,
      currentSector: 1,
      currentNodeId: null,
      nodes,
      roster,
      history: [],
      unlockedArchetypes: ["assault", "medic", "scout", "heavy"],
    };

    this.save();
  }

  private getRulesForDifficulty(difficulty: string): GameRules {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return {
          mode: "Custom",
          deathRule: "Simulation",
          difficultyScaling: 0.8,
          resourceScarcity: 1.2,
        };
      case "hard":
        return {
          mode: "Custom",
          deathRule: "Iron",
          difficultyScaling: 1.5,
          resourceScarcity: 0.7,
        };
      case "normal":
      default:
        return {
          mode: "Custom",
          deathRule: "Clone",
          difficultyScaling: 1.0,
          resourceScarcity: 1.0,
        };
    }
  }

  private generateSectorMap(seed: number, rules: GameRules): CampaignNode[] {
    const prng = new PRNG(seed);
    const nodes: CampaignNode[] = [];
    const layers = 10;
    const nodesPerLayer = 3;

    // TODO: Implement proper DAG generation
    // For now, a very simple linear-ish DAG

    let previousLayerNodes: CampaignNode[] = [];

    for (let l = 0; l < layers; l++) {
      const currentLayerNodes: CampaignNode[] = [];
      const numNodes =
        l === 0 || l === layers - 1 ? 1 : prng.nextInt(2, nodesPerLayer);

      for (let i = 0; i < numNodes; i++) {
        const id = `node_${l}_${i}`;
        const type = this.getRandomNodeType(l, layers, prng);
        const node: CampaignNode = {
          id,
          type,
          status: l === 0 ? "Accessible" : "Hidden",
          difficulty: 1 + l * rules.difficultyScaling,
          mapSeed: prng.nextInt(0, 1000000),
          connections: [],
          position: {
            x: l * 100,
            y: i * 100 + (nodesPerLayer - numNodes) * 50,
          },
        };
        nodes.push(node);
        currentLayerNodes.push(node);
      }

      if (previousLayerNodes.length > 0) {
        // Connect previous layer to current layer
        previousLayerNodes.forEach((prev) => {
          // Each node connects to at least one in next layer
          const targetIndex = prng.nextInt(0, currentLayerNodes.length - 1);
          prev.connections.push(currentLayerNodes[targetIndex].id);

          // Potentially connect to more
          if (currentLayerNodes.length > 1 && prng.next() > 0.6) {
            let secondTarget;
            do {
              secondTarget = prng.nextInt(0, currentLayerNodes.length - 1);
            } while (secondTarget === targetIndex);
            prev.connections.push(currentLayerNodes[secondTarget].id);
          }
        });

        // Ensure every node in current layer has at least one incoming connection
        currentLayerNodes.forEach((curr) => {
          const hasIncoming = previousLayerNodes.some((prev) =>
            prev.connections.includes(curr.id),
          );
          if (!hasIncoming) {
            const sourceIndex = prng.nextInt(0, previousLayerNodes.length - 1);
            previousLayerNodes[sourceIndex].connections.push(curr.id);
          }
        });
      }

      previousLayerNodes = currentLayerNodes;
    }

    return nodes;
  }

  private getRandomNodeType(
    layer: number,
    totalLayers: number,
    prng: PRNG,
  ): any {
    if (layer === 0) return "Combat";
    if (layer === totalLayers - 1) return "Boss";

    const roll = prng.next();
    if (roll < 0.6) return "Combat";
    if (roll < 0.8) return "Elite";
    if (roll < 0.9) return "Shop";
    return "Event";
  }

  private generateInitialRoster(prng: PRNG): CampaignSoldier[] {
    const archetypes = ["assault", "medic", "scout", "heavy"];
    const roster: CampaignSoldier[] = [];

    for (let i = 0; i < 4; i++) {
      const arch = archetypes[i % archetypes.length];
      roster.push({
        id: `soldier_${i}`,
        name: `Recruit ${i + 1}`,
        archetypeId: arch,
        hp: 100,
        maxHp: 100,
        xp: 0,
        level: 1,
        kills: 0,
        missions: 0,
        status: "Healthy",
        equipment: {},
      });
    }
    return roster;
  }

  public save(): void {
    if (!this.state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("Failed to save campaign state", e);
    }
  }

  public load(): boolean {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.state = JSON.parse(data);
        return true;
      }
    } catch (e) {
      console.error("Failed to load campaign state", e);
    }
    return false;
  }

  public getAvailableNodes(): CampaignNode[] {
    if (!this.state) return [];
    return this.state.nodes.filter((n) => n.status === "Accessible");
  }

  public processMissionResult(report: MissionReport): void {
    if (!this.state) return;

    // 1. Update node status
    const node = this.state.nodes.find((n) => n.id === report.nodeId);
    if (node) {
      node.status = "Cleared";
      this.state.currentNodeId = node.id;

      // Unlock connected nodes
      node.connections.forEach((connId) => {
        const nextNode = this.state!.nodes.find((n) => n.id === connId);
        if (nextNode && nextNode.status === "Hidden") {
          nextNode.status = "Accessible";
        }
      });
    }

    // 2. Update resources
    this.state.scrap += report.scrapGained;
    this.state.intel += report.intelGained;

    // 3. Update soldiers
    report.soldierResults.forEach((res) => {
      const soldier = this.state!.roster.find((s) => s.id === res.soldierId);
      if (soldier) {
        soldier.xp += res.xpGained;
        soldier.kills += res.kills;
        soldier.missions += 1;
        soldier.status = res.status;
        if (res.promoted && res.newLevel) {
          soldier.level = res.newLevel;
        }
        // Basic HP handling - if they died they stay dead (if Iron mode)
        // or get cloned (if Clone mode and we have scrap)
        // This logic might need to be more complex based on GameRules
        if (soldier.status === "Dead") {
          if (this.state!.rules.deathRule === "Simulation") {
            soldier.status = "Healthy";
            soldier.hp = soldier.maxHp;
          } else if (this.state!.rules.deathRule === "Clone") {
            // Clone cost logic could go here, for now they just stay dead
            // until user revives them in Barracks
          }
        }
      }
    });

    // 4. Record history
    this.state.history.push(report);

    this.save();
  }

  public getState(): CampaignState | null {
    return this.state;
  }
}
