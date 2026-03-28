import type {
  GameState,
  UseItemCommand,
  Vector2} from "../../shared/types";
import {
  ItemLibrary,
  UnitState
} from "../../shared/types";
import type { ItemEffectHandler } from "../interfaces/IDirector";
import { ITEMS, DIRECTOR } from "../config/GameConstants";
import { MathUtils } from "../../shared/utils/MathUtils";

export class ItemEffectService implements ItemEffectHandler {
  public handleUseItem(state: GameState, cmd: UseItemCommand): void {
    const item = ItemLibrary[cmd.itemId];
    if (!item) return;

    switch (item.action) {
      case "Heal":
        this.handleHeal(state, cmd, item);
        break;
      case "Grenade":
        this.handleGrenade(state, cmd);
        break;
      case "Scanner":
        this.handleScanner(state, cmd);
        break;
      case "Mine":
        this.handleMine(state, cmd);
        break;
      case "Sentry":
        this.handleSentry(state, cmd, item);
        break;
    }
  }

  private handleHeal(
    state: GameState,
    cmd: UseItemCommand,
    item: { healAmount?: number },
  ): void {
    let targetUnitId = cmd.targetUnitId;
    if (cmd.itemId === "medkit" || cmd.itemId === "stimpack") {
      targetUnitId = cmd.unitIds[0];
    }
    if (!targetUnitId) return;

    const targetUnit = state.units.find((u) => u.id === targetUnitId);
    if (targetUnit && targetUnit.hp > 0) {
      targetUnit.hp = Math.min(
        targetUnit.maxHp,
        targetUnit.hp + (item.healAmount || ITEMS.DEFAULT_HEAL),
      );
    }
  }

  private handleGrenade(state: GameState, cmd: UseItemCommand): void {
    let targetPos: Vector2 | undefined = cmd.target;

    if (cmd.targetUnitId) {
      const targetEnemy = state.enemies.find((e) => e.id === cmd.targetUnitId);
      if (targetEnemy) {
        targetPos = MathUtils.toCellCoord(targetEnemy.pos);
      }
    }

    if (!targetPos) return;

    state.enemies.forEach((e) => {
      if (e.state === UnitState.Dead) return;
      if (MathUtils.sameCellPosition(e.pos, targetPos)) {
        e.hp -= ITEMS.GRENADE_DAMAGE;
      }
    });

    state.units.forEach((u) => {
      if (u.state === UnitState.Dead || u.state === UnitState.Extracted) return;
      if (MathUtils.sameCellPosition(u.pos, targetPos)) {
        u.hp -= ITEMS.GRENADE_DAMAGE;
      }
    });
  }

  private handleScanner(state: GameState, cmd: UseItemCommand): void {
    let targetPos: Vector2 | undefined = cmd.target;

    if (cmd.targetUnitId) {
      const targetUnit = state.units.find((u) => u.id === cmd.targetUnitId);
      if (targetUnit) {
        targetPos = MathUtils.toCellCoord(targetUnit.pos);
      }
    }

    if (!targetPos) return;

    const radius = DIRECTOR.SCANNER_RADIUS;
    const radiusSq = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.revealScannerCell(state, targetPos, { dx, dy, radiusSq });
      }
    }
  }

  private revealScannerCell(
    state: GameState,
    targetPos: Vector2,
    offset: { dx: number; dy: number; radiusSq: number },
  ): void {
    const { dx, dy, radiusSq } = offset;
    if (MathUtils.getDistanceSquared({ x: dx, y: dy }, { x: 0, y: 0 }) > radiusSq) return;

    const tx = Math.floor(targetPos.x + dx);
    const ty = Math.floor(targetPos.y + dy);
    if (tx < 0 || tx >= state.map.width || ty < 0 || ty >= state.map.height) return;

    if (state.gridState) {
      state.gridState[ty * state.map.width + tx] |= 2;
    }
    const key = MathUtils.cellKey({ x: tx, y: ty });
    if (!state.discoveredCells.includes(key)) {
      state.discoveredCells.push(key);
    }
  }

  private handleMine(state: GameState, cmd: UseItemCommand): void {
    if (!cmd.target) return;
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

  private handleSentry(
    state: GameState,
    cmd: UseItemCommand,
    item: { damage?: number; fireRate?: number; accuracy?: number; range?: number },
  ): void {
    if (!cmd.target) return;
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
