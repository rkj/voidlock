import {
  Unit,
  Command,
  GameState,
  CommandType,
  UnitState,
  PickupCommand,
} from "@src/shared/types";
import { ItemEffectHandler } from "@src/engine/interfaces/IDirector";
import { IUnitCommandHandler } from "../IUnitCommandHandler";
import { UnitCommandRegistry } from "../UnitCommandRegistry";
import { MathUtils } from "@src/shared/utils/MathUtils";

export class PickupHandler implements IUnitCommandHandler {
  public type = CommandType.PICKUP;

  public execute(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean,
    registry: UnitCommandRegistry,
    director?: ItemEffectHandler,
  ): Unit {
    const pickupCmd = cmd as PickupCommand;
    let currentUnit = { ...unit };

    if (
      currentUnit.state !== UnitState.Extracted &&
      currentUnit.state !== UnitState.Dead
    ) {
      const loot = state.loot?.find((l) => l.id === pickupCmd.lootId);
      const objective = state.objectives?.find((o) => o.id === pickupCmd.lootId);
      if (loot) {
        currentUnit = registry.execute(
          currentUnit,
          {
            type: CommandType.MOVE_TO,
            unitIds: [currentUnit.id],
            target: MathUtils.toCellCoord(loot.pos),
            label: "Picking Up",
          },
          state,
          isManual,
          director,
        );
        currentUnit.activeCommand = pickupCmd;
      } else if (objective && objective.targetCell) {
        currentUnit = registry.execute(
          currentUnit,
          {
            type: CommandType.MOVE_TO,
            unitIds: [currentUnit.id],
            target: objective.targetCell,
            label: "Picking Up",
          },
          state,
          isManual,
          director,
        );
        currentUnit.activeCommand = pickupCmd;
      }
    }

    return currentUnit;
  }
}
