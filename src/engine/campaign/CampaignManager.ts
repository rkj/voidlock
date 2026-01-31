import {
  CampaignState,
  CampaignNode,
  GameRules,
  MissionReport,
  CampaignSoldier,
  CampaignOverrides,
  EventChoice,
  CampaignNodeType,
  CampaignNodeStatus,
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
} from "../../shared/types";
import { RosterManager } from "./RosterManager";
import { MissionReconciler } from "./MissionReconciler";
import { EventManager } from "./EventManager";
import { CAMPAIGN_DEFAULTS } from "../config/CampaignDefaults";

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
    const rules = this.getRulesForDifficulty(difficulty);

    // Handle overrides
    const currentOverrides = overrides;
    if (typeof currentOverrides === "object" && currentOverrides !== null) {
      if (currentOverrides.deathRule) rules.deathRule = currentOverrides.deathRule;
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
      if (currentOverrides.economyMode) rules.economyMode = currentOverrides.economyMode;
      if (currentOverrides.themeId) rules.themeId = currentOverrides.themeId;
      if (currentOverrides.unitStyle) rules.unitStyle = currentOverrides.unitStyle;
      if (currentOverrides.customSeed !== undefined) {
        rules.customSeed = currentOverrides.customSeed;
      }
    } else {
      // Legacy argument mapping
      if (typeof currentOverrides === "boolean") {
        rules.allowTacticalPause = currentOverrides;
      }
      if (themeId) rules.themeId = themeId;
      if (unitStyle) rules.unitStyle = unitStyle;
      if (mapGeneratorType) rules.mapGeneratorType = mapGeneratorType;
      if (mapGrowthRate !== undefined) rules.mapGrowthRate = mapGrowthRate;
    }

    const effectiveSeed = rules.customSeed ?? seed;
    const nodes = this.sectorMapGenerator.generate(effectiveSeed, rules);
    const roster = this.rosterManager.generateInitialRoster();

    this.state = {
      version: CAMPAIGN_DEFAULTS.VERSION,
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
      unlockedArchetypes: [...CAMPAIGN_DEFAULTS.UNLOCKED_ARCHETYPES],
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
      const data = this.storage.load<unknown>(STORAGE_KEY);
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

  private validateState(data: unknown): CampaignState | null {
    if (!data || typeof data !== "object") return null;

    const candidate = data as Record<string, unknown>;

    // Required top-level fields
    const requiredFields = [
      "version",
      "seed",
      "status",
      "rules",
      "scrap",
      "intel",
      "nodes",
      "roster",
    ];
    for (const field of requiredFields) {
      if (candidate[field] === undefined) {
        console.warn(
          `CampaignManager: Missing required field '${field}' in persisted state.`,
        );
        return null;
      }
    }

    // Validate Status
    const validStatuses = ["Active", "Victory", "Defeat"];
    let status = candidate.status as string;
    if (!validStatuses.includes(status)) {
      status = "Active";
    }

    // Validate Rules
    if (!candidate.rules || typeof candidate.rules !== "object") return null;
    const rulesCandidate = candidate.rules as Record<string, unknown>;
    const defaultRules = this.getRulesForDifficulty(
      (rulesCandidate.difficulty as string) || "Standard",
    );
    const rules = { ...defaultRules, ...candidate.rules };

    // Validate Roster
    if (!Array.isArray(candidate.roster)) return null;
    const roster = candidate.roster
      .map((s: unknown, index: number) => {
        if (!s || typeof s !== "object" || !("archetypeId" in s)) {
          return null;
        }
        const soldierCandidate = s as Record<string, unknown>;
        const archetypeId = (soldierCandidate.archetypeId as string) || "assault";
        const arch = ArchetypeLibrary[archetypeId];
        return {
          id: (soldierCandidate.id as string) || `soldier_recovered_${index}`,
          name: (soldierCandidate.name as string) || `Recovered Recruit ${index + 1}`,
          tacticalNumber: typeof soldierCandidate.tacticalNumber === "number" ? soldierCandidate.tacticalNumber : index + 1,
          archetypeId: archetypeId,
          hp: typeof soldierCandidate.hp === "number" ? soldierCandidate.hp : arch ? arch.baseHp : 100,
          maxHp:
            typeof soldierCandidate.maxHp === "number" ? soldierCandidate.maxHp : arch ? arch.baseHp : 100,
          soldierAim:
            typeof soldierCandidate.soldierAim === "number"
              ? soldierCandidate.soldierAim
              : arch
                ? arch.soldierAim
                : 80,
          xp: typeof soldierCandidate.xp === "number" ? soldierCandidate.xp : 0,
          level: typeof soldierCandidate.level === "number" ? soldierCandidate.level : 1,
          kills: typeof soldierCandidate.kills === "number" ? soldierCandidate.kills : 0,
          missions: typeof soldierCandidate.missions === "number" ? soldierCandidate.missions : 0,
          status: ["Healthy", "Wounded", "Dead"].includes(soldierCandidate.status as string)
            ? (soldierCandidate.status as "Healthy" | "Wounded" | "Dead")
            : "Healthy",
          recoveryTime: typeof soldierCandidate.recoveryTime === "number" ? soldierCandidate.recoveryTime : 0,
          equipment: (soldierCandidate.equipment as EquipmentState) || {
            rightHand: arch?.rightHand,
            leftHand: arch?.leftHand,
            body: arch?.body,
            feet: arch?.feet,
          },
        };
      })
      .filter((s: CampaignSoldier | null): s is CampaignSoldier => s !== null);

    // Validate Nodes
    if (!Array.isArray(candidate.nodes)) return null;
    const nodeIds = new Set(candidate.nodes.map((n: unknown) => {
      if (n && typeof n === "object" && "id" in n) {
        return (n as Record<string, unknown>).id as string;
      }
      return "";
    }).filter(id => id !== ""));
    const nodes = candidate.nodes
      .map((n: unknown) => {
        if (!n || typeof n !== "object" || !("id" in n)) return null;
        const nodeCandidate = n as Record<string, unknown>;
        return {
          ...nodeCandidate,
          type: ["Combat", "Shop", "Event", "Boss", "Elite"].includes(nodeCandidate.type as string)
            ? (nodeCandidate.type as CampaignNodeType)
            : "Combat",
          status: [
            "Hidden",
            "Revealed",
            "Accessible",
            "Cleared",
            "Skipped",
          ].includes(nodeCandidate.status as string)
            ? (nodeCandidate.status as CampaignNodeStatus)
            : "Hidden",
          connections: Array.isArray(nodeCandidate.connections)
            ? nodeCandidate.connections.filter((id: unknown) => typeof id === "string" && nodeIds.has(id))
            : [],
        } as CampaignNode;
      })
      .filter((n: CampaignNode | null): n is CampaignNode => n !== null);

    // If nodes list became empty, the campaign is unplayable
    if (nodes.length === 0) return null;

    return {
      ...candidate,
      status,
      rules,
      roster,
      nodes,
    } as CampaignState;
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
      throw new Error("CampaignManager: No active campaign state to process mission result.");
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
      throw new Error("CampaignManager: No active campaign state to heal soldier.");
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
      throw new Error("CampaignManager: No active campaign state to revive soldier.");
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
      throw new Error("CampaignManager: No active campaign state to assign equipment.");
    }
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
