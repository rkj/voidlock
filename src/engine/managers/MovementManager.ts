import { Unit, UnitState, CommandType, Door } from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { SPEED_NORMALIZATION_CONST, MOVEMENT } from "../config/GameConstants";
import { MathUtils } from "../../shared/utils/MathUtils";

export class MovementManager {
  constructor(private gameGrid: GameGrid) {}

  public handleMovement(
    unit: Unit,
    dt: number,
    doors: Map<string, Door>,
  ): Unit {
    if (!unit.targetPos) return unit;

    const dx = unit.targetPos.x - unit.pos.x;
    const dy = unit.targetPos.y - unit.pos.y;
    const dist = MathUtils.getDistance(unit.pos, unit.targetPos);

    const moveDist =
      ((unit.stats.speed / SPEED_NORMALIZATION_CONST) * dt) / 1000;

    const currentCell = MathUtils.toCellCoord(unit.pos);
    const nextCell = MathUtils.toCellCoord(unit.targetPos);

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
      if (unit.state === UnitState.WaitingForDoor) return unit;
      return { ...unit, state: UnitState.WaitingForDoor };
    } else if (dist <= moveDist + MOVEMENT.ARRIVAL_THRESHOLD) {
      const nextPath = unit.path ? unit.path.slice(1) : [];
      if (nextPath.length === 0) {
        return {
          ...unit,
          pos: { ...unit.targetPos },
          path: undefined,
          targetPos: undefined,
          state: UnitState.Idle,
          activeCommand:
            unit.activeCommand?.type === CommandType.MOVE_TO
              ? undefined
              : unit.activeCommand,
        };
      } else {
        return {
          ...unit,
          pos: { ...unit.targetPos },
          path: nextPath,
          targetPos: MathUtils.getCellCenter(nextPath[0], unit.visualJitter),
        };
      }
    } else {
      return {
        ...unit,
        pos: {
          x: unit.pos.x + (dx / dist) * moveDist,
          y: unit.pos.y + (dy / dist) * moveDist,
        },
        state: UnitState.Moving,
      };
    }
  }
}
