import type {
  Unit,
  MoveCommand} from "@src/shared/types";
import {
  CommandType,
  UnitState
} from "@src/shared/types";
import type { IUnitCommandHandler, CommandExecParams } from "../IUnitCommandHandler";
import type { Pathfinder } from "@src/engine/Pathfinder";
import { MathUtils } from "@src/shared/utils/MathUtils";

export class MoveToHandler implements IUnitCommandHandler {
  public type = CommandType.MOVE_TO;

  constructor(private pathfinder: Pathfinder) {}

  public execute({ unit, cmd, isManual }: CommandExecParams): Unit {
    const moveCmd = cmd as MoveCommand;
    const currentUnit = { ...unit };

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
        currentUnit.targetPos = MathUtils.getCellCenter(path[0], currentUnit.visualJitter);
        currentUnit.state = UnitState.Moving;
      } else if (
        path?.length === 0 &&
        MathUtils.sameCellPosition(currentUnit.pos, moveCmd.target)
      ) {
        currentUnit.pos = MathUtils.getCellCenter(moveCmd.target, currentUnit.visualJitter);
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
