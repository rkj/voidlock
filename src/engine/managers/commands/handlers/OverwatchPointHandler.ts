import {
  Unit,
  Command,
  GameState,
  CommandType,
  UnitState,
  AIProfile,
  OverwatchPointCommand,
} from "@src/shared/types";
import { ItemEffectHandler } from "@src/engine/interfaces/IDirector";
import { IUnitCommandHandler } from "../IUnitCommandHandler";
import { UnitCommandRegistry } from "../UnitCommandRegistry";

export class OverwatchPointHandler implements IUnitCommandHandler {
  public type = CommandType.OVERWATCH_POINT;

  public execute(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean,
    registry: UnitCommandRegistry,
    director?: ItemEffectHandler,
  ): Unit {
    const overwatchCmd = cmd as OverwatchPointCommand;
    let currentUnit = { ...unit };

    if (
      currentUnit.state !== UnitState.Extracted &&
      currentUnit.state !== UnitState.Dead
    ) {
      currentUnit.aiEnabled = false;
      currentUnit.aiProfile = AIProfile.STAND_GROUND;
      currentUnit = registry.execute(
        currentUnit,
        {
          type: CommandType.MOVE_TO,
          unitIds: [currentUnit.id],
          target: overwatchCmd.target,
          label: "Overwatching",
        },
        state,
        isManual,
        director,
      );
      currentUnit.activeCommand = overwatchCmd;
    }

    return currentUnit;
  }
}
