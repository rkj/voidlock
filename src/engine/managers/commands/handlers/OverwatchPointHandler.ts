import type {
  Unit,
  Command,
  GameState,
  OverwatchPointCommand} from "@src/shared/types";
import {
  CommandType,
  UnitState,
  AIProfile
} from "@src/shared/types";
import type { ItemEffectHandler } from "@src/engine/interfaces/IDirector";
import type { IUnitCommandHandler } from "../IUnitCommandHandler";
import type { UnitCommandRegistry } from "../UnitCommandRegistry";

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
