import {
  Unit,
  Command,
  GameState,
  CommandType,
  UnitState,
} from "@src/shared/types";
import { IDirector } from "@src/engine/interfaces/IDirector";
import { IUnitCommandHandler } from "../IUnitCommandHandler";
import { UnitCommandRegistry } from "../UnitCommandRegistry";

export class EscortUnitHandler implements IUnitCommandHandler {
  public type = CommandType.ESCORT_UNIT;

  public execute(
    unit: Unit,
    cmd: Command,
    _state: GameState,
    _isManual: boolean,
    _registry: UnitCommandRegistry,
    _director?: IDirector,
  ): Unit {
    let currentUnit = { ...unit };

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
