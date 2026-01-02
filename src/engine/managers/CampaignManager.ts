import {
  CampaignState,
  CampaignNode,
  GameRules,
  MissionReport,
  CampaignSoldier,
  XP_THRESHOLDS,
  STAT_BOOSTS,
  calculateLevel,
} from "../../shared/campaign_types";
import { PRNG } from "../../shared/PRNG";
import { StorageProvider } from "../persistence/StorageProvider";
import { SectorMapGenerator } from "../generators/SectorMapGenerator";
import { ArchetypeLibrary } from "../../shared/types";

const STORAGE_KEY = "xenopurge_campaign_v1";

/**
 * Orchestrates the strategic layer of the game.
 * Manages persistent state, squad roster, and sector map progression.
 */
export class CampaignManager {
  private static instance: CampaignManager | null = null;
  private storage: StorageProvider;
  private state: CampaignState | null = null;
  private sectorMapGenerator: SectorMapGenerator;

  /**
   * Private constructor to enforce singleton pattern.
   * @param storage The storage provider to use for persistence.
   */
  private constructor(storage: StorageProvider) {
    this.storage = storage;
    this.sectorMapGenerator = new SectorMapGenerator();
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

    const rules = this.getRulesForDifficulty(difficulty);

    const nodes = this.sectorMapGenerator.generate(seed, rules);
    const roster = this.generateInitialRoster(prng);

    this.state = {
      version: "0.43.2", // Current project version
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

  private generateInitialRoster(prng: PRNG): CampaignSoldier[] {
    const archetypes = ["assault", "medic", "scout", "heavy"];
    const roster: CampaignSoldier[] = [];

    for (let i = 0; i < 4; i++) {
      const archId = archetypes[i % archetypes.length];
      const arch = ArchetypeLibrary[archId];
      roster.push({
        id: `soldier_${i}`,
        name: `Recruit ${i + 1}`,
        archetypeId: archId,
        hp: arch ? arch.baseHp : 100,
        maxHp: arch ? arch.baseHp : 100,
        soldierAim: arch ? arch.soldierAim : 80,
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
        if (
          nextNode &&
          (nextNode.status === "Hidden" || nextNode.status === "Revealed")
        ) {
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
        const oldLevel = soldier.level;
        soldier.xp += res.xpGained;
        soldier.kills += res.kills;
        soldier.missions += 1;
        soldier.status = res.status;

        const newLevel = calculateLevel(soldier.xp);
        if (newLevel > oldLevel) {
          const levelsGained = newLevel - oldLevel;
          soldier.level = newLevel;
          soldier.maxHp += levelsGained * STAT_BOOSTS.hpPerLevel;
          soldier.hp += levelsGained * STAT_BOOSTS.hpPerLevel;
          soldier.soldierAim += levelsGained * STAT_BOOSTS.aimPerLevel;

          // Update the result so UI can show the promotion
          res.promoted = true;
          res.newLevel = newLevel;
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
