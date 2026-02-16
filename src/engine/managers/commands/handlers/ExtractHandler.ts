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

export class ExtractHandler implements IUnitCommandHandler {
  public type = CommandType.EXTRACT;

  public execute(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean,
    registry: UnitCommandRegistry,
    director?: IDirector,
  ): Unit {
    let currentUnit = { ...unit };

    if (
      currentUnit.state !== UnitState.Extracted &&
      currentUnit.state !== UnitState.Dead
    ) {
      if (state.map.extraction) {
        currentUnit = registry.execute(
          currentUnit,
          {
            type: CommandType.MOVE_TO,
            unitIds: [currentUnit.id],
            target: state.map.extraction,
            label: "Extracting",
          },
          state,
          isManual,
          director,
        );
        currentUnit.activeCommand = cmd;
      }
    }

    return currentUnit;
  }
}
