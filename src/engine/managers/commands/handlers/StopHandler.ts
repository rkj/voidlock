import type { Unit } from "@src/shared/types";
import {
  CommandType,
  UnitState,
} from "@src/shared/types";
import type { IUnitCommandHandler, CommandExecParams } from "../IUnitCommandHandler";

export class StopHandler implements IUnitCommandHandler {
  public type = CommandType.STOP;

  public execute({ unit }: CommandExecParams): Unit {
    const currentUnit = { ...unit };

    currentUnit.commandQueue = [];
    currentUnit.path = undefined;
    currentUnit.targetPos = undefined;
    currentUnit.forcedTargetId = undefined;
    currentUnit.explorationTarget = undefined;
    currentUnit.aiEnabled = false;
    currentUnit.activeCommand = undefined;

    if (currentUnit.state === UnitState.Channeling) {
      currentUnit.channeling = undefined;
    }
    currentUnit.state = UnitState.Idle;

    return currentUnit;
  }
}
