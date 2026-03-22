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

    const moveDist =
      ((speed / SPEED_NORMALIZATION_CONST) * dt) / 1000;

    const currentCell = MathUtils.toCellCoord(entity.pos);
    const nextCell = MathUtils.toCellCoord(entity.targetPos);

    if (
      (currentCell.x !== nextCell.x || currentCell.y !== nextCell.y) &&
      !this.gameGrid.canMove(
        currentCell.x,
        currentCell.y,
        nextCell.x,
        nextCell.y,
        doors,
        false,
      )
    ) {
      if (entity.state === UnitState.WaitingForDoor) return entity;
      
      const updated = { ...entity, state: UnitState.WaitingForDoor };
      // Plan Invalidation Trigger (ADR 0056)
      if ("activePlan" in updated && (updated as any).activePlan) {
        (updated as any).activePlan = {
          ...(updated as any).activePlan,
          committedUntil: 0,
        };
      }
      return updated as T;
    } if (dist <= moveDist + MOVEMENT.ARRIVAL_THRESHOLD) {
      const nextPath = entity.path ? entity.path.slice(1) : [];
      let updated: any;
      if (nextPath.length === 0) {
        updated = {
          ...entity,
          pos: { ...entity.targetPos },
          path: undefined,
          targetPos: undefined,
          state: UnitState.Idle,
        };

        // Handle activeCommand specifically for Units
        if ("activeCommand" in entity) {
          const unit = entity as any;
          if (unit.activeCommand?.type === CommandType.MOVE_TO) {
            updated.activeCommand = undefined;
          }
        }
      } else {
        updated = {
          ...entity,
          pos: { ...entity.targetPos },
          path: nextPath,
          targetPos: MathUtils.getCellCenter(nextPath[0], entity.visualJitter),
        };
      }

      // Record position history if cell changed
      if ("positionHistory" in entity) {
        const u = updated;
        const cell = MathUtils.toCellCoord(u.pos);
        const last = u.positionHistory[u.positionHistory.length - 1];
        if (last?.x !== cell.x || last.y !== cell.y) {
          u.positionHistory = [...u.positionHistory, cell].slice(-6);
        }
      }

      return updated as T;
    } 
      const newPos = {
        x: entity.pos.x + (dx / dist) * moveDist,
        y: entity.pos.y + (dy / dist) * moveDist,
      };

      const movedCell = MathUtils.toCellCoord(newPos);
      const updated: any = {
        ...entity,
        pos: newPos,
        state: UnitState.Moving,
      };

      // Record position history if cell changed during partial move
      if ("positionHistory" in entity && (movedCell.x !== currentCell.x || movedCell.y !== currentCell.y)) {
        const u = updated;
        const last = u.positionHistory[u.positionHistory.length - 1];
        if (last?.x !== movedCell.x || last.y !== movedCell.y) {
          u.positionHistory = [...u.positionHistory, movedCell].slice(-6);
        }
      }

      return updated as T;
    
  }
}
