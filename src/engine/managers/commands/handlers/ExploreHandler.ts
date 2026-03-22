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

export class ExploreHandler implements IUnitCommandHandler {
  public type = CommandType.EXPLORE;

  public execute(
    unit: Unit,
    _cmd: Command,
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
      currentUnit.aiEnabled = true;
      currentUnit.state = UnitState.Idle;
      currentUnit.path = undefined;
      currentUnit.targetPos = undefined;
      // Default exploration behavior will take over in update()
    }

    return currentUnit;
  }
}
