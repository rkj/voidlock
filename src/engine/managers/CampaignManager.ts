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
import { MetaManager } from "./MetaManager";
import {
  ArchetypeLibrary,
  EquipmentState,
  UnitStyle,
  MapGeneratorType,
  MissionType,
} from "../../shared/types";
import { RosterManager } from "../campaign/RosterManager";
import { MissionReconciler } from "../campaign/MissionReconciler";
import { EventManager } from "../campaign/EventManager";

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
    const roster = this.rosterManager.generateInitialRoster(prng);

    this.state = {
      version: "0.100.0", // Current project version
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
    this.storage.save(STORAGE_KEY, this.state);
  }

  /**
   * Loads the campaign state from the storage provider.
   * @returns True if the state was successfully loaded and validated.
   */
  public load(): boolean {
    try {
      const data = this.storage.load<any>(STORAGE_KEY);
      if (data) {
        const validated = this.validateState(data);
        if (validated) {
          this.state = validated;
          return true;
        }
      }
    } catch (e) {
      console.warn("CampaignManager: Failed to load campaign state.", e);
    }
    return false;
  }

  private validateState(data: any): CampaignState | null {
    if (!data || typeof data !== "object") return null;

    // Required top-level fields
    const requiredFields = ["version", "seed", "status", "rules", "scrap", "intel", "nodes", "roster"];
    for (const field of requiredFields) {
      if (data[field] === undefined) {
        console.warn(`CampaignManager: Missing required field '${field}' in persisted state.`);
        return null;
      }
    }

    // Validate Status
    const validStatuses = ["Active", "Victory", "Defeat"];
    if (!validStatuses.includes(data.status)) {
      data.status = "Active";
    }

    // Validate Rules
    if (!data.rules || typeof data.rules !== "object") return null;
    const defaultRules = this.getRulesForDifficulty(data.rules.difficulty || "Standard");
    data.rules = { ...defaultRules, ...data.rules };

    // Validate Roster
    if (!Array.isArray(data.roster)) return null;
    data.roster = data.roster.map((s: any, index: number) => {
      if (!s || typeof s !== "object" || !s.archetypeId) {
        // Highly corrupted soldier, but we must try to maintain roster size if possible
        // Better to just filter out completely broken ones if we can, 
        // but here we just ensure basic fields.
        return null;
      }
      const arch = ArchetypeLibrary[s.archetypeId];
      return {
        id: s.id || `soldier_recovered_${index}`,
        name: s.name || `Recovered Recruit ${index + 1}`,
        archetypeId: s.archetypeId,
        hp: typeof s.hp === "number" ? s.hp : (arch ? arch.baseHp : 100),
        maxHp: typeof s.maxHp === "number" ? s.maxHp : (arch ? arch.baseHp : 100),
        soldierAim: typeof s.soldierAim === "number" ? s.soldierAim : (arch ? arch.soldierAim : 80),
        xp: typeof s.xp === "number" ? s.xp : 0,
        level: typeof s.level === "number" ? s.level : 1,
        kills: typeof s.kills === "number" ? s.kills : 0,
        missions: typeof s.missions === "number" ? s.missions : 0,
        status: ["Healthy", "Wounded", "Dead"].includes(s.status) ? s.status : "Healthy",
        recoveryTime: typeof s.recoveryTime === "number" ? s.recoveryTime : 0,
        equipment: s.equipment || {
          rightHand: arch?.rightHand,
          leftHand: arch?.leftHand,
          body: arch?.body,
          feet: arch?.feet,
        },
      };
    }).filter((s: any) => s !== null);

    // Validate Nodes
    if (!Array.isArray(data.nodes)) return null;
    const nodeIds = new Set(data.nodes.map((n: any) => n.id));
    data.nodes = data.nodes.map((n: any) => {
      if (!n || typeof n !== "object" || !n.id) return null;
      return {
        ...n,
        type: ["Combat", "Shop", "Event", "Boss", "Elite"].includes(n.type) ? n.type : "Combat",
        status: ["Hidden", "Revealed", "Accessible", "Cleared", "Skipped"].includes(n.status) ? n.status : "Hidden",
        connections: Array.isArray(n.connections) ? n.connections.filter((id: any) => nodeIds.has(id)) : [],
      };
    }).filter((n: any) => n !== null);

    // If nodes list became empty, the campaign is unplayable
    if (data.nodes.length === 0) return null;

    return data as CampaignState;
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

  private checkBankruptcy(): boolean {
    if (!this.state) return false;
    return this.missionReconciler.checkBankruptcy(this.state);
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
   * @param name The name of the new soldier.
   */
  public recruitSoldier(archetypeId: string, name: string): void {
    if (!this.state) return;
    this.rosterManager.recruitSoldier(this.state, archetypeId, name);
    this.save();
  }

  /**
   * Heals a wounded soldier to full health.
   * @param soldierId The ID of the soldier to heal.
   */
  public healSoldier(soldierId: string): void {
    if (!this.state) return;
    this.rosterManager.healSoldier(this.state, soldierId);
    this.save();
  }

  /**
   * Revives a dead soldier. Only allowed in 'Clone' death rule.
   * @param soldierId The ID of the soldier to revive.
   */
  public reviveSoldier(soldierId: string): void {
    if (!this.state) return;
    this.rosterManager.reviveSoldier(this.state, soldierId);
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
    this.rosterManager.assignEquipment(this.state, soldierId, equipment);
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
