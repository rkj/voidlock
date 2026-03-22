import type { Unit } from "@src/shared/types";
import {
  CommandType,
  UnitState,
} from "@src/shared/types";
import type { IUnitCommandHandler, CommandExecParams } from "../IUnitCommandHandler";

export class ExploreHandler implements IUnitCommandHandler {
  public type = CommandType.EXPLORE;

  public execute({ unit }: CommandExecParams): Unit {
    const currentUnit = { ...unit };

    if (
      currentUnit.state !== UnitState.Extracted &&
      currentUnit.state !== UnitState.Dead
    ) {
      currentUnit.aiEnabled = true;
      currentUnit.state = UnitState.Idle;
      currentUnit.path = undefined;
      currentUnit.targetPos = undefined;
      // Default exploration behavior will take over in update()
    }

    return currentUnit;
  }
}
