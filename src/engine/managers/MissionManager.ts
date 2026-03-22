import type {
  MapDefinition,
  GameState,
  Objective,
  SquadConfig,
  CampaignNodeType,
  Vector2} from "../../shared/types";
import {
  MissionType,
  CellType,
  UnitState,
  EnemyType
} from "../../shared/types";
import type { PRNG } from "../../shared/PRNG";
import { MathUtils } from "../../shared/utils/MathUtils";
import { MapUtils } from "../../shared/utils/MapUtils";
import type { EnemyManager } from "./EnemyManager";
import type { LootManager } from "./LootManager";
import { PlacementValidator } from "../generators/PlacementValidator";
import { isCellVisible, isCellDiscovered } from "../../shared/VisibilityUtils";
import { HIVE, SCRAP_REWARDS, MISSION_SCALING } from "../config/GameConstants";

export interface SetupMissionParams {
  state: GameState;
  map: MapDefinition;
  enemyManager: EnemyManager;
  squadConfig?: SquadConfig;
  nodeType?: CampaignNodeType;
  lootManager?: LootManager;
}

interface SetupContext {
  state: GameState;
  map: MapDefinition;
  validator: PlacementValidator;
  nodeType: CampaignNodeType | undefined;
  enemyManager: EnemyManager;
  missionType: MissionType;
}

export class MissionManager {
  constructor(
    private missionType: MissionType,
    private prng: PRNG,
  ) {}

  public setupMission(params: SetupMissionParams) {
    const { state, map, enemyManager, squadConfig, nodeType, lootManager } = params;
    const missionType = this.missionType;
    const ctx: SetupContext = {
      state,
      map,
      validator: PlacementValidator.fromMap(map),
      nodeType,
      enemyManager,
      missionType,
    };

    const isRecoverMission = this.isRecoverMission(missionType, state, nodeType);
    const { objectives, bonusLootPositions } = this.classifyMapObjectives(map, isRecoverMission);

    this.spawnBonusLoot(state, lootManager, missionType, [...(map.bonusLoot ?? []), ...bonusLootPositions]);

    if (missionType === MissionType.Prologue) {
      state.objectives = objectives;
      return;
    }

    const hasVipInSquad = squadConfig?.soldiers?.some((s) => s.archetypeId === "vip") ?? false;
    state.objectives = this.buildObjectives(objectives, hasVipInSquad, ctx);

    this.setupDestroyHiveMission(ctx);
  }

  private isRecoverMission(
    missionType: MissionType,
    state: GameState,
    nodeType?: CampaignNodeType,
  ): boolean {
    return (
      missionType === MissionType.ExtractArtifacts ||
      missionType === MissionType.RecoverIntel ||
      (missionType === MissionType.Default && !state.campaignNodeId) ||
      missionType === MissionType.Prologue ||
      nodeType === "Boss" ||
      nodeType === "Elite"
    );
  }

  private classifyMapObjectives(
    map: MapDefinition,
    isRecoverMission: boolean,
  ): { objectives: Objective[]; bonusLootPositions: Vector2[] } {
    const objectives: Objective[] = [];
    const bonusLootPositions: Vector2[] = [];

    (map.objectives ?? []).forEach((obj) => {
      if (obj.kind === "Recover" && !isRecoverMission) {
        if (obj.targetCell) {
          bonusLootPositions.push(obj.targetCell);
        }
      } else {
        objectives.push({ ...obj, state: "Pending" });
      }
    });

    return { objectives, bonusLootPositions };
  }

  private spawnBonusLoot(
    state: GameState,
    lootManager: LootManager | undefined,
    missionType: MissionType,
    allBonusLoot: Vector2[],
  ): void {
    if (allBonusLoot.length === 0 || !lootManager) return;
    const lootType = missionType === MissionType.Prologue ? "medkit" : "scrap_crate";
    allBonusLoot.forEach((pos) => {
      lootManager.spawnLoot(state, lootType, pos);
    });
  }

