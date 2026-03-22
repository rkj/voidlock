import type {
  CampaignState,
  CampaignNode,
  CampaignSoldier,
  GameRules,
  MissionReport,
  CampaignOverrides,
  EventChoice,
} from "../../shared/campaign_types";
import type { PRNG } from "../../shared/PRNG";
import type { StorageProvider } from "../persistence/StorageProvider";
import { SectorMapGenerator } from "../generators/SectorMapGenerator";
import { MetaManager } from "./MetaManager";
import type { EquipmentState} from "../../shared/types";
import { MapGeneratorType } from "../../shared/types";
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

  private listeners: Set<() => void> = new Set();

  /**
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
   * @deprecated Use constructor injection via AppServiceRegistry.
   */
  public static getInstance(storage?: StorageProvider): CampaignManager {
    if (!CampaignManager.instance) {
      if (!storage) {
        throw new Error(
          "CampaignManager: StorageProvider required for first initialization.",
        );
      }
      console.log("CampaignManager: Initializing NEW instance with storage=" + storage.constructor.name);
      CampaignManager.instance = new CampaignManager(storage);
    } else {
      console.log("CampaignManager: Returning EXISTING instance with storage=" + (CampaignManager.instance as any).storage.constructor.name);
    }
    return CampaignManager.instance;
  }

  /**
   * Sets the storage provider to use.
   */
  public setStorage(storage: StorageProvider): void {
    this.storage = storage;
  }

  /**
   * Returns the storage provider being used by the manager.
   */
  public getStorage(): StorageProvider {
    return this.storage;
  }

  /**
   * Resets the singleton instance (for testing).
   */
  public static resetSingleton(): void {
    console.log("CampaignManager: Resetting singleton instance");
    CampaignManager.instance = null;
  }

  /**
   * Adds a listener for campaign state changes.
   */
  public addChangeListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  /**
   * Removes a listener for campaign state changes.
   */
  public removeChangeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notifies all listeners of a campaign state change.
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
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
  public startNewCampaign({
    seed,
    difficulty,
    overrides,
    mapGeneratorType,
    mapGrowthRate,
  }: {
    seed: number;
    difficulty: string;
    overrides?: CampaignOverrides | boolean;
    mapGeneratorType?: MapGeneratorType;
    mapGrowthRate?: number;
  }): void {
    console.log("CampaignManager.startNewCampaign instance:", this);
    const rules = this.getRulesForDifficulty(difficulty);

    // Incorporate global meta-unlocks
    const metaStats = MetaManager.getInstance(this.storage).getStats();
    
    // Default skipPrologue from metaStats
    rules.skipPrologue = metaStats.prologueCompleted;

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
      if (currentOverrides.skipPrologue !== undefined)
        rules.skipPrologue = currentOverrides.skipPrologue;
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
      lastModifiedAt: Date.now(),
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
          mapGrowthRate: 0.5,
          baseEnemyCount: 2,
          enemyGrowthPerMission: 0.5,
          economyMode: "Open",
          skipPrologue: false,
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
          mapGrowthRate: 0.5,
          baseEnemyCount: 3,
          enemyGrowthPerMission: 1.0,
          economyMode: "Open",
          skipPrologue: false,
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
          mapGrowthRate: 0.5,
          baseEnemyCount: 4,
          enemyGrowthPerMission: 1.5,
          economyMode: "Open",
          skipPrologue: false,
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
          mapGrowthRate: 0.5,
          baseEnemyCount: 5,
          enemyGrowthPerMission: 2.0,
          economyMode: "Open",
          skipPrologue: false,
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
          mapGrowthRate: 0.5,
          baseEnemyCount: 3,
          enemyGrowthPerMission: 1.0,
          economyMode: "Open",
          skipPrologue: false,
        };
    }
  }

  /**
   * Persists the current campaign state to the storage provider.
   */
  public save(): void {
    if (!this.state) return;
    this.state.saveVersion = (this.state.saveVersion || 0) + 1;
    this.state.lastModifiedAt = Date.now();
    this.storage.save(STORAGE_KEY, this.state);
    this.notifyListeners();
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
        } 
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

  private repairBasicFields(state: CampaignState, data: Record<string, unknown>): void {
    state.version ??= (data.version as string) || CAMPAIGN_DEFAULTS.VERSION;
    state.seed ??= (data.seed as number) || 0;
    state.lastModifiedAt ??= (data.lastModifiedAt as number) || 0;
    if (!["Active", "Victory", "Defeat"].includes(state.status)) state.status = "Active";
    state.scrap ??= (data.scrap as number) || 0;
    state.intel ??= (data.intel as number) || 0;
    state.currentSector ??= (data.currentSector as number) || 1;
    if (state.currentNodeId === undefined) state.currentNodeId = (data.currentNodeId as string) || null;
    if (!Array.isArray(state.history)) state.history = [];
    if (!Array.isArray(state.unlockedArchetypes)) state.unlockedArchetypes = [...CAMPAIGN_DEFAULTS.UNLOCKED_ARCHETYPES];
    if (!Array.isArray(state.unlockedItems)) state.unlockedItems = [];
  }

  private repairRules(state: CampaignState, data: Record<string, unknown>): void {
    const rules = { ...((data.rules as Record<string, unknown>) || {}) } as unknown as GameRules;
    if (!rules.mode) rules.mode = "Custom";
    if (!rules.difficulty) rules.difficulty = "Clone";
    if (!rules.deathRule) rules.deathRule = "Clone";
    rules.allowTacticalPause ??= true;
    if (!rules.mapGeneratorType) rules.mapGeneratorType = MapGeneratorType.DenseShip;
    rules.difficultyScaling ??= 1.0;
    rules.resourceScarcity ??= 1.0;
    rules.startingScrap ??= 500;
    rules.mapGrowthRate ??= 0.5;
    rules.baseEnemyCount ??= 3;
    rules.enemyGrowthPerMission ??= 1.0;
    if (!rules.economyMode) rules.economyMode = "Open";
    state.rules = rules;
  }

  private repairRoster(state: CampaignState, data: Record<string, unknown>): void {
    state.roster = ((data.roster as unknown[]) || []).map((s) => {
      const soldier = { ...(s as Record<string, unknown>) } as unknown as CampaignSoldier;
      soldier.hp ??= 100;
      soldier.maxHp ??= 100;
      soldier.soldierAim ??= 60;
      soldier.xp ??= 0;
      soldier.level ??= 1;
      soldier.kills ??= 0;
      soldier.missions ??= 0;
      if (!["Healthy", "Wounded", "Dead"].includes(soldier.status)) soldier.status = "Healthy";
      if (!soldier.equipment) soldier.equipment = {};
      soldier.recoveryTime ??= 0;
      return soldier;
    });
  }

  private repairNodes(state: CampaignState, data: Record<string, unknown>): void {
    const allIds = new Set(
      ((data.nodes as unknown[]) || []).map((n) => (n as Record<string, unknown>).id as string),
    );
    state.nodes = ((data.nodes as unknown[]) || []).map((n) => {
      const node = { ...(n as Record<string, unknown>) } as unknown as CampaignNode;
      if (!["Combat", "Elite", "Shop", "Event", "Boss"].includes(node.type)) node.type = "Combat";
      if (!["Hidden", "Revealed", "Accessible", "Cleared", "Skipped"].includes(node.status)) node.status = "Hidden";
      node.difficulty ??= 1;
      node.rank ??= 0;
      node.mapSeed ??= 0;
      node.bonusLootCount ??= 0;
      if (!node.position) node.position = { x: 0, y: 0 };
      if (!Array.isArray(node.connections)) {
        node.connections = [];
      } else {
        node.connections = node.connections.filter((id: string) => allIds.has(id));
      }
      return node;
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

      this.repairBasicFields(state, data);
      this.repairRules(state, data);
      this.repairRoster(state, data);
      this.repairNodes(state, data);

      // Final validation of repaired state
      const finalResult = CampaignStateSchema.safeParse(state);
      if (finalResult.success) {
        return finalResult.data as CampaignState;
      }
      Logger.warn("CampaignManager: Repair failed:", finalResult.error.format());
      return null;
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

    // 4.1 Record Prologue completion
    const node = this.state.nodes.find((n) => n.id === report.nodeId);
    if (
      node?.missionType === "Prologue" &&
      report.result === "Won"
    ) {
      MetaManager.getInstance(this.storage).recordPrologueCompleted();
    }

    this.missionReconciler.processMissionResult(this.state, report);

    // 4.5 Update MetaManager
    const casualties = report.soldierResults.filter(
      (r) => r.status === "Dead",
    ).length;
    MetaManager.getInstance(this.storage).recordMissionResult({
      kills: report.aliensKilled,
      casualties,
      won: report.result === "Won",
      scrapGained: report.scrapGained,
      intelGained: report.intelGained,
    });

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
    MetaManager.getInstance(this.storage).recordMissionResult({
      kills: 0,
      casualties: 0,
      won: true,
      scrapGained,
      intelGained,
    });

    this.save();
  }

  /**
   * Returns the current campaign state.
   */
  public getState(): CampaignState | null {
    if (this.state === null) console.log("CampaignManager.getState() state is null on instance:", this);
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

    const result = this.eventManager.applyEventChoice({
      state: this.state,
      nodeId,
      choice,
      prng,
      reconciler: this.missionReconciler,
    });

    this.save();
    return result;
  }
}
