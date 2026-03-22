import type { IMovableEntity, Door } from "../../shared/types";
import { UnitState, CommandType } from "../../shared/types";
import type { GameGrid } from "../GameGrid";
import { SPEED_NORMALIZATION_CONST, MOVEMENT } from "../config/GameConstants";
import { MathUtils } from "../../shared/utils/MathUtils";

export class MovementManager {
  constructor(private gameGrid: GameGrid) {}

  /**
   * Handles movement for any movable entity (Units or Enemies).
   * Translates path data into position updates and handles door waiting.
   */
  public handleMovement<T extends IMovableEntity>(
    entity: T,
    speed: number,
    dt: number,
    doors: Map<string, Door>,
  ): T {
    if (!entity.targetPos) return entity;

    const dx = entity.targetPos.x - entity.pos.x;
    const dy = entity.targetPos.y - entity.pos.y;
    const dist = MathUtils.getDistance(entity.pos, entity.targetPos);
    const moveDist = ((speed / SPEED_NORMALIZATION_CONST) * dt) / 1000;

    const currentCell = MathUtils.toCellCoord(entity.pos);
    const nextCell = MathUtils.toCellCoord(entity.targetPos);

    if (this.isBlockedByDoor(currentCell, nextCell, doors)) {
      return this.applyDoorWait(entity);
    }

    if (dist <= moveDist + MOVEMENT.ARRIVAL_THRESHOLD) {
      return this.applyArrival(entity, currentCell);
    }

    return this.applyPartialMove(entity, { dx, dy, dist, moveDist }, currentCell);
  }

  private isBlockedByDoor(
    currentCell: { x: number; y: number },
    nextCell: { x: number; y: number },
    doors: Map<string, Door>,
  ): boolean {
    if (currentCell.x === nextCell.x && currentCell.y === nextCell.y) return false;
    return !this.gameGrid.canMove({
      fromX: currentCell.x,
      fromY: currentCell.y,
      toX: nextCell.x,
      toY: nextCell.y,
      doors,
      allowClosedDoors: false,
    });
  }

  private applyDoorWait<T extends IMovableEntity>(entity: T): T {
    if (entity.state === UnitState.WaitingForDoor) return entity;

    const updated = { ...entity, state: UnitState.WaitingForDoor };
    // Plan Invalidation Trigger (ADR 0056)
    if ("activePlan" in updated && (updated as T & { activePlan?: { committedUntil: number } }).activePlan) {
      (updated as T & { activePlan?: { committedUntil: number } }).activePlan = {
        ...(updated as T & { activePlan: { committedUntil: number } }).activePlan,
        committedUntil: 0,
      };
    }
    return updated as T;
  }

  private applyArrival<T extends IMovableEntity>(
    entity: T,
    currentCell: { x: number; y: number },
  ): T {
    const nextPath = entity.path ? entity.path.slice(1) : [];

    // targetPos is guaranteed non-null since handleMovement guards for it at entry
    const arrivalPos = entity.targetPos ?? entity.pos;
    let updated: T;
    if (nextPath.length === 0) {
      updated = {
        ...entity,
        pos: { ...arrivalPos },
        path: undefined,
        targetPos: undefined,
        state: UnitState.Idle,
      };

      if ("activeCommand" in entity) {
        const unit = entity as T & { activeCommand?: { type: string } };
        if (unit.activeCommand?.type === CommandType.MOVE_TO) {
          (updated as T & { activeCommand?: { type: string } }).activeCommand = undefined;
        }
      }
    } else {
      updated = {
        ...entity,
        pos: { ...arrivalPos },
        path: nextPath,
        targetPos: MathUtils.getCellCenter(nextPath[0], entity.visualJitter),
      };
    }

    return this.recordPositionHistory(updated, MathUtils.toCellCoord(updated.pos), currentCell);
  }

  private applyPartialMove<T extends IMovableEntity>(
    entity: T,
    delta: { dx: number; dy: number; dist: number; moveDist: number },
    currentCell: { x: number; y: number },
  ): T {
    const { dx, dy, dist, moveDist } = delta;
    const newPos = {
      x: entity.pos.x + (dx / dist) * moveDist,
      y: entity.pos.y + (dy / dist) * moveDist,
    };

    const movedCell = MathUtils.toCellCoord(newPos);
    const updated: T = {
      ...entity,
      pos: newPos,
      state: UnitState.Moving,
    };

    if (movedCell.x !== currentCell.x || movedCell.y !== currentCell.y) {
      return this.recordPositionHistory(updated, movedCell, currentCell);
    }

    return updated;
  }

  private recordPositionHistory<T extends IMovableEntity>(
    entity: T,
    newCell: { x: number; y: number },
    previousCell: { x: number; y: number },
  ): T {
    if (!("positionHistory" in entity)) return entity;

    const u = entity as T & { positionHistory: { x: number; y: number }[] };
    const last = u.positionHistory[u.positionHistory.length - 1];

    if (last?.x === newCell.x && last.y === newCell.y) return entity;
    if (newCell.x === previousCell.x && newCell.y === previousCell.y) return entity;

    return {
      ...entity,
      positionHistory: [...u.positionHistory, newCell].slice(-6),
    };
  }
}
