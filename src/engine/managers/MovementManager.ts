import { Unit, UnitState, CommandType, Door } from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { SPEED_NORMALIZATION_CONST } from "../Constants";

const EPSILON = 0.05;

export class MovementManager {
  constructor(private gameGrid: GameGrid) {}

  public handleMovement(unit: Unit, dt: number, doors: Map<string, Door>) {
    if (!unit.targetPos || !unit.path) return;

    const dx = unit.targetPos.x - unit.pos.x;
    const dy = unit.targetPos.y - unit.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const moveDist = ((unit.stats.speed / SPEED_NORMALIZATION_CONST) * dt) / 1000;

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
      unit.state = UnitState.WaitingForDoor;
    } else if (dist <= moveDist + EPSILON) {
      unit.pos = { ...unit.targetPos };
      unit.path.shift();

      if (unit.path.length === 0) {
        unit.path = undefined;
        unit.targetPos = undefined;
        unit.state = UnitState.Idle;
        if (unit.activeCommand?.type === CommandType.MOVE_TO) {
          unit.activeCommand = undefined;
        }
      } else {
        unit.targetPos = {
          x: unit.path[0].x + 0.5 + (unit.visualJitter?.x || 0),
          y: unit.path[0].y + 0.5 + (unit.visualJitter?.y || 0),
        };
      }
    } else {
      unit.pos.x += (dx / dist) * moveDist;
      unit.pos.y += (dy / dist) * moveDist;
      unit.state = UnitState.Moving;
    }
  }
}
