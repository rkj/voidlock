import type {
  Unit,
  PickupCommand} from "@src/shared/types";
import {
  CommandType,
  UnitState
} from "@src/shared/types";
import type { IUnitCommandHandler, CommandExecParams } from "../IUnitCommandHandler";
import { MathUtils } from "@src/shared/utils/MathUtils";

export class PickupHandler implements IUnitCommandHandler {
  public type = CommandType.PICKUP;

  public execute({ unit, cmd, state, isManual, registry, director }: CommandExecParams): Unit {
    const pickupCmd = cmd as PickupCommand;
    let currentUnit = { ...unit };

    if (
      currentUnit.state !== UnitState.Extracted &&
      currentUnit.state !== UnitState.Dead
    ) {
      const loot = state.loot?.find((l) => l.id === pickupCmd.lootId);
      const objective = state.objectives?.find((o) => o.id === pickupCmd.lootId);
      if (loot) {
        currentUnit = registry.execute({
          unit: currentUnit,
          cmd: {
            type: CommandType.MOVE_TO,
            unitIds: [currentUnit.id],
            target: MathUtils.toCellCoord(loot.pos),
            label: pickupCmd.label || "Picking up",
          },
          state,
          isManual,
          director,
        });
        currentUnit.activeCommand = pickupCmd;
      } else if (objective?.targetCell) {
        currentUnit = registry.execute({
          unit: currentUnit,
          cmd: {
            type: CommandType.MOVE_TO,
            unitIds: [currentUnit.id],
            target: objective.targetCell,
            label: pickupCmd.label || "Recovering",
          },
          state,
          isManual,
          director,
        });
        currentUnit.activeCommand = pickupCmd;
      }
    }

    return currentUnit;
  }
}