  private buildObjectives(
    initialObjectives: Objective[],
    hasVipInSquad: boolean,
    ctx: SetupContext,
  ): Objective[] {
    const { missionType, nodeType, map } = ctx;
    const objectives = [...initialObjectives];

    if (missionType === MissionType.EscortVIP || hasVipInSquad) {
      if (!objectives.some((o) => o.kind === "Escort")) {
        objectives.push({
          id: "obj-escort",
          kind: "Escort",
          state: "Pending",
          targetCell: map.extraction,
        });
      }
    }

    const needsSpecialObjectives =
      missionType === MissionType.ExtractArtifacts ||
      missionType === MissionType.RecoverIntel ||
      nodeType === "Boss" ||
      nodeType === "Elite";

    if (!needsSpecialObjectives) return objectives;

    return this.applySpecialObjectives(objectives, ctx);
  }

  private applySpecialObjectives(objectives: Objective[], ctx: SetupContext): Objective[] {
    const { missionType, nodeType, map, validator } = ctx;
    let result = [...objectives];

    if (nodeType === "Boss" || nodeType === "Elite") {
      const escortObjectives = result.filter((o) => o.kind === "Escort");
      result = [...escortObjectives];
    }

    if (missionType === MissionType.RecoverIntel) {
      result = this.capRecoverIntelObjectives(result);
    }

    const extraction = map.extraction ?? { x: 0, y: 0 };
    const floors = map.cells.filter((c) => c.type === CellType.Floor);
    const candidates = this.shuffledCandidates(floors, extraction, validator, map);

    const idPrefix = this.getObjectiveIdPrefix(missionType, nodeType);
    const targetCount = this.getTargetCount(result, missionType, nodeType, candidates.length);
    const recoverCount = this.getRecoverCount(targetCount, nodeType);

    for (let i = 0; i < Math.min(recoverCount, candidates.length); i++) {
      result.push({
        id: `${idPrefix}-${i}`,
        kind: "Recover",
        state: "Pending",
        targetCell: { x: candidates[i].x, y: candidates[i].y },
      });
    }

    if (nodeType === "Boss" || nodeType === "Elite") {
      this.addHiveObjective({ objectives: result, floors, extraction, nodeType, ctx });
    }

    return result;
  }

  private capRecoverIntelObjectives(objectives: Objective[]): Objective[] {
    const recoverObjectives = objectives.filter((o) => o.kind === "Recover");
    if (recoverObjectives.length <= MISSION_SCALING.MAX_DATA_DISKS) return objectives;

    const nonRecoverObjectives = objectives.filter((o) => o.kind !== "Recover");
    return [...nonRecoverObjectives, ...recoverObjectives.slice(0, MISSION_SCALING.MAX_DATA_DISKS)];
  }

  private shuffledCandidates(
    floors: MapDefinition["cells"],
    extraction: Vector2,
    validator: PlacementValidator,
    map: MapDefinition,
  ): MapDefinition["cells"] {
    const candidates = floors.filter((c) => {
      if (validator.isCellOccupied(c)) return false;
      return (
        MathUtils.getDistance(c, extraction) >
        map.width * MISSION_SCALING.DISTANCE_EXTRACTION_FACTOR
      );
    });

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = this.prng.nextInt(0, i);
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    return candidates;
  }

  private getObjectiveIdPrefix(
    missionType: MissionType,
    nodeType: CampaignNodeType | undefined,
  ): string {
    if (missionType === MissionType.ExtractArtifacts) return "artifact";
    if (missionType === MissionType.RecoverIntel) return "intel";
    if (nodeType === "Boss") return "boss";
    return "elite";
  }

  private getTargetCount(
    objectives: Objective[],
    missionType: MissionType,
    nodeType: CampaignNodeType | undefined,
    candidateCount: number,
  ): number {
    const count =
      nodeType === "Boss"
        ? MISSION_SCALING.OBJECTIVE_COUNT_BOSS
        : nodeType === "Elite"
          ? MISSION_SCALING.OBJECTIVE_COUNT_ELITE
          : Math.min(MISSION_SCALING.OBJECTIVE_COUNT_DEFAULT, candidateCount);

    if (missionType !== MissionType.RecoverIntel) return count;

    const currentRecoverCount = objectives.filter((o) => o.kind === "Recover").length;
    return Math.max(0, MISSION_SCALING.MAX_DATA_DISKS - currentRecoverCount);
  }

  private getRecoverCount(targetCount: number, nodeType: CampaignNodeType | undefined): number {
    if (nodeType === "Boss") return Math.min(targetCount, MISSION_SCALING.RECOVER_COUNT_BOSS);
    if (nodeType === "Elite") return Math.min(targetCount, MISSION_SCALING.RECOVER_COUNT_ELITE);
    return targetCount;
  }

