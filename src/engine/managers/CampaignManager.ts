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
import {
  ArchetypeLibrary,
  EquipmentState,
  UnitStyle,
  MapGeneratorType,
} from "../../shared/types";

const STORAGE_KEY = "voidlock_campaign_v1";

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
   * Resets the campaign state, effectively deleting the current campaign.
   */
  public reset(): void {
    this.state = null;
    this.storage.save(STORAGE_KEY, null);
  }

  /**
   * Deletes the campaign save from storage.
   */
  public deleteSave(): void {
    this.state = null;
    this.storage.remove(STORAGE_KEY);
  }

  /**
   * Starts a new campaign with the given seed and difficulty.
   */
  public startNewCampaign(
    seed: number,
    difficulty: string,
    allowTacticalPause?: boolean,
    themeId?: string,
    unitStyle?: UnitStyle,
    mapGeneratorType?: MapGeneratorType,
    mapGrowthRate?: number,
  ): void {
    const prng = new PRNG(seed);

    const rules = this.getRulesForDifficulty(difficulty);
    if (allowTacticalPause !== undefined) {
      rules.allowTacticalPause = allowTacticalPause;
    }
    if (themeId) {
      rules.themeId = themeId;
    }
    if (unitStyle) {
      rules.unitStyle = unitStyle;
    }
    if (mapGeneratorType) {
      rules.mapGeneratorType = mapGeneratorType;
    }
    if (mapGrowthRate !== undefined) {
      rules.mapGrowthRate = mapGrowthRate;
    }

    const nodes = this.sectorMapGenerator.generate(seed, rules);
    const roster = this.generateInitialRoster(prng);

    this.state = {
      version: "0.75.0", // Current project version
      seed,
      status: "Active",
      rules,
      scrap: rules.startingScrap,
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
      case "simulation":
      case "easy":
        return {
          mode: "Custom",
          difficulty: "Simulation",
          deathRule: "Simulation",
          allowTacticalPause: true,
          mapGeneratorType: MapGeneratorType.DenseShip,
          difficultyScaling: 0.8,
          resourceScarcity: 1.2,
          startingScrap: 1000,
          mapGrowthRate: 1.0,
        };
      case "clone":
      case "normal":
        return {
          mode: "Custom",
          difficulty: "Clone",
          deathRule: "Clone",
          allowTacticalPause: true,
          mapGeneratorType: MapGeneratorType.DenseShip,
          difficultyScaling: 1.0,
          resourceScarcity: 1.0,
          startingScrap: 500,
          mapGrowthRate: 1.0,
        };
      case "standard":
      case "hard":
        return {
          mode: "Custom",
          difficulty: "Standard",
          deathRule: "Iron",
          allowTacticalPause: true,
          mapGeneratorType: MapGeneratorType.DenseShip,
          difficultyScaling: 1.5,
          resourceScarcity: 0.7,
          startingScrap: 300,
          mapGrowthRate: 1.0,
        };
      case "ironman":
      case "extreme":
        return {
          mode: "Custom",
          difficulty: "Ironman",
          deathRule: "Iron",
          allowTacticalPause: false,
          mapGeneratorType: MapGeneratorType.DenseShip,
          difficultyScaling: 2.0,
          resourceScarcity: 0.5,
          startingScrap: 150,
          mapGrowthRate: 1.0,
        };
      default:
        return {
          mode: "Custom",
          difficulty: "Clone",
          deathRule: "Clone",
          allowTacticalPause: true,
          mapGeneratorType: MapGeneratorType.DenseShip,
          difficultyScaling: 1.0,
          resourceScarcity: 1.0,
          startingScrap: 500,
          mapGrowthRate: 1.0,
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
        equipment: {
          rightHand: arch?.rightHand,
          leftHand: arch?.leftHand,
          body: arch?.body,
          feet: arch?.feet,
        },
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

    // 2.5 Handle Ironman Defeat
    if (this.state.rules.deathRule === "Iron" && report.result === "Lost") {
      this.state.status = "Defeat";
    }

    // 3. Update soldiers
    this.state.roster.forEach((s) => {
      if (s.recoveryTime && s.recoveryTime > 0) {
        s.recoveryTime--;
        if (s.recoveryTime === 0 && s.status === "Wounded") {
          s.status = "Healthy";
          s.hp = s.maxHp;
        }
      }
    });

    report.soldierResults.forEach((res) => {
      const soldier = this.state!.roster.find((s) => s.id === res.soldierId);
      if (soldier) {
        res.xpBefore = soldier.xp;
        const oldLevel = soldier.level;

        // Calculate XP:
        // - Mission: +50 for Win, +10 for Loss
        // - Survival: +20 for Healthy/Wounded
        // - Kills: +10 per kill
        const missionXp = report.result === "Won" ? 50 : 10;
        const survivalXp =
          res.status === "Healthy" || res.status === "Wounded" ? 20 : 0;
        const killXp = res.kills * 10;

        res.xpGained = missionXp + survivalXp + killXp;

        soldier.xp += res.xpGained;
        soldier.kills += res.kills;
        soldier.missions += 1;
        soldier.status = res.status;

        if (soldier.status === "Wounded") {
          soldier.recoveryTime = 1; // Out for 1 mission
          res.recoveryTime = 1;
        }

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

  /**
   * Recruits a new soldier of the given archetype.
   * @param archetypeId The ID of the archetype to recruit.
   * @param name The name of the new soldier.
   */
  public recruitSoldier(archetypeId: string, name: string): void {
    if (!this.state) return;

    const COST = 100;
    if (this.state.scrap < COST) {
      throw new Error("Insufficient scrap to recruit soldier.");
    }

    const arch = ArchetypeLibrary[archetypeId];
    if (!arch) {
      throw new Error(`Invalid archetype ID: ${archetypeId}`);
    }

    const newSoldier: CampaignSoldier = {
      id: `soldier_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      archetypeId,
      hp: arch.baseHp,
      maxHp: arch.baseHp,
      soldierAim: arch.soldierAim,
      xp: 0,
      level: 1,
      kills: 0,
      missions: 0,
      status: "Healthy",
      equipment: {
        rightHand: arch.rightHand,
        leftHand: arch.leftHand,
        body: arch.body,
        feet: arch.feet,
      },
    };

    this.state.scrap -= COST;
    this.state.roster.push(newSoldier);
    this.save();
  }

  /**
   * Heals a wounded soldier to full health.
   * @param soldierId The ID of the soldier to heal.
   */
  public healSoldier(soldierId: string): void {
    if (!this.state) return;

    const COST = 50;
    if (this.state.scrap < COST) {
      throw new Error("Insufficient scrap to heal soldier.");
    }

    const soldier = this.state.roster.find((s) => s.id === soldierId);
    if (!soldier) {
      throw new Error(`Soldier not found: ${soldierId}`);
    }

    if (soldier.status !== "Wounded") {
      throw new Error("Soldier is not wounded.");
    }

    this.state.scrap -= COST;
    soldier.status = "Healthy";
    soldier.hp = soldier.maxHp;
    this.save();
  }

  /**
   * Revives a dead soldier. Only allowed in 'Clone' death rule.
   * @param soldierId The ID of the soldier to revive.
   */
  public reviveSoldier(soldierId: string): void {
    if (!this.state) return;

    if (this.state.rules.deathRule !== "Clone") {
      throw new Error("Revival only allowed in 'Clone' mode.");
    }

    const COST = 250;
    if (this.state.scrap < COST) {
      throw new Error("Insufficient scrap to revive soldier.");
    }

    const soldier = this.state.roster.find((s) => s.id === soldierId);
    if (!soldier) {
      throw new Error(`Soldier not found: ${soldierId}`);
    }

    if (soldier.status !== "Dead") {
      throw new Error("Soldier is not dead.");
    }

    this.state.scrap -= COST;
    soldier.status = "Healthy";
    soldier.hp = soldier.maxHp;
    this.save();
  }

  /**
   * Deducts the given amount of scrap from the campaign balance.
   * @param amount The amount of scrap to spend.
   */
  public spendScrap(amount: number): void {
    if (!this.state) return;
    if (this.state.scrap < amount) {
      throw new Error("Insufficient scrap.");
    }
    this.state.scrap -= amount;
    this.save();
  }

  /**
   * Assigns new equipment to a soldier.
   * @param soldierId The ID of the soldier.
   * @param equipment The new equipment state.
   */
  public assignEquipment(soldierId: string, equipment: EquipmentState): void {
    if (!this.state) return;

    const soldier = this.state.roster.find((s) => s.id === soldierId);
    if (!soldier) {
      throw new Error(`Soldier not found: ${soldierId}`);
    }

    soldier.equipment = { ...equipment };
    this.save();
  }
}
