import {
  CampaignState,
  CampaignNode,
  CampaignSoldier,
  GameRules,
  MissionReport,
  CampaignOverrides,
  EventChoice,
} from "../../shared/campaign_types";
import { PRNG } from "../../shared/PRNG";
import { StorageProvider } from "../persistence/StorageProvider";
import { SectorMapGenerator } from "../generators/SectorMapGenerator";
import { MetaManager } from "./MetaManager";
import { EquipmentState, MapGeneratorType } from "../../shared/types";
import { RosterManager } from "./RosterManager";
import { MissionReconciler } from "./MissionReconciler";
import { EventManager } from "./EventManager";
import { CAMPAIGN_DEFAULTS } from "../config/CampaignDefaults";
import { Logger } from "../../shared/Logger";

import { CampaignStateSchema } from "../../shared/schemas";

const STORAGE_KEY = CAMPAIGN_DEFAULTS.STORAGE_KEY;

/**
 * Orchestrates the strategic layer of the game.
 * Manages persistent state, squad roster, and sector map progression.
 */
export class CampaignManager {
  private static instance: CampaignManager | null = null;
  private storage: StorageProvider;
  private state: CampaignState | null = null;
  private sectorMapGenerator: SectorMapGenerator;

  private rosterManager: RosterManager;
  private missionReconciler: MissionReconciler;
  private eventManager: EventManager;

