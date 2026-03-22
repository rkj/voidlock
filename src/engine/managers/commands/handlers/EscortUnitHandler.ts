import type { Unit } from "@src/shared/types";
import {
  CommandType,
  UnitState,
} from "@src/shared/types";
import type { IUnitCommandHandler, CommandExecParams } from "../IUnitCommandHandler";

export class EscortUnitHandler implements IUnitCommandHandler {
  public type = CommandType.ESCORT_UNIT;

  public execute({ unit, cmd }: CommandExecParams): Unit {
    const currentUnit = { ...unit };

    if (
      currentUnit.state !== UnitState.Extracted &&
      currentUnit.state !== UnitState.Dead
    ) {
      currentUnit.forcedTargetId = undefined;
      currentUnit.explorationTarget = undefined;
      if (currentUnit.state === UnitState.Channeling) {
        currentUnit.channeling = undefined;
        currentUnit.state = UnitState.Idle;
      }
      currentUnit.path = undefined;
      currentUnit.targetPos = undefined;
      currentUnit.aiEnabled = false;
      currentUnit.activeCommand = cmd;
    }

    return currentUnit;
  }
}
