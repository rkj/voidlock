import { IMovableEntity, UnitState, CommandType, Door } from "../../shared/types";
import { GameGrid } from "../GameGrid";
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
      return { ...entity, state: UnitState.WaitingForDoor };
    } else if (dist <= moveDist + MOVEMENT.ARRIVAL_THRESHOLD) {
      const nextPath = entity.path ? entity.path.slice(1) : [];
      if (nextPath.length === 0) {
        let updated: any = {
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

        return updated as T;
      } else {
        return {
          ...entity,
          pos: { ...entity.targetPos },
          path: nextPath,
          targetPos: MathUtils.getCellCenter(nextPath[0], entity.visualJitter),
        } as T;
      }
    } else {
      return {
        ...entity,
        pos: {
          x: entity.pos.x + (dx / dist) * moveDist,
          y: entity.pos.y + (dy / dist) * moveDist,
        },
        state: UnitState.Moving,
      } as T;
    }
  }
}