  /**
   * Private constructor to enforce singleton pattern.
   * @param storage The storage provider to use for persistence.
   */
  private constructor(storage: StorageProvider) {
    this.storage = storage;
    this.sectorMapGenerator = new SectorMapGenerator();
    this.rosterManager = new RosterManager();
    this.missionReconciler = new MissionReconciler();
    this.eventManager = new EventManager();
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
   * Returns the storage provider being used by the manager.
   */
  public getStorage(): StorageProvider {
    return this.storage;
  }

  /**
   * Returns the current cloud synchronization status.
   */
  public getSyncStatus(): string {
    if (this.storage.getSyncStatus) {
      return this.storage.getSyncStatus();
    }
    return "local-only";
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
    mapGeneratorType?: MapGeneratorType,
    mapGrowthRate?: number,
  ): void {
    const rules = this.getRulesForDifficulty(difficulty);

    // Handle overrides
    const currentOverrides = overrides;
    if (typeof currentOverrides === "object" && currentOverrides !== null) {
      if (currentOverrides.deathRule)
        rules.deathRule = currentOverrides.deathRule;
      if (currentOverrides.allowTacticalPause !== undefined)
        rules.allowTacticalPause = currentOverrides.allowTacticalPause;
      if (currentOverrides.mapGeneratorType)
        rules.mapGeneratorType = currentOverrides.mapGeneratorType;
      if (currentOverrides.scaling !== undefined)
        rules.difficultyScaling = currentOverrides.scaling;
      if (currentOverrides.scarcity !== undefined)
        rules.resourceScarcity = currentOverrides.scarcity;
      if (currentOverrides.startingScrap !== undefined)
        rules.startingScrap = currentOverrides.startingScrap;
      if (currentOverrides.mapGrowthRate !== undefined)
        rules.mapGrowthRate = currentOverrides.mapGrowthRate;
      if (currentOverrides.baseEnemyCount !== undefined)
        rules.baseEnemyCount = currentOverrides.baseEnemyCount;
      if (currentOverrides.enemyGrowthPerMission !== undefined)
        rules.enemyGrowthPerMission = currentOverrides.enemyGrowthPerMission;
      if (currentOverrides.economyMode)
        rules.economyMode = currentOverrides.economyMode;
      if (currentOverrides.customSeed !== undefined) {
        rules.customSeed = currentOverrides.customSeed;
      }
    } else if (typeof currentOverrides === "boolean") {
      rules.allowTacticalPause = currentOverrides;
    }

    if (mapGeneratorType) rules.mapGeneratorType = mapGeneratorType;
    if (mapGrowthRate !== undefined) rules.mapGrowthRate = mapGrowthRate;

    const effectiveSeed = rules.customSeed ?? seed;
    const nodes = this.sectorMapGenerator.generate(effectiveSeed, rules);

    // Incorporate global meta-unlocks
    const metaStats = MetaManager.getInstance(this.storage).getStats();
    const unlockedArchetypes = Array.from(
      new Set([
        ...CAMPAIGN_DEFAULTS.UNLOCKED_ARCHETYPES,
        ...metaStats.unlockedArchetypes,
      ]),
    );
    const unlockedItems = [...metaStats.unlockedItems];

    const roster = this.rosterManager.generateInitialRoster(unlockedArchetypes);

    this.state = {
      version: CAMPAIGN_DEFAULTS.VERSION,
      saveVersion: 1,
      seed: effectiveSeed,
      status: "Active",
      rules,
      scrap: rules.startingScrap,
      intel: CAMPAIGN_DEFAULTS.STARTING_INTEL,
      currentSector: CAMPAIGN_DEFAULTS.STARTING_SECTOR,
      currentNodeId: null,
      nodes,
      roster,
      history: [],
      unlockedArchetypes,
      unlockedItems,
    };

    MetaManager.getInstance(this.storage).recordCampaignStarted();
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

  /**
   * Persists the current campaign state to the storage provider.
   */
  public save(): void {
    if (!this.state) return;
    this.state.saveVersion = (this.state.saveVersion || 0) + 1;
    this.storage.save(STORAGE_KEY, this.state);
  }

  /**
   * Loads the campaign state from the storage provider.
   * @returns True if the state was successfully loaded and validated.
   */
  public async load(): Promise<boolean> {
    try {
      let data: unknown;

      // If our storage is a SaveManager, we can use cloud sync
      if (this.storage.loadWithSync) {
        data = await this.storage.loadWithSync(STORAGE_KEY);
      } else {
        data = this.storage.load<unknown>(STORAGE_KEY);
      }

      if (data) {
        // First try lenient parsing with defaults
        const result = CampaignStateSchema.safeParse(data);
        if (result.success) {
          this.state = result.data as CampaignState;

          // Additional custom repair logic that Zod can't easily do
          if (typeof data === "object" && data !== null) {
            this.customRepair(this.state, data as Record<string, unknown>);
          }

          return true;
        } else {
          // If even with defaults it fails, try the full manual repair
          Logger.warn(
            "CampaignManager: Validation failed, attempting full recovery.",
            result.error.format(),
          );
          if (typeof data === "object" && data !== null) {
            this.state = this.validateAndRepair(
              data as Record<string, unknown>,
            );
            if (this.state) {
              return true;
            }
          }
        }
      }
    } catch (e) {
      Logger.warn("CampaignManager: Failed to load campaign state.", e);
    }
    return false;
  }

  /**
   * Performs custom repair logic that is too complex for Zod schemas.
   */
  private customRepair(state: CampaignState, _raw: Record<string, unknown>): void {
    // 1. Repair node connections (ensure they point to existing nodes)
    const allIds = new Set(state.nodes.map((n) => n.id));
    state.nodes.forEach((node) => {
      node.connections = node.connections.filter((id) => allIds.has(id));
    });
  }

  private validateAndRepair(
    data: Record<string, unknown>,
  ): CampaignState | null {
    // Basic structural checks - must have these top-level arrays
    if (!Array.isArray(data.nodes) || !Array.isArray(data.roster)) {
      return null;
    }

    try {
      const state = { ...data } as unknown as CampaignState;

      // 1. Repair basic fields
      if (state.version === undefined)
        state.version = (data.version as string) || CAMPAIGN_DEFAULTS.VERSION;
      if (state.seed === undefined) state.seed = (data.seed as number) || 0;
      if (!["Active", "Victory", "Defeat"].includes(state.status))
        state.status = "Active";
      if (state.scrap === undefined) state.scrap = (data.scrap as number) || 0;
      if (state.intel === undefined) state.intel = (data.intel as number) || 0;
      if (state.currentSector === undefined)
        state.currentSector = (data.currentSector as number) || 1;
      if (state.currentNodeId === undefined)
        state.currentNodeId = (data.currentNodeId as string) || null;
      if (!Array.isArray(state.history)) state.history = [];
      if (!Array.isArray(state.unlockedArchetypes))
        state.unlockedArchetypes = [...CAMPAIGN_DEFAULTS.UNLOCKED_ARCHETYPES];
      if (!Array.isArray(state.unlockedItems)) state.unlockedItems = [];

      // 2. Repair rules
      const rules = {
        ...((data.rules as Record<string, unknown>) || {}),
      } as unknown as GameRules;
      if (!rules.mode) rules.mode = "Custom";
      if (!rules.difficulty) rules.difficulty = "Clone";
      if (!rules.deathRule) rules.deathRule = "Clone";
      if (rules.allowTacticalPause === undefined)
        rules.allowTacticalPause = true;
      if (!rules.mapGeneratorType)
        rules.mapGeneratorType = MapGeneratorType.DenseShip;
      if (rules.difficultyScaling === undefined) rules.difficultyScaling = 1.0;
      if (rules.resourceScarcity === undefined) rules.resourceScarcity = 1.0;
      if (rules.startingScrap === undefined) rules.startingScrap = 500;
      if (rules.mapGrowthRate === undefined) rules.mapGrowthRate = 1.0;
      if (rules.baseEnemyCount === undefined) rules.baseEnemyCount = 3;
      if (rules.enemyGrowthPerMission === undefined)
        rules.enemyGrowthPerMission = 1.0;
      if (!rules.economyMode) rules.economyMode = "Open";
      state.rules = rules;

      // 3. Repair roster
      state.roster = ((data.roster as unknown[]) || []).map((s) => {
        const soldier = {
          ...(s as Record<string, unknown>),
        } as unknown as CampaignSoldier;
        if (soldier.hp === undefined) soldier.hp = 100;
        if (soldier.maxHp === undefined) soldier.maxHp = 100;
        if (soldier.soldierAim === undefined) soldier.soldierAim = 60;
        if (soldier.xp === undefined) soldier.xp = 0;
        if (soldier.level === undefined) soldier.level = 1;
        if (soldier.kills === undefined) soldier.kills = 0;
        if (soldier.missions === undefined) soldier.missions = 0;
        if (!["Healthy", "Wounded", "Dead"].includes(soldier.status))
          soldier.status = "Healthy";
        if (!soldier.equipment) soldier.equipment = {};
        if (soldier.recoveryTime === undefined) soldier.recoveryTime = 0;
        return soldier;
      });

      // 4. Repair nodes
      const allIds = new Set(
        ((data.nodes as unknown[]) || []).map(
          (n) => (n as Record<string, unknown>).id as string,
        ),
      );
      state.nodes = ((data.nodes as unknown[]) || []).map((n) => {
        const node = {
          ...(n as Record<string, unknown>),
        } as unknown as CampaignNode;
        if (!["Combat", "Elite", "Shop", "Event", "Boss"].includes(node.type)) {
          node.type = "Combat";
        }
        if (
          !["Hidden", "Revealed", "Accessible", "Cleared", "Skipped"].includes(
            node.status,
          )
        ) {
          node.status = "Hidden";
        }
        if (node.difficulty === undefined) node.difficulty = 1;
        if (node.rank === undefined) node.rank = 0;
        if (node.mapSeed === undefined) node.mapSeed = 0;
        if (node.bonusLootCount === undefined) node.bonusLootCount = 0;
        if (!node.position) node.position = { x: 0, y: 0 };
        if (!Array.isArray(node.connections)) {
          node.connections = [];
        } else {
          node.connections = node.connections.filter((id: string) =>
            allIds.has(id),
          );
        }
        return node;
      });

      // Final validation of repaired state
      const finalResult = CampaignStateSchema.safeParse(state);
      if (finalResult.success) {
        return finalResult.data as CampaignState;
      } else {
        Logger.warn(
          "CampaignManager: Repair failed:",
          finalResult.error.format(),
        );
        return null;
      }
    } catch (e) {
      Logger.warn("CampaignManager: Error during repair:", e);
      return null;
    }
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
    if (!this.state) {
      throw new Error(
        "CampaignManager: No active campaign state to process mission result.",
      );
    }

    const previousStatus = this.state.status;

    this.missionReconciler.processMissionResult(this.state, report);

    // 4.5 Update MetaManager
    const casualties = report.soldierResults.filter(
      (r) => r.status === "Dead",
    ).length;
    MetaManager.getInstance(this.storage).recordMissionResult(
      report.aliensKilled,
      casualties,
      report.result === "Won",
      report.scrapGained,
      report.intelGained,
    );

    // 5. Check for campaign end
    const wasActive = previousStatus === "Active";
    if (wasActive) {
      if (this.state.status === "Victory") {
        MetaManager.getInstance(this.storage).recordCampaignResult(true);
      } else if (this.state.status === "Defeat") {
        MetaManager.getInstance(this.storage).recordCampaignResult(false);
      }
    }

    this.save();
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
    if (!this.state) {
      throw new Error("CampaignManager: No active campaign state to advance.");
    }

    this.missionReconciler.advanceCampaignWithoutMission(
      this.state,
      nodeId,
      scrapGained,
      intelGained,
    );

    // Sync with MetaManager (0 kills, 0 casualties, mission "won")
    MetaManager.getInstance(this.storage).recordMissionResult(
      0,
      0,
      true,
      scrapGained,
      intelGained,
    );

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
   * @param name Optional name of the new soldier. If not provided, one will be generated.
   */
  public recruitSoldier(archetypeId: string, name?: string): string {
    if (!this.state) throw new Error("CampaignManager: No active campaign.");
    const id = this.rosterManager.recruitSoldier(this.state, archetypeId, name);
    this.save();
    return id;
  }

  /**
   * Heals a wounded soldier to full health.
   * @param soldierId The ID of the soldier to heal.
   */
  public healSoldier(soldierId: string): void {
    if (!this.state) {
      throw new Error(
        "CampaignManager: No active campaign state to heal soldier.",
      );
    }
    this.rosterManager.healSoldier(this.state, soldierId);
    this.save();
  }

  /**
   * Revives a dead soldier. Only allowed in 'Clone' death rule.
   * @param soldierId The ID of the soldier to revive.
   */
  public reviveSoldier(soldierId: string): void {
    if (!this.state) {
      throw new Error(
        "CampaignManager: No active campaign state to revive soldier.",
      );
    }
    this.rosterManager.reviveSoldier(this.state, soldierId);
    this.save();
  }

  /**
   * Deducts the given amount of scrap from the campaign balance.
   * @param amount The amount of scrap to spend.
   */
  public spendScrap(amount: number): void {
    if (!this.state) {
      throw new Error("CampaignManager: Campaign not initialized.");
    }
    if (this.state.scrap < amount) {
      throw new Error(
        `CampaignManager: Insufficient scrap: need ${amount}, have ${this.state.scrap}`,
      );
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
    if (!this.state) {
      throw new Error(
        "CampaignManager: No active campaign state to assign equipment.",
      );
    }
    this.rosterManager.assignEquipment(this.state, soldierId, equipment);
    this.save();
  }

  /**
   * Renames a soldier.
   * @param soldierId The ID of the soldier.
   * @param newName The new name for the soldier.
   */
  public renameSoldier(soldierId: string, newName: string): void {
    if (!this.state) {
      throw new Error(
        "CampaignManager: No active campaign state to rename soldier.",
      );
    }
    this.rosterManager.renameSoldier(this.state, soldierId, newName);
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

    const result = this.eventManager.applyEventChoice(
      this.state,
      nodeId,
      choice,
      prng,
      this.missionReconciler,
    );

    this.save();
    return result;
  }
}
