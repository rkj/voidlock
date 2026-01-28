import { Unit, UnitState, CommandType, Door } from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { SPEED_NORMALIZATION_CONST } from "../Constants";

const EPSILON = 0.05;

export class MovementManager {
  constructor(private gameGrid: GameGrid) {}

  public handleMovement(unit: Unit, dt: number, doors: Map<string, Door>): Unit {
    if (!unit.targetPos || !unit.path) return unit;

    const dx = unit.targetPos.x - unit.pos.x;
    const dy = unit.targetPos.y - unit.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const moveDist =
      ((unit.stats.speed / SPEED_NORMALIZATION_CONST) * dt) / 1000;

    const currentCell = {
      x: Math.floor(unit.pos.x),
      y: Math.floor(unit.pos.y),
    };
    const nextCell = {
      x: Math.floor(unit.targetPos.x),
      y: Math.floor(unit.targetPos.y),
    };

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
    } else if (dist <= moveDist + EPSILON) {
      const nextPath = unit.path.slice(1);
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
          targetPos: {
            x: nextPath[0].x + 0.5 + (unit.visualJitter?.x || 0),
            y: nextPath[0].y + 0.5 + (unit.visualJitter?.y || 0),
          },
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
