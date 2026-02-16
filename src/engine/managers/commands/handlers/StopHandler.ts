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

export class StopHandler implements IUnitCommandHandler {
  public type = CommandType.STOP;

  public execute(
    unit: Unit,
    _cmd: Command,
    _state: GameState,
    _isManual: boolean,
    _registry: UnitCommandRegistry,
    _director?: IDirector,
  ): Unit {
    let currentUnit = { ...unit };

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
