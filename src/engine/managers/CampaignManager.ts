import {
  CampaignState,
  CampaignNode,
  GameRules,
  MissionReport,
  CampaignSoldier,
  CampaignOverrides,
  XP_THRESHOLDS,
  STAT_BOOSTS,
  calculateLevel,
  EventChoice,
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
    overrides?: CampaignOverrides | boolean, // Support legacy boolean for allowTacticalPause
    themeId?: string,
    unitStyle?: UnitStyle,
    mapGeneratorType?: MapGeneratorType,
    mapGrowthRate?: number,
  ): void {
    const prng = new PRNG(seed);

    const rules = this.getRulesForDifficulty(difficulty);

    // Handle overrides
    if (typeof overrides === "object" && overrides !== null) {
      if (overrides.deathRule) rules.deathRule = overrides.deathRule;
      if (overrides.allowTacticalPause !== undefined)
        rules.allowTacticalPause = overrides.allowTacticalPause;
      if (overrides.mapGeneratorType)
        rules.mapGeneratorType = overrides.mapGeneratorType;
      if (overrides.scaling !== undefined)
        rules.difficultyScaling = overrides.scaling;
      if (overrides.scarcity !== undefined)
        rules.resourceScarcity = overrides.scarcity;
      if (overrides.startingScrap !== undefined)
        rules.startingScrap = overrides.startingScrap;
      if (overrides.mapGrowthRate !== undefined)
        rules.mapGrowthRate = overrides.mapGrowthRate;
      if (overrides.baseEnemyCount !== undefined)
        rules.baseEnemyCount = overrides.baseEnemyCount;
      if (overrides.enemyGrowthPerMission !== undefined)
        rules.enemyGrowthPerMission = overrides.enemyGrowthPerMission;
      if (overrides.economyMode) rules.economyMode = overrides.economyMode;
      if (overrides.themeId) rules.themeId = overrides.themeId;
      if (overrides.unitStyle) rules.unitStyle = overrides.unitStyle;
      if (overrides.customSeed !== undefined) {
        rules.customSeed = overrides.customSeed;
      }
    } else {
      // Legacy argument mapping
      if (overrides !== undefined) {
        rules.allowTacticalPause = overrides;
      }
      if (themeId) rules.themeId = themeId;
      if (unitStyle) rules.unitStyle = unitStyle;
      if (mapGeneratorType) rules.mapGeneratorType = mapGeneratorType;
      if (mapGrowthRate !== undefined) rules.mapGrowthRate = mapGrowthRate;
    }

    const effectiveSeed = rules.customSeed ?? seed;
    const nodes = this.sectorMapGenerator.generate(effectiveSeed, rules);
    const roster = this.generateInitialRoster(prng);

    this.state = {
      version: "0.90.0", // Current project version
      seed: effectiveSeed,
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
          baseEnemyCount: 2,
          enemyGrowthPerMission: 0.5,
          economyMode: "Open",
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
          baseEnemyCount: 3,
          enemyGrowthPerMission: 1.0,
          economyMode: "Open",
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
          baseEnemyCount: 4,
          enemyGrowthPerMission: 1.5,
          economyMode: "Open",
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
          baseEnemyCount: 5,
          enemyGrowthPerMission: 2.0,
          economyMode: "Open",
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
          baseEnemyCount: 3,
          enemyGrowthPerMission: 1.0,
          economyMode: "Open",
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
      this.state.currentSector = node.rank + 2;

      // All nodes that were Accessible but NOT this one become Skipped
      this.state.nodes.forEach((n) => {
        if (n.status === "Accessible" && n.id !== node.id) {
          n.status = "Skipped";
        }
      });

      // Unlock connected nodes
      node.connections.forEach((connId) => {
        const nextNode = this.state!.nodes.find((n) => n.id === connId);
        if (
          nextNode &&
          (nextNode.status === "Hidden" ||
            nextNode.status === "Revealed" ||
            nextNode.status === "Accessible")
        ) {
          nextNode.status = "Accessible";
        }
      });
    }

    // 2. Update resources
    this.state.scrap += report.scrapGained;
    this.state.intel += report.intelGained;

    // 2.5 Handle Ironman Defeat
    if (this.state.rules.difficulty === "Ironman" && report.result === "Lost") {
      this.state.status = "Defeat";
    }

    // 2.6 Handle Campaign Victory
    if (report.result === "Won" && node?.type === "Boss") {
      this.state.status = "Victory";
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
        // Dead soldiers get 0 XP (spec/campaign.md#3.3)
        if (res.status === "Dead") {
          res.xpGained = 0;
          res.promoted = false;
        } else {
          const missionXp = report.result === "Won" ? 50 : 10;
          const survivalXp =
            res.status === "Healthy" || res.status === "Wounded" ? 20 : 0;
          const killXp = res.kills * 10;

          res.xpGained = missionXp + survivalXp + killXp;
        }

        soldier.xp += res.xpGained;
        soldier.kills += res.kills;
        soldier.missions += 1;
        soldier.status = res.status;

        if (soldier.status === "Wounded") {
          soldier.recoveryTime = 1; // Out for 1 mission
          res.recoveryTime = 1;
        }

        if (res.status !== "Dead") {
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

    // 5. Check for bankruptcy/defeat
    if (this.checkBankruptcy()) {
      this.state.status = "Defeat";
    }

    this.save();
  }

  private checkBankruptcy(): boolean {
    if (!this.state) return false;

    // Bankruptcy occurs if:
    // 1. Active Roster is empty (All dead). 
    //    Wounded soldiers count as alive because they recover over time.
    // 2. AND Scrap < 100 (Cannot recruit a new soldier).
    const aliveCount = this.state.roster.filter(
      (s) => s.status !== "Dead",
    ).length;
    const canAffordRecruit = this.state.scrap >= 100;

    return aliveCount === 0 && !canAffordRecruit;
  }

  /**
   * Advances the campaign without a combat mission (for Shop/Event nodes).
   * @param nodeId The ID of the node being cleared.
   * @param scrapGained Amount of scrap gained.
   * @param intelGained Amount of intel gained.
   */
  public advanceCampaignWithoutMission(
    nodeId: string,
    scrapGained: number,
    intelGained: number,
  ): void {
    if (!this.state) return;

    const node = this.state.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.status = "Cleared";
      this.state.currentNodeId = node.id;
      this.state.currentSector = node.rank + 2;

      // All nodes that were Accessible but NOT this one become Skipped
      this.state.nodes.forEach((n) => {
        if (n.status === "Accessible" && n.id !== node.id) {
          n.status = "Skipped";
        }
      });

      // Unlock connected nodes
      node.connections.forEach((connId) => {
        const nextNode = this.state!.nodes.find((n) => n.id === connId);
        if (
          nextNode &&
          (nextNode.status === "Hidden" ||
            nextNode.status === "Revealed" ||
            nextNode.status === "Accessible")
        ) {
          nextNode.status = "Accessible";
        }
      });
    }

    this.state.scrap += scrapGained;
    this.state.intel += intelGained;

    // Save history as a pseudo-report
    this.state.history.push({
      nodeId: nodeId,
      seed: 0,
      result: "Won",
      aliensKilled: 0,
      scrapGained: scrapGained,
      intelGained: intelGained,
      timeSpent: 0,
      soldierResults: [],
    });

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

  /**
   * Applies the outcome of a narrative event choice.
   * @param nodeId The ID of the event node.
   * @param choice The choice made by the player.
   * @param prng Seeded random number generator for risk calculation.
   * @returns A description of what happened.
   */
  public applyEventChoice(
    nodeId: string,
    choice: EventChoice,
    prng: PRNG,
  ): { text: string; ambush: boolean } {
    if (!this.state) throw new Error("No active campaign.");

    let outcomeText = "";
    let ambushOccurred = false;

    // 1. Handle Costs
    if (choice.cost) {
      if (choice.cost.scrap) {
        if (this.state.scrap < choice.cost.scrap)
          throw new Error("Not enough scrap.");
        this.state.scrap -= choice.cost.scrap;
        outcomeText += `Spent ${choice.cost.scrap} Scrap. `;
      }
      if (choice.cost.intel) {
        if (this.state.intel < choice.cost.intel)
          throw new Error("Not enough intel.");
        this.state.intel -= choice.cost.intel;
        outcomeText += `Spent ${choice.cost.intel} Intel. `;
      }
    }

    // 2. Handle Risks
    if (choice.risk) {
      if (prng.next() < choice.risk.chance) {
        if (choice.risk.damage) {
          const healthyRoster = this.state.roster.filter(
            (s) => s.status === "Healthy",
          );
          if (healthyRoster.length > 0) {
            const victim =
              healthyRoster[Math.floor(prng.next() * healthyRoster.length)];
            const damageAmount = Math.floor(victim.maxHp * choice.risk.damage);
            victim.hp -= damageAmount;
            if (victim.hp <= 0) {
              victim.hp = 0;
              victim.status = "Wounded";
              victim.recoveryTime = 2; // Extra recovery time for event injuries
              outcomeText += `${victim.name} was seriously injured! `;
            } else {
              outcomeText += `${victim.name} took ${damageAmount} damage. `;
            }
          }
        }
        if (choice.risk.ambush) {
          ambushOccurred = true;
          outcomeText += "It's an ambush! ";
        }
      }
    }

    // 3. Handle Rewards
    if (!ambushOccurred) {
      if (choice.reward) {
        if (choice.reward.scrap) {
          this.state.scrap += choice.reward.scrap;
          outcomeText += `Gained ${choice.reward.scrap} Scrap. `;
        }
        if (choice.reward.intel) {
          this.state.intel += choice.reward.intel;
          outcomeText += `Gained ${choice.reward.intel} Intel. `;
        }
        if (choice.reward.recruit) {
          const archetypes = ["assault", "medic", "scout", "heavy"];
          const archId = archetypes[Math.floor(prng.next() * archetypes.length)];
          const arch = ArchetypeLibrary[archId];
          const newSoldier: CampaignSoldier = {
            id: `soldier_${Date.now()}_${Math.floor(prng.next() * 1000)}`,
            name: `Volunteer ${this.state.roster.length + 1}`,
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
          };
          this.state.roster.push(newSoldier);
          outcomeText += `Recruited ${newSoldier.name} (${archId}). `;
        }
      }
    }

    if (outcomeText === "") outcomeText = "Nothing happened.";

    // 4. Advance campaign
    if (!ambushOccurred) {
      this.advanceCampaignWithoutMission(nodeId, 0, 0);
    } else {
      const node = this.state.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.type = "Combat";
        node.missionType = "Hive";
      }
    }

    this.save();
    return { text: outcomeText.trim(), ambush: ambushOccurred };
  }
}
