import type {
  Unit,
  Command,
  GameState} from "@src/shared/types";
import {
  CommandType,
  UnitState,
} from "@src/shared/types";
import type { ItemEffectHandler } from "@src/engine/interfaces/IDirector";
import type { IUnitCommandHandler } from "../IUnitCommandHandler";
import type { UnitCommandRegistry } from "../UnitCommandRegistry";

export class StopHandler implements IUnitCommandHandler {
  public type = CommandType.STOP;

  public execute(
    unit: Unit,
    _cmd: Command,
    _state: GameState,
    _isManual: boolean,
    _registry: UnitCommandRegistry,
    _director?: ItemEffectHandler,
  ): Unit {
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
