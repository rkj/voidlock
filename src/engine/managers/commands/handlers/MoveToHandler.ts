import {
  Unit,
  Command,
  GameState,
  CommandType,
  UnitState,
  MoveCommand,
} from "@src/shared/types";
import { IDirector } from "@src/engine/interfaces/IDirector";
import { IUnitCommandHandler } from "../IUnitCommandHandler";
import { Pathfinder } from "@src/engine/Pathfinder";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { MOVEMENT } from "@src/engine/config/GameConstants";
import { UnitCommandRegistry } from "../UnitCommandRegistry";

export class MoveToHandler implements IUnitCommandHandler {
  public type = CommandType.MOVE_TO;

  constructor(private pathfinder: Pathfinder) {}

  public execute(
    unit: Unit,
    cmd: Command,
    _state: GameState,
    isManual: boolean,
    _registry: UnitCommandRegistry,
    _director?: IDirector,
  ): Unit {
    const moveCmd = cmd as MoveCommand;
    let currentUnit = { ...unit };

    if (
      currentUnit.state !== UnitState.Extracted &&
      currentUnit.state !== UnitState.Dead
    ) {
      currentUnit.forcedTargetId = undefined;
      // Clear exploration target if this is a manual command OR an autonomous command that isn't exploration
      if (isManual || moveCmd.label !== "Exploring") {
        currentUnit.explorationTarget = undefined;
      }

      if (currentUnit.state === UnitState.Channeling) {
        currentUnit.channeling = undefined;
        currentUnit.state = UnitState.Idle;
      }

      const path = this.pathfinder.findPath(
        MathUtils.toCellCoord(currentUnit.pos),
        moveCmd.target,
        true,
      );
      if (path && path.length > 0) {
        currentUnit.path = path;
        currentUnit.targetPos = {
          x:
            path[0].x +
            MOVEMENT.CENTER_OFFSET +
            (currentUnit.visualJitter?.x || 0),
          y:
            path[0].y +
            MOVEMENT.CENTER_OFFSET +
            (currentUnit.visualJitter?.y || 0),
        };
        currentUnit.state = UnitState.Moving;
      } else if (
        path &&
        path.length === 0 &&
        MathUtils.sameCellPosition(currentUnit.pos, moveCmd.target)
      ) {
        currentUnit.pos = {
          x:
            moveCmd.target.x +
            MOVEMENT.CENTER_OFFSET +
            (currentUnit.visualJitter?.x || 0),
          y:
            moveCmd.target.y +
            MOVEMENT.CENTER_OFFSET +
            (currentUnit.visualJitter?.y || 0),
        };
        currentUnit.path = undefined;
        currentUnit.targetPos = undefined;
        currentUnit.state = UnitState.Idle;
        currentUnit.activeCommand = undefined;
      } else {
        currentUnit.path = undefined;
        currentUnit.targetPos = undefined;
        currentUnit.state = UnitState.Idle;
        currentUnit.activeCommand = undefined;
      }
    }

    return currentUnit;
  }
}
