import {
  CampaignState,
  CampaignNode,
  GameRules,
  MissionReport,
  CampaignSoldier,
  CampaignNodeType,
} from "../../shared/campaign_types";
import { PRNG } from "../../shared/PRNG";
import { Vector2 } from "../../shared/types";
import { StorageProvider } from "../persistence/StorageProvider";

const STORAGE_KEY = "xenopurge_campaign_v1";

/**
 * Orchestrates the strategic layer of the game.
 * Manages persistent state, squad roster, and sector map progression.
 */
export class CampaignManager {
  private static instance: CampaignManager | null = null;
  private storage: StorageProvider;
  private state: CampaignState | null = null;

  /**
   * Private constructor to enforce singleton pattern.
   * @param storage The storage provider to use for persistence.
   */
  private constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  /**
   * Returns the singleton instance of the CampaignManager.
   * @param storage Optional storage provider (required for first call).
   */
  public static getInstance(storage?: StorageProvider): CampaignManager {
    if (!CampaignManager.instance) {
      if (!storage) {
        throw new Error(
          "CampaignManager: StorageProvider required for first initialization.",
        );
      }
      CampaignManager.instance = new CampaignManager(storage);
    }
    return CampaignManager.instance;
  }

  /**
   * Reset the singleton instance (useful for tests).
   */
  public static resetInstance(): void {
    CampaignManager.instance = null;
  }

  /**
   * Starts a new campaign with the given seed and difficulty.
   */
  public startNewCampaign(seed: number, difficulty: string): void {
    const prng = new PRNG(seed);

    const rules: GameRules = this.getRulesForDifficulty(difficulty);

    const nodes = this.generateSectorMap(seed, rules);
    const roster = this.generateInitialRoster(prng);

    this.state = {
      version: "0.41.3", // Current project version
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

    // TODO: Implement proper DAG generation (Handled by another task)
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
  ): CampaignNodeType {
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

  /**
   * Persists the current campaign state to the storage provider.
   */
  public save(): void {
    if (!this.state) return;
    this.storage.save(STORAGE_KEY, this.state);
  }

  /**
   * Loads the campaign state from the storage provider.
   * @returns True if the state was successfully loaded.
   */
  public load(): boolean {
    const data = this.storage.load<CampaignState>(STORAGE_KEY);
    if (data) {
      this.state = data;
      return true;
    }
    return false;
  }

  /**
   * Returns all nodes that are currently accessible to the player.
   */
  public getAvailableNodes(): CampaignNode[] {
    if (!this.state) return [];
    return this.state.nodes.filter((n) => n.status === "Accessible");
  }

  /**
   * Reconciles the campaign state with the result of a completed mission.
   * @param report Detailed report of the mission outcome.
   */
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

        // Handle death rules
        if (soldier.status === "Dead") {
          if (this.state!.rules.deathRule === "Simulation") {
            soldier.status = "Healthy";
            soldier.hp = soldier.maxHp;
          }
          // Note: "Clone" and "Iron" rules are handled by keeping status as "Dead".
          // In "Clone" mode, player can revive them in Barracks (spent scrap).
          // In "Iron" mode, they stay dead.
        }
      }
    });

    // 4. Record history
    this.state.history.push(report);

    this.save();
  }

  /**
   * Returns the current campaign state.
   */
  public getState(): CampaignState | null {
    return this.state;
  }
}
