import {
  MapDefinition,
  GameState,
  Objective,
  MissionType,
  CellType,
  UnitState,
  SquadConfig,
  EnemyType,
} from "../../shared/types";
import { PRNG } from "../../shared/PRNG";
import { EnemyManager } from "./EnemyManager";

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
  ) {
    let objectives: Objective[] = (map.objectives || []).map((o) => ({
      ...o,
      state: "Pending",
    }));

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

    if (this.missionType === MissionType.ExtractArtifacts) {
      // In ExtractArtifacts, we typically replace map objectives with artifacts,
      // but we should keep the Escort objective if it exists.
      const escortObjectives = objectives.filter((o) => o.kind === "Escort");
      objectives = [...escortObjectives];

      const floors = map.cells.filter((c) => c.type === CellType.Floor);
      const extraction = map.extraction || { x: 0, y: 0 };
      const candidates = floors.filter((c) => {
        const dx = c.x - extraction.x;
        const dy = c.y - extraction.y;
        return Math.sqrt(dx * dx + dy * dy) > map.width * 0.4;
      });

      for (let i = candidates.length - 1; i > 0; i--) {
        const j = this.prng.nextInt(0, i);
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      const count = Math.min(3, candidates.length);
      for (let i = 0; i < count; i++) {
        objectives.push({
          id: `artifact-${i}`,
          kind: "Recover",
          state: "Pending",
          targetCell: { x: candidates[i].x, y: candidates[i].y },
        });
      }
    }

    state.objectives = objectives;

    if (this.missionType === MissionType.DestroyHive) {
      const floors = map.cells.filter((c) => c.type === CellType.Floor);
      const extraction = map.extraction || { x: 0, y: 0 };
      const candidates = floors.filter((c) => {
        const isRoom = c.roomId && c.roomId.startsWith("room-");
        if (!isRoom) return false;

        const dx = c.x - extraction.x;
        const dy = c.y - extraction.y;
        return Math.sqrt(dx * dx + dy * dy) > map.width * 0.5;
      });

      if (candidates.length > 0) {
        const hiveLoc = candidates[this.prng.nextInt(0, candidates.length - 1)];
        const hiveId = "enemy-hive";

        enemyManager.addEnemy(state, {
          id: hiveId,
          pos: { x: hiveLoc.x + 0.5, y: hiveLoc.y + 0.5 },
          hp: 500,
          maxHp: 500,
          type: EnemyType.Hive,
          damage: 0,
          fireRate: 1000,
          accuracy: 100,
          attackRange: 0,
          speed: 0,
          difficulty: 10,
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

  public updateObjectives(state: GameState, visibleCells: string[]) {
    state.objectives.forEach((obj) => {
      if (!obj.visible && obj.targetCell) {
        const key = `${obj.targetCell.x},${obj.targetCell.y}`;
        if (state.discoveredCells.includes(key)) {
          obj.visible = true;
        }
      }
      if (obj.kind === "Kill" && obj.targetEnemyId) {
        const enemy = state.enemies.find((e) => e.id === obj.targetEnemyId);
        if (
          enemy &&
          visibleCells.includes(
            `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`,
          )
        ) {
          obj.visible = true;
        }
      }

      // Special handling for Escort objectives: completion depends on ALL VIPs reaching extraction
      if (obj.kind === "Escort" || obj.id === "obj-escort") {
        const vips = state.units.filter((u) => u.archetypeId === "vip");
        const allVipsExtracted =
          vips.length > 0 && vips.every((v) => v.state === UnitState.Extracted);
        const anyVipDead = vips.some((v) => v.state === UnitState.Dead);

        if (allVipsExtracted) {
          obj.state = "Completed";
        } else if (anyVipDead) {
          obj.state = "Failed";
        }
      }
    });
  }

  public checkWinLoss(state: GameState) {
    const vips = state.units.filter((u) => u.archetypeId === "vip");
    const anyVipDead = vips.some((v) => v.state === UnitState.Dead);

    // Any VIP death is an immediate loss in any mission type
    if (anyVipDead) {
      state.status = "Lost";
      return;
    }

    const activeUnits = state.units.filter(
      (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
    );
    const extractedUnits = state.units.filter(
      (u) => u.state === UnitState.Extracted,
    );

    if (this.missionType === MissionType.EscortVIP) {
      const allVipsExtracted =
        vips.length > 0 && vips.every((v) => v.state === UnitState.Extracted);

      if (allVipsExtracted) {
        state.status = "Won";
        return;
      }

      const combatUnits = activeUnits.filter((u) => u.archetypeId !== "vip");
      if (combatUnits.length === 0) {
        state.status = "Lost";
        return;
      }
      return;
    }

    if (activeUnits.length === 0) {
      const allObjectivesComplete = state.objectives.every(
        (o) => o.state === "Completed",
      );
      if (allObjectivesComplete && extractedUnits.length > 0) {
        state.status = "Won";
      } else {
        state.status = "Lost";
      }
    }
  }
}
