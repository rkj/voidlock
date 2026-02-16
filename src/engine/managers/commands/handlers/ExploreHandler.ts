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

export class ExploreHandler implements IUnitCommandHandler {
  public type = CommandType.EXPLORE;

  public execute(
    unit: Unit,
    _cmd: Command,
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
      currentUnit.aiEnabled = true;
      // Default exploration behavior will take over in update()
    }

    return currentUnit;
  }
}
