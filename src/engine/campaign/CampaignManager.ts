import type { CampaignSoldier, CampaignState, CampaignNode, CampaignOverrides } from "@src/shared/campaign_types";
import type { GameRules } from "@src/shared/campaign_types";
import { PRNG } from "@src/shared/PRNG";
import { MapGeneratorType } from "@src/shared/types";
import type { StorageProvider } from "../persistence/StorageProvider";
import { SectorMapGenerator } from "../generators/SectorMapGenerator";
import { RosterManager } from "./RosterManager";
import { MissionReconciler } from "./MissionReconciler";
import { EventManager } from "./EventManager";
import { MetaManager } from "./MetaManager";

const STORAGE_KEY = "voidlock_campaign_state";

export class CampaignManager {
  private static instance: CampaignManager | null = null;
  private state: CampaignState | null = null;
  private storage: StorageProvider;
  private listeners: Set<() => void> = new Set();

  private constructor(storage: StorageProvider) {
    this.storage = storage;
    this.load();
  }

  public static getInstance(storage?: StorageProvider): CampaignManager {
    if (!CampaignManager.instance) {
      if (!storage) {
        throw new Error("CampaignManager: StorageProvider required for initialization");
      }
      CampaignManager.instance = new CampaignManager(storage);
    }
    return CampaignManager.instance;
  }

  public getState(): CampaignState | null {
    return this.state;
  }

  /**
   * Loads the campaign state from storage.
   */
  public load(): boolean {
    const data = this.storage.load(STORAGE_KEY);
    if (data) {
      this.state = data as CampaignState;
      if (this.migrateNodePositions()) {
        this.storage.save(STORAGE_KEY, this.state);
      }
      return true;
    }
    return false;
  }

  /**
   * Recompute node positions to ensure left-to-right layout (rank→x, lane→y).
   * Fixes saves created before the position swap fix.
   * Returns true if positions were changed.
   */
  private migrateNodePositions(): boolean {
    if (!this.state) return false;
    const nodes = this.state.nodes;
    if (nodes.length === 0) return false;

    const maxRank = Math.max(...nodes.map((n) => n.rank));
    const width = 800;
    const height = 600;
    const layers = maxRank + 1;

    // Check if migration is needed: rank 0 node should have smallest x
    const rank0 = nodes.find((n) => n.rank === 0);
    const expectedX = width / (layers + 1);
    if (rank0 && Math.abs(rank0.position.x - expectedX) < 1) return false;

    for (const node of nodes) {
      const nodesAtRank = nodes.filter((n) => n.rank === node.rank);
      const laneIndex = nodesAtRank.indexOf(node);
      const laneCount = nodesAtRank.length;
      node.position = {
        x: (width / (layers + 1)) * (node.rank + 1),
        y: (height / (laneCount + 1)) * (laneIndex + 1),
      };
    }
    return true;
  }

