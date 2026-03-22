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

export class EscortUnitHandler implements IUnitCommandHandler {
  public type = CommandType.ESCORT_UNIT;

  public execute(
    unit: Unit,
    cmd: Command,
    _state: GameState,
    _isManual: boolean,
    _registry: UnitCommandRegistry,
    _director?: ItemEffectHandler,
  ): Unit {
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