  private addHiveObjective({
    objectives,
    floors,
    extraction,
    nodeType,
    ctx,
  }: {
    objectives: Objective[];
    floors: MapDefinition["cells"];
    extraction: Vector2;
    nodeType: CampaignNodeType;
    ctx: Pick<SetupContext, "state" | "validator" | "map" | "enemyManager">;
  }): void {
    const { state, validator, map, enemyManager } = ctx;
    const roomCandidates = floors.filter((c) => {
      if (validator.isCellOccupied(c)) return false;
      if (!c.roomId?.startsWith("room-")) return false;
      return (
        MathUtils.getDistance(c, extraction) >
        map.width * MISSION_SCALING.DISTANCE_HIVE_FACTOR
      );
    });

    if (roomCandidates.length === 0) return;

    const hiveLoc = roomCandidates[this.prng.nextInt(0, roomCandidates.length - 1)];
    const hiveId = nodeType === "Boss" ? "boss-hive" : "elite-hive";
    const hp = nodeType === "Boss" ? HIVE.BOSS_HP : HIVE.ELITE_HP;
    const difficulty = nodeType === "Boss" ? HIVE.BOSS_DIFFICULTY : HIVE.ELITE_DIFFICULTY;

    enemyManager.addEnemy(state, {
      id: hiveId,
      pos: { x: hiveLoc.x + 0.5, y: hiveLoc.y + 0.5 },
      hp,
      maxHp: hp,
      type: EnemyType.Hive,
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
      difficulty,
      state: UnitState.Idle,
    });

    objectives.push({
      id: `obj-${hiveId}`,
      kind: "Kill",
      state: "Pending",
      targetEnemyId: hiveId,
    });
  }

  private setupDestroyHiveMission(ctx: SetupContext): void {
    const { state, map, validator, nodeType, enemyManager } = ctx;

    if (
      this.missionType !== MissionType.DestroyHive ||
      nodeType === "Boss" ||
      nodeType === "Elite"
    ) {
      return;
    }

    const floors = map.cells.filter((c) => c.type === CellType.Floor);
    const extraction = map.extraction ?? { x: 0, y: 0 };
    const candidates = floors.filter((c) => {
      if (validator.isCellOccupied(c)) return false;
      if (!c.roomId?.startsWith("room-")) return false;
      return (
        MathUtils.getDistance(c, extraction) >
        map.width * MISSION_SCALING.DISTANCE_HIVE_FACTOR
      );
    });

    if (candidates.length === 0) return;

    const hiveLoc = candidates[this.prng.nextInt(0, candidates.length - 1)];
    const hiveId = "enemy-hive";

    enemyManager.addEnemy(state, {
      id: hiveId,
      pos: { x: hiveLoc.x + 0.5, y: hiveLoc.y + 0.5 },
      hp: HIVE.NORMAL_HP,
      maxHp: HIVE.NORMAL_HP,
      type: EnemyType.Hive,
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
      difficulty: HIVE.NORMAL_DIFFICULTY,
      state: UnitState.Idle,
    });

    state.objectives.push({
      id: "obj-hive",
      kind: "Kill",
      state: "Pending",
      targetEnemyId: hiveId,
    });
  }

  public updateObjectives(state: GameState) {
    state.objectives = state.objectives.map((obj) => {
      const newObj = this.updateObjectiveVisibility(obj, state);
      const updated = this.updateObjectiveCompletion(newObj, state);
      return this.rewardCompletedObjective(updated, state);
    });
  }

  private updateObjectiveVisibility(obj: Objective, state: GameState): Objective {
    if (obj.visible) return obj;

    const pos = MapUtils.resolveObjectivePosition(obj, state.enemies);
    if (!pos) return obj;

    const cell = MathUtils.toCellCoord(pos);
    const shouldBeVisible = obj.targetCell
      ? isCellDiscovered(state, cell.x, cell.y)
      : isCellVisible(state, cell.x, cell.y);

    if (!shouldBeVisible) return obj;
    return { ...obj, visible: true };
  }

