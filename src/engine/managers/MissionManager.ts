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
} from "../../shared/types";
import { PRNG } from "../../shared/PRNG";
import { MathUtils } from "../../shared/utils/MathUtils";
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
    let objectives: Objective[] = (map.objectives || []).map((o) => ({
      ...o,
      state: "Pending",
    }));

    // Spawn bonus loot if present in map definition
    if (map.bonusLoot && lootManager) {
      map.bonusLoot.forEach((pos) => {
        lootManager.spawnLoot(state, "scrap_crate", pos);
      });
    }

    const hasVipInSquad =
      squadConfig?.soldiers?.some((s) => s.archetypeId === "vip") ?? false;

    // Add Escort objective if it's an Escort mission OR if a VIP is present in the squad
    if (this.missionType === MissionType.EscortVIP || hasVipInSquad) {
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
      this.missionType === MissionType.ExtractArtifacts ||
      this.missionType === MissionType.RecoverIntel ||
      nodeType === "Boss" ||
      nodeType === "Elite"
    ) {
      // In these missions, we typically replace map objectives with the mission-specific ones,
      // but we should keep the Escort objective if it exists.
      const escortObjectives = objectives.filter((o) => o.kind === "Escort");
      objectives = [...escortObjectives];

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
      const idPrefix =
        this.missionType === MissionType.ExtractArtifacts
          ? "artifact"
          : this.missionType === MissionType.RecoverIntel
            ? "intel"
            : nodeType === "Boss"
              ? "boss"
              : "elite";

      // Boss Mix: 1x Hive, 2x Recover (if possible)
      // Elite Mix: 1x Hive, 1x Recover (if possible)
      let recoverCount = count;
      if (nodeType === "Boss")
        recoverCount = MISSION_SCALING.RECOVER_COUNT_BOSS;
      else if (nodeType === "Elite")
        recoverCount = MISSION_SCALING.RECOVER_COUNT_ELITE;

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

      if (!newObj.visible && newObj.targetCell) {
        if (isCellDiscovered(state, newObj.targetCell.x, newObj.targetCell.y)) {
          newObj.visible = true;
          changed = true;
        }
      }
      if (newObj.kind === "Kill" && newObj.targetEnemyId) {
        const enemy = state.enemies.find((e) => e.id === newObj.targetEnemyId);
        if (
          enemy &&
          isCellVisible(state, Math.floor(enemy.pos.x), Math.floor(enemy.pos.y))
        ) {
          newObj.visible = true;
          changed = true;
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
      }
      state.status = "Lost";
      return;
    }

    const activeUnits = state.units.filter(
      (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
    );
    const extractedUnits = state.units.filter(
      (u) => u.state === UnitState.Extracted,
    );

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

    // 1. Recover Intel and Destroy Hive nodes: Instant win upon objective completion (Extraction optional)
    if (
      this.missionType === MissionType.RecoverIntel ||
      this.missionType === MissionType.DestroyHive
    ) {
      if (allObjectivesComplete) {
        if (state.status !== "Won") {
          state.stats.scrapGained += SCRAP_REWARDS.MISSION_WIN * multiplier;
        }
        state.status = "Won";
        return;
      }
    }

    // 2. Escort VIP: Win if VIP extracts, Loss if squad wiped (excluding VIP)
    if (this.missionType === MissionType.EscortVIP) {
      const allVipsExtracted =
        vips.length > 0 && vips.every((v) => v.state === UnitState.Extracted);

      if (allVipsExtracted) {
        if (state.status !== "Won") {
          state.stats.scrapGained += SCRAP_REWARDS.MISSION_WIN * multiplier;
        }
        state.status = "Won";
        return;
      }

      const combatUnitsOnMap = activeUnits.filter(
        (u) => u.archetypeId !== "vip",
      );
      if (combatUnitsOnMap.length === 0) {
        const deadCombatUnits = state.units.filter(
          (u) => u.archetypeId !== "vip" && u.state === UnitState.Dead,
        );
        const totalCombatUnits = state.units.filter(
          (u) => u.archetypeId !== "vip",
        ).length;

        // Only lose if ALL combat units are DEAD. If they extracted, it's not a wipe.
        if (
          totalCombatUnits > 0 &&
          deadCombatUnits.length === totalCombatUnits
        ) {
          if (state.status !== "Lost") {
            state.stats.scrapGained += SCRAP_REWARDS.MISSION_LOSS_CONSOLATION;
          }
          state.status = "Lost";
          return;
        }
      }
      return;
    }

    // 3. Generic/Extract Artifacts: Squad must extract after objectives
    if (activeUnits.length === 0) {
      if (allObjectivesComplete) {
        if (
          this.missionType === MissionType.ExtractArtifacts ||
          this.missionType === MissionType.Default
        ) {
          // Extraction required
          if (extractedUnits.length > 0) {
            if (state.status !== "Won") {
              state.stats.scrapGained += SCRAP_REWARDS.MISSION_WIN * multiplier;
            }
            state.status = "Won";
          } else {
            if (state.status !== "Lost") {
              state.stats.scrapGained += SCRAP_REWARDS.MISSION_LOSS_CONSOLATION;
            }
            state.status = "Lost";
          }
        } else {
          // If for some reason it's another type but everyone died after objectives, it's a Win (RecoverIntel/DestroyHive)
          if (state.status !== "Won") {
            state.stats.scrapGained += SCRAP_REWARDS.MISSION_WIN * multiplier;
          }
          state.status = "Won";
        }
      } else {
        if (state.status !== "Lost") {
          state.stats.scrapGained += SCRAP_REWARDS.MISSION_LOSS_CONSOLATION;
        }
        state.status = "Lost";
      }
    }
  }
}
