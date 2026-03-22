import type { Unit } from "@src/shared/types";
import {
  CommandType,
  UnitState,
} from "@src/shared/types";
import type { IUnitCommandHandler, CommandExecParams } from "../IUnitCommandHandler";

export class ExtractHandler implements IUnitCommandHandler {
  public type = CommandType.EXTRACT;

  public execute({ unit, cmd, state, isManual, registry, director }: CommandExecParams): Unit {
    let currentUnit = { ...unit };

    if (
      currentUnit.state !== UnitState.Extracted &&
      currentUnit.state !== UnitState.Dead
    ) {
      if (state.map.extraction) {
        currentUnit = registry.execute({
          unit: currentUnit,
          cmd: {
            type: CommandType.MOVE_TO,
            unitIds: [currentUnit.id],
            target: state.map.extraction,
            label: "Extracting",
          },
          state,
          isManual,
          director,
        });
        currentUnit.activeCommand = cmd;
      }
    }

    return currentUnit;
  }
}
