import {
  GameState,
  UseItemCommand,
  ItemLibrary,
  MissionType,
  Vector2,
} from "../../shared/types";
import { ItemEffectHandler } from "../interfaces/IDirector";
import { ITEMS, DIRECTOR } from "../config/GameConstants";
import { MathUtils } from "../../shared/utils/MathUtils";

export class ItemEffectService implements ItemEffectHandler {
  public handleUseItem(state: GameState, cmd: UseItemCommand): void {
    const item = ItemLibrary[cmd.itemId];
    if (!item) return;

    if (item.action === "Heal") {
      let targetUnitId = cmd.targetUnitId;
      if (cmd.itemId === "medkit" || cmd.itemId === "stimpack") {
        targetUnitId = cmd.unitIds[0];
      }

      if (targetUnitId) {
        const targetUnit = state.units.find((u) => u.id === targetUnitId);
        if (targetUnit && targetUnit.hp > 0) {
          targetUnit.hp = Math.min(
            targetUnit.maxHp,
            targetUnit.hp + (item.healAmount || ITEMS.DEFAULT_HEAL),
          );
        }
      }
    } else if (item.action === "Grenade") {
      let targetPos: Vector2 | undefined = cmd.target;

      if (cmd.targetUnitId) {
        const targetEnemy = state.enemies.find(
          (e) => e.id === cmd.targetUnitId,
        );
        if (targetEnemy) {
          targetPos = MathUtils.toCellCoord(targetEnemy.pos);
        }
      }

      if (targetPos) {
        state.enemies.forEach((e) => {
          if (MathUtils.sameCellPosition(e.pos, targetPos!)) {
            e.hp -= ITEMS.GRENADE_DAMAGE;
          }
        });

        state.units.forEach((u) => {
          if (MathUtils.sameCellPosition(u.pos, targetPos!)) {
            if (state.missionType === MissionType.Prologue) {
              u.hp = Math.max(1, u.hp - ITEMS.GRENADE_DAMAGE);
            } else {
              u.hp -= ITEMS.GRENADE_DAMAGE;
            }
          }
        });
      }
    } else if (item.action === "Scanner") {
      let targetPos: Vector2 | undefined = cmd.target;

      if (cmd.targetUnitId) {
        const targetUnit = state.units.find((u) => u.id === cmd.targetUnitId);
        if (targetUnit) {
          targetPos = MathUtils.toCellCoord(targetUnit.pos);
        }
      }

      if (targetPos) {
        const radius = DIRECTOR.SCANNER_RADIUS;
        const radiusSq = radius * radius;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (
              MathUtils.getDistanceSquared({ x: dx, y: dy }, { x: 0, y: 0 }) <=
              radiusSq
            ) {
              const tx = Math.floor(targetPos.x + dx);
              const ty = Math.floor(targetPos.y + dy);
              if (
                tx >= 0 &&
                tx < state.map.width &&
                ty >= 0 &&
                ty < state.map.height
              ) {
                if (state.gridState) {
                  state.gridState[ty * state.map.width + tx] |= 2;
                }
                const key = MathUtils.cellKey({ x: tx, y: ty });
                if (!state.discoveredCells.includes(key)) {
                  state.discoveredCells.push(key);
                }
              }
            }
          }
        }
      }
    } else if (item.action === "Mine") {
      if (cmd.target) {
        state.mines = [
          ...state.mines,
          {
            id: `mine-${state.t}`,
            pos: { ...cmd.target },
            damage: ITEMS.MINE_DAMAGE,
            radius: ITEMS.MINE_RADIUS,
            ownerId: cmd.unitIds[0] || "squad",
          },
        ];
      }
    } else if (item.action === "Sentry") {
      if (cmd.target) {
        state.turrets = [
          ...state.turrets,
          {
            id: `turret-${state.t}`,
            pos: { ...cmd.target },
            damage: item.damage || ITEMS.SENTRY_DEFAULT_DAMAGE,
            fireRate: item.fireRate || ITEMS.SENTRY_DEFAULT_FIRE_RATE,
            accuracy: item.accuracy || ITEMS.SENTRY_DEFAULT_ACCURACY,
            attackRange: item.range || ITEMS.SENTRY_DEFAULT_RANGE,
            ownerId: cmd.unitIds[0] || "squad",
          },
        ];
      }
    }
  }
}
