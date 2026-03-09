import {
  MapDefinition,
  GameState,
  Objective,
  MissionType,
  CellType,
  UnitState,
  SquadConfig,
  EnemyType,
  CampaignNodeType,
  Vector2,
} from "../../shared/types";
import { PRNG } from "../../shared/PRNG";
import { MathUtils } from "../../shared/utils/MathUtils";
import { MapUtils } from "../../shared/utils/MapUtils";
import { EnemyManager } from "./EnemyManager";
import { LootManager } from "./LootManager";
import { PlacementValidator } from "../generators/PlacementValidator";
import { isCellVisible, isCellDiscovered } from "../../shared/VisibilityUtils";
import { HIVE, SCRAP_REWARDS, MISSION_SCALING } from "../config/GameConstants";

export class MissionManager {
  constructor(
    private missionType: MissionType,
    private prng: PRNG,
  ) {}

  public setupMission(
    state: GameState,
    map: MapDefinition,
    enemyManager: EnemyManager,
    squadConfig?: SquadConfig,
    nodeType?: CampaignNodeType,
    lootManager?: LootManager,
  ) {
    const validator = PlacementValidator.fromMap(map);
    const missionType = this.missionType;

    // Identify if this is a mission type where 'Recover' objectives are primary
    const isRecoverMission =
      missionType === MissionType.ExtractArtifacts ||
      missionType === MissionType.RecoverIntel ||
      (missionType === MissionType.Default && !state.campaignNodeId) ||
      missionType === MissionType.Prologue ||
      nodeType === "Boss" ||
      nodeType === "Elite";

    const primaryMapObjectives: Objective[] = [];
    const optionalLootPositions: Vector2[] = [];

    (map.objectives || []).forEach((obj) => {
      // Rule: In non-Recover missions, map 'Recover' objectives are optional loot
      if (obj.kind === "Recover" && !isRecoverMission) {
        if (obj.targetCell) {
          optionalLootPositions.push(obj.targetCell);
        }
      } else {
        primaryMapObjectives.push({ ...obj, state: "Pending" });
      }
    });

    let objectives = primaryMapObjectives;

    // Combine existing bonus loot with converted optional objectives
    const allBonusLoot = [
      ...(map.bonusLoot || []),
      ...optionalLootPositions,
    ];

    // Spawn bonus loot if present
    if (allBonusLoot.length > 0 && lootManager) {
      allBonusLoot.forEach((pos) => {
        const lootType = missionType === MissionType.Prologue ? "medkit" : "scrap_crate";
        lootManager.spawnLoot(state, lootType, pos);
      });
    }

    const hasVipInSquad =
      squadConfig?.soldiers?.some((s) => s.archetypeId === "vip") ?? false;

    if (missionType === MissionType.Prologue) {
      state.objectives = objectives;
      return;
    }

    // Add Escort objective if it's an Escort mission OR if a VIP is present in the squad
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

    if (
      missionType === MissionType.ExtractArtifacts ||
      missionType === MissionType.RecoverIntel ||
      nodeType === "Boss" ||
      nodeType === "Elite"
    ) {
      // In campaign-specific node types (Boss, Elite), we typically replace map objectives 
      // with mission-specific ones to ensure standard parameters, but we keep Escort.
      if (nodeType === "Boss" || nodeType === "Elite") {
        const escortObjectives = objectives.filter((o) => o.kind === "Escort");
        objectives = [...escortObjectives];
      }

      // Enforce the Data Disk limit for Recover Intel missions
      if (missionType === MissionType.RecoverIntel) {
        const recoverObjectives = objectives.filter((o) => o.kind === "Recover");
        if (recoverObjectives.length > MISSION_SCALING.MAX_DATA_DISKS) {
          // Keep only the first MAX_DATA_DISKS if the map already has too many
          const nonRecoverObjectives = objectives.filter((o) => o.kind !== "Recover");
          objectives = [...nonRecoverObjectives, ...recoverObjectives.slice(0, MISSION_SCALING.MAX_DATA_DISKS)];
        }
      }

      const floors = map.cells.filter((c) => c.type === CellType.Floor);
      const extraction = map.extraction || { x: 0, y: 0 };
      const candidates = floors.filter((c) => {
        if (validator.isCellOccupied(c)) return false;
        return (
          MathUtils.getDistance(c, extraction) >
          map.width * MISSION_SCALING.DISTANCE_EXTRACTION_FACTOR
        );
      });

      /**
       * Shuffle candidate cells using the Fisher-Yates algorithm.
       * This ensures an unbiased random selection of objective locations
       * from the set of valid floor cells that are sufficiently far from extraction.
       */
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = this.prng.nextInt(0, i);
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      /**
       * Determine the number of objectives based on the mission/node type:
       * - Boss nodes: MISSION_SCALING.OBJECTIVE_COUNT_BOSS (typically 3)
       * - Elite nodes: MISSION_SCALING.OBJECTIVE_COUNT_ELITE (typically 2)
       * - Normal/Other: MISSION_SCALING.OBJECTIVE_COUNT_DEFAULT (typically 3, or available candidates)
       */
      const count =
        nodeType === "Boss"
          ? MISSION_SCALING.OBJECTIVE_COUNT_BOSS
          : nodeType === "Elite"
            ? MISSION_SCALING.OBJECTIVE_COUNT_ELITE
            : Math.min(
                MISSION_SCALING.OBJECTIVE_COUNT_DEFAULT,
                candidates.length,
              );

      // Capping count based on existing objectives for RecoverIntel
      let targetCount = count;
      if (missionType === MissionType.RecoverIntel) {
        const currentRecoverCount = objectives.filter((o) => o.kind === "Recover").length;
        targetCount = Math.max(0, MISSION_SCALING.MAX_DATA_DISKS - currentRecoverCount);
      }

      const idPrefix =
        missionType === MissionType.ExtractArtifacts
          ? "artifact"
          : missionType === MissionType.RecoverIntel
            ? "intel"
            : nodeType === "Boss"
              ? "boss"
              : "elite";

      // Boss Mix: 1x Hive, 2x Recover (if possible)
      // Elite Mix: 1x Hive, 1x Recover (if possible)
      let recoverCount = targetCount;
      if (nodeType === "Boss")
        recoverCount = Math.min(targetCount, MISSION_SCALING.RECOVER_COUNT_BOSS);
      else if (nodeType === "Elite")
        recoverCount = Math.min(targetCount, MISSION_SCALING.RECOVER_COUNT_ELITE);

      for (let i = 0; i < Math.min(recoverCount, candidates.length); i++) {
        objectives.push({
          id: `${idPrefix}-${i}`,
          kind: "Recover",
          state: "Pending",
          targetCell: { x: candidates[i].x, y: candidates[i].y },
        });
      }

      if (nodeType === "Boss" || nodeType === "Elite") {
        // Find a room for the Hive that's far from extraction
        const roomCandidates = floors.filter((c) => {
          if (validator.isCellOccupied(c)) return false;
          const isRoom = c.roomId && c.roomId.startsWith("room-");
          if (!isRoom) return false;

          return (
            MathUtils.getDistance(c, extraction) >
            map.width * MISSION_SCALING.DISTANCE_HIVE_FACTOR
          );
        });

        if (roomCandidates.length > 0) {
          const hiveLoc =
            roomCandidates[this.prng.nextInt(0, roomCandidates.length - 1)];
          const hiveId = nodeType === "Boss" ? "boss-hive" : "elite-hive";

          enemyManager.addEnemy(state, {
            id: hiveId,
            pos: { x: hiveLoc.x + 0.5, y: hiveLoc.y + 0.5 },
            hp: nodeType === "Boss" ? HIVE.BOSS_HP : HIVE.ELITE_HP, // Boss hive is tougher
            maxHp: nodeType === "Boss" ? HIVE.BOSS_HP : HIVE.ELITE_HP,
            type: EnemyType.Hive,
            damage: 0,
            fireRate: 1000,
            accuracy: 100,
            attackRange: 0,
            speed: 0,
            difficulty:
              nodeType === "Boss"
                ? HIVE.BOSS_DIFFICULTY
                : HIVE.ELITE_DIFFICULTY,
            state: UnitState.Idle,
          });

          objectives.push({
            id: `obj-${hiveId}`,
            kind: "Kill",
            state: "Pending",
            targetEnemyId: hiveId,
          });
        }
      }
    }

    state.objectives = objectives;

    if (
      this.missionType === MissionType.DestroyHive &&
      nodeType !== "Boss" &&
      nodeType !== "Elite"
    ) {
      const floors = map.cells.filter((c) => c.type === CellType.Floor);
      const extraction = map.extraction || { x: 0, y: 0 };
      const candidates = floors.filter((c) => {
        if (validator.isCellOccupied(c)) return false;
        const isRoom = c.roomId && c.roomId.startsWith("room-");
        if (!isRoom) return false;

        return (
          MathUtils.getDistance(c, extraction) >
          map.width * MISSION_SCALING.DISTANCE_HIVE_FACTOR
        );
      });

      if (candidates.length > 0) {
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
    }
  }

  public updateObjectives(state: GameState) {
    state.objectives = state.objectives.map((obj) => {
      let changed = false;
      let newObj = { ...obj };

      if (!newObj.visible) {
        const pos = MapUtils.resolveObjectivePosition(newObj, state.enemies);
        if (pos) {
          const cell = MathUtils.toCellCoord(pos);
          const shouldBeVisible = newObj.targetCell
            ? isCellDiscovered(state, cell.x, cell.y)
            : isCellVisible(state, cell.x, cell.y);

          if (shouldBeVisible) {
            newObj.visible = true;
            changed = true;
          }
        }
      }

      // Special handling for Escort objectives: completion depends on ALL VIPs reaching extraction
      if (newObj.kind === "Escort" || newObj.id === "obj-escort") {
        const vips = state.units.filter((u) => u.archetypeId === "vip");
        const allVipsExtracted =
          vips.length > 0 && vips.every((v) => v.state === UnitState.Extracted);
        const anyVipDead = vips.some((v) => v.state === UnitState.Dead);

        if (allVipsExtracted && newObj.state !== "Completed") {
          newObj.state = "Completed";
          changed = true;
        } else if (anyVipDead && newObj.state !== "Failed") {
          newObj.state = "Failed";
          changed = true;
        }
      } else if (newObj.state !== "Completed") {
        // Handle Kill objective completion in MissionManager
        if (newObj.kind === "Kill" && newObj.targetEnemyId) {
          const enemy = state.enemies.find(
            (e) => e.id === newObj.targetEnemyId,
          );
          if (!enemy || enemy.hp <= 0) {
            newObj.state = "Completed";
            changed = true;
          }
        }
      }

      // Reward scrap for newly completed objectives
      if (newObj.state === "Completed" && !newObj.scrapRewarded) {
        const isBoss = state.nodeType === "Boss";
        const isElite = state.nodeType === "Elite";
        const multiplier = isBoss
          ? MISSION_SCALING.BOSS_MULTIPLIER
          : isElite
            ? MISSION_SCALING.ELITE_MULTIPLIER
            : MISSION_SCALING.NORMAL_MULTIPLIER;

        if (
          newObj.kind === "Kill" &&
          (newObj.targetEnemyId === "enemy-hive" ||
            newObj.targetEnemyId === "boss-hive" ||
            newObj.targetEnemyId === "elite-hive")
        ) {
          state.stats.scrapGained += SCRAP_REWARDS.HIVE_DESTROY * multiplier;
        } else if (newObj.kind === "Escort" || newObj.id === "obj-escort") {
          state.stats.scrapGained += SCRAP_REWARDS.ESCORT_COMPLETE * multiplier;
        } else {
          state.stats.scrapGained +=
            SCRAP_REWARDS.OBJECTIVE_COMPLETE * multiplier;
        }
        newObj.scrapRewarded = true;
        changed = true;
      }

      return changed ? newObj : obj;
    });
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

    const isBoss = state.nodeType === "Boss";
    const isElite = state.nodeType === "Elite";
    const multiplier = isBoss
      ? MISSION_SCALING.BOSS_MULTIPLIER
      : isElite
        ? MISSION_SCALING.ELITE_MULTIPLIER
        : MISSION_SCALING.NORMAL_MULTIPLIER;

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
      } else {
        // Either not a survival mission (Expendable) or someone extracted -> Won
        if (state.status !== "Won") {
          state.stats.scrapGained += SCRAP_REWARDS.MISSION_WIN * multiplier;
          state.status = "Won";
        }
      }
    } else {
      // Objectives not complete and everyone is off map -> Lost
      if (state.status !== "Lost") {
        state.stats.scrapGained += SCRAP_REWARDS.MISSION_LOSS_CONSOLATION;
        state.status = "Lost";
      }
    }
  }
}