  private updateObjectiveCompletion(obj: Objective, state: GameState): Objective {
    if (obj.kind === "Escort" || obj.id === "obj-escort") {
      return this.updateEscortObjective(obj, state);
    }

    if (obj.state !== "Completed" && obj.kind === "Kill" && obj.targetEnemyId) {
      const enemy = state.enemies.find((e) => e.id === obj.targetEnemyId);
      if (!enemy || enemy.hp <= 0) {
        return { ...obj, state: "Completed" };
      }
    }

    return obj;
  }

  private updateEscortObjective(obj: Objective, state: GameState): Objective {
    const vips = state.units.filter((u) => u.archetypeId === "vip");
    const allVipsExtracted = vips.length > 0 && vips.every((v) => v.state === UnitState.Extracted);
    const anyVipDead = vips.some((v) => v.state === UnitState.Dead);

    if (allVipsExtracted && obj.state !== "Completed") {
      return { ...obj, state: "Completed" };
    }
    if (anyVipDead && obj.state !== "Failed") {
      return { ...obj, state: "Failed" };
    }
    return obj;
  }

  private rewardCompletedObjective(obj: Objective, state: GameState): Objective {
    if (obj.state !== "Completed" || obj.scrapRewarded) return obj;

    const multiplier = this.getScrapMultiplier(state);

    if (
      obj.kind === "Kill" &&
      (obj.targetEnemyId === "enemy-hive" ||
        obj.targetEnemyId === "boss-hive" ||
        obj.targetEnemyId === "elite-hive")
    ) {
      state.stats.scrapGained += SCRAP_REWARDS.HIVE_DESTROY * multiplier;
    } else if (obj.kind === "Escort" || obj.id === "obj-escort") {
      state.stats.scrapGained += SCRAP_REWARDS.ESCORT_COMPLETE * multiplier;
    } else {
      state.stats.scrapGained += SCRAP_REWARDS.OBJECTIVE_COMPLETE * multiplier;
    }

    return { ...obj, scrapRewarded: true };
  }

  private getScrapMultiplier(state: GameState): number {
    if (state.nodeType === "Boss") return MISSION_SCALING.BOSS_MULTIPLIER;
    if (state.nodeType === "Elite") return MISSION_SCALING.ELITE_MULTIPLIER;
    return MISSION_SCALING.NORMAL_MULTIPLIER;
  }

  public checkWinLoss(state: GameState) {
    const vips = state.units.filter((u) => u.archetypeId === "vip");
    const anyVipDead = vips.some((v) => v.state === UnitState.Dead);

    // Any VIP death is an immediate loss in any mission type
    if (anyVipDead) {
      if (state.status !== "Lost") {
        state.stats.scrapGained += SCRAP_REWARDS.MISSION_LOSS_CONSOLATION;
        state.status = "Lost";
      }
      return;
    }

    // Mission only ends when everyone is off the map (extracted or dead) - ADR 0032
    const activeUnits = state.units.filter(
      (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
    );

    if (activeUnits.length > 0) {
      return;
    }

    const allObjectivesComplete = state.objectives.every(
      (o) => o.state === "Completed",
    );

    const multiplier = this.getScrapMultiplier(state);

    const extractedUnits = state.units.filter(
      (u) => u.state === UnitState.Extracted,
    );

    // 1. Check for missions that REQUIRE at least one extraction (Survival missions)
    const isSurvivalMission =
      this.missionType === MissionType.ExtractArtifacts ||
      this.missionType === MissionType.Default ||
      this.missionType === MissionType.EscortVIP ||
      this.missionType === MissionType.Prologue;

    if (allObjectivesComplete) {
      if (isSurvivalMission && extractedUnits.length === 0) {
        // All objectives complete but no one survived extraction -> Lost
        if (state.status !== "Lost") {
          state.stats.scrapGained += SCRAP_REWARDS.MISSION_LOSS_CONSOLATION;
          state.status = "Lost";
        }
      } else if (state.status !== "Won") {
        // Either not a survival mission (Expendable) or someone extracted -> Won
        state.stats.scrapGained += SCRAP_REWARDS.MISSION_WIN * multiplier;
        state.status = "Won";
      }
    } else if (state.status !== "Lost") {
      // Objectives not complete and everyone is off map -> Lost
      state.stats.scrapGained += SCRAP_REWARDS.MISSION_LOSS_CONSOLATION;
      state.status = "Lost";
    }
  }
}