  /**
   * Saves the current campaign state to storage.
   */
  private save(): void {
    if (this.state) {
      this.state.lastModifiedAt = Date.now();
      this.storage.save(STORAGE_KEY, this.state);
      this.notifyListeners();
    }
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

  public static resetSingleton(): void {
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
  public startNewCampaign(config: {
    seed: number;
    difficulty: string;
    overrides?: CampaignOverrides | boolean;
    mapGeneratorType?: MapGeneratorType;
    mapGrowthRate?: number;
  } | number, argDifficulty?: string, argOverrides?: CampaignOverrides | boolean, argMapGen?: MapGeneratorType, argGrowth?: number): void {
    
    let seed: number;
    let difficulty: string;
    let overrides: CampaignOverrides | boolean | undefined;
    let mapGeneratorType: MapGeneratorType | undefined;
    let mapGrowthRate: number | undefined;

    if (typeof config === "number") {
        seed = config;
        difficulty = argDifficulty || "Standard";
        overrides = argOverrides;
        mapGeneratorType = argMapGen;
        mapGrowthRate = argGrowth;
    } else {
        seed = config.seed;
        difficulty = config.difficulty;
        overrides = config.overrides;
        mapGeneratorType = config.mapGeneratorType;
        mapGrowthRate = config.mapGrowthRate;
    }

    const rules = this.getRulesForDifficulty(difficulty);

    // Incorporate global meta-unlocks
    const metaManager = MetaManager.getInstance(this.storage);
    const metaStats = metaManager.getStats();
    
    // Default skipPrologue from metaStats
    rules.skipPrologue = metaStats.prologueCompleted;

    // Handle overrides
    if (typeof overrides === "object" && overrides !== null) {
      if (overrides.deathRule) rules.deathRule = overrides.deathRule;
      if (overrides.allowTacticalPause !== undefined) rules.allowTacticalPause = overrides.allowTacticalPause;
      if (overrides.mapGeneratorType) rules.mapGeneratorType = overrides.mapGeneratorType;
      if (overrides.scaling !== undefined) rules.difficultyScaling = overrides.scaling;
      if (overrides.scarcity !== undefined) rules.resourceScarcity = overrides.scarcity;
      if (overrides.startingScrap !== undefined) rules.startingScrap = overrides.startingScrap;
      if (overrides.mapGrowthRate !== undefined) rules.mapGrowthRate = overrides.mapGrowthRate;
      if (overrides.baseEnemyCount !== undefined) rules.baseEnemyCount = overrides.baseEnemyCount;
      if (overrides.enemyGrowthPerMission !== undefined) rules.enemyGrowthPerMission = overrides.enemyGrowthPerMission;
      if (overrides.economyMode) rules.economyMode = overrides.economyMode;
      if (overrides.skipPrologue !== undefined) rules.skipPrologue = overrides.skipPrologue;
      if (overrides.customSeed !== undefined) rules.customSeed = overrides.customSeed;
    } else if (typeof overrides === "boolean") {
      rules.allowTacticalPause = overrides;
    }

    // Manual arguments take ultimate priority
    if (mapGeneratorType) rules.mapGeneratorType = mapGeneratorType;
    if (mapGrowthRate !== undefined) rules.mapGrowthRate = mapGrowthRate;

    const prng = new PRNG(seed);
    const initialRoster = RosterManager.generateInitialRoster(prng, metaStats.unlockedArchetypes);

    const nodes = SectorMapGenerator.generate({
      seed: rules.customSeed ?? seed,
      rankCount: Math.ceil(6 / rules.mapGrowthRate) + 1,
      rules
    });

    this.state = {
      version: "1.0.0",
      saveVersion: 1,
      seed,
      rules,
      status: "Active",
      scrap: rules.startingScrap,
      intel: 0,
      roster: initialRoster,
      nodes,
      currentNodeId: null,
      history: [],
      currentSector: 1,
      lastModifiedAt: Date.now(),
      unlockedArchetypes: metaStats.unlockedArchetypes ?? [],
      unlockedItems: [],
    };

    this.save();
  }

  public getRulesForDifficulty(difficulty: string): GameRules {
    const d = difficulty.toLowerCase();
    if (d === "simulation") {
        return {
          mode: "Preset",
          deathRule: "Simulation",
          allowTacticalPause: true,
          difficultyScaling: 0.8,
          resourceScarcity: 0.8,
          startingScrap: 1000,
          mapGeneratorType: MapGeneratorType.DenseShip,
          mapGrowthRate: 0.5,
          baseEnemyCount: 2,
          enemyGrowthPerMission: 0.5,
          economyMode: "Open",
          skipPrologue: false,
          difficulty: "Simulation"
        };
    } if (d === "iron") {
        return {
          mode: "Preset",
          deathRule: "Iron",
          allowTacticalPause: true,
          difficultyScaling: 1.2,
          resourceScarcity: 1.2,
          startingScrap: 400,
          mapGeneratorType: MapGeneratorType.DenseShip,
          mapGrowthRate: 0.5,
          baseEnemyCount: 4,
          enemyGrowthPerMission: 1.5,
          economyMode: "Limited",
          skipPrologue: false,
          difficulty: "Ironman"
        };
    } if (d === "ironman" || d === "hard") {
        return {
          mode: "Preset",
          deathRule: "Iron",
          allowTacticalPause: false,
          difficultyScaling: 1.5,
          resourceScarcity: 1.5,
          startingScrap: 200,
          mapGeneratorType: MapGeneratorType.DenseShip,
          mapGrowthRate: 0.5,
          baseEnemyCount: 5,
          enemyGrowthPerMission: 2.0,
          economyMode: "Limited",
          skipPrologue: false,
          difficulty: "Ironman"
        };
    }

    // Default / Standard
    return {
      mode: "Preset",
      deathRule: "Clone",
      allowTacticalPause: true,
      difficultyScaling: 1.0,
      resourceScarcity: 1.0,
      startingScrap: 600,
      mapGeneratorType: MapGeneratorType.DenseShip,
      mapGrowthRate: 0.5,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1.0,
      economyMode: "Open",
      skipPrologue: false,
      difficulty: "Standard"
    };
  }

  public getAvailableNodes(): CampaignNode[] {
    if (!this.state) return [];
    return this.state.nodes.filter(n => n.status === "Accessible");
  }

  public selectNode(nodeId: string): void {
    if (!this.state) return;
    const node = this.state.nodes.find(n => n.id === nodeId);
    if (node?.status !== "Accessible") return;

    this.state.currentNodeId = nodeId;
    this.save();
  }

  public processMissionResult(result: any): void {
    this.reconcileMission(result);
  }

  public reconcileMission(result: {
    nodeId?: string;
    won: boolean;
    kills: number;
    elitesKilled: number;
    scrapGained: number;
    intelGained: number;
    casualties: string[];
    xpGained: Map<string, number>;
  }): void {
    if (!this.state) return;

    // Use report nodeId if currentNodeId is missing (Fixes voidlock-fxlcc)
    if (!this.state.currentNodeId && result.nodeId) {
      this.state.currentNodeId = result.nodeId;
    }

    if (!this.state.currentNodeId) return;

    MissionReconciler.reconcile(this.state, result);
    
    // Record globally
    MetaManager.getInstance(this.storage).recordMissionResult({
      kills: result.kills,
      casualties: result.casualties ? result.casualties.length : 0,
      won: result.won,
      scrapGained: result.scrapGained,
      intelGained: result.intelGained
    });

    this.save();
  }

  public recruitSoldier(archetypeId: string, cost: number = 100): string | null {
    if (!this.state || this.state.scrap < cost) return null;

    const soldierId = RosterManager.recruitSoldier(this.state, archetypeId);
    this.save();
    return soldierId;
  }

  public reviveSoldier(soldierId: string): boolean {
    if (!this.state) return false;
    const success = RosterManager.reviveSoldier(this.state, soldierId);
    if (success) this.save();
    return success;
  }

  public assignEquipment(soldierId: string, equipment: Partial<CampaignSoldier["equipment"]>): void {
    if (!this.state) return;
    RosterManager.updateSoldierEquipment(this.state, soldierId, equipment);
    this.save();
  }

  public updateSoldierEquipment(soldierId: string, equipment: Partial<CampaignSoldier["equipment"]>): void {
    this.assignEquipment(soldierId, equipment);
  }

  public renameSoldier(soldierId: string, newName: string): void {
    if (!this.state) return;
    if (!newName) throw new Error("Invalid name.");
    RosterManager.renameSoldier(this.state, soldierId, newName);
    this.save();
  }

  public healSoldier(soldierId: string, cost: number): boolean {
    if (!this.state || this.state.scrap < cost) return false;
    const success = RosterManager.healSoldier(this.state, soldierId, cost);
    if (success) this.save();
    return success;
  }

  public spendScrap(amount: number): void {
    if (!this.state) return;
    if (this.state.scrap < amount) throw new Error("Insufficient scrap");
    this.state.scrap -= amount;
    this.save();
  }

  public applyEventChoice(nodeId: string, choice: import("../../shared/campaign_types").EventChoice, prng: import("../../shared/PRNG").PRNG): { text: string; ambush: boolean } {
    if (!this.state) return { text: "", ambush: false };
    const em = new EventManager();
    const result = em.applyEventChoice({ state: this.state, nodeId, choice, prng });
    this.save();
    return result;
  }

  public advanceCampaignWithoutMission(nodeId: string, scrapGained: number, intelGained: number): void {
    if (!this.state) return;
    MissionReconciler.advanceCampaignWithoutMission(this.state, nodeId, scrapGained, intelGained);
    this.save();
  }
}
