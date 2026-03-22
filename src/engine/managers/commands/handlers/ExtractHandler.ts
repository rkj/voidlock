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

export class ExtractHandler implements IUnitCommandHandler {
  public type = CommandType.EXTRACT;

  public execute(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean,
    registry: UnitCommandRegistry,
    director?: ItemEffectHandler,
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
