import type {
  Unit,
  OverwatchPointCommand} from "@src/shared/types";
import {
  CommandType,
  UnitState,
  AIProfile
} from "@src/shared/types";
import type { IUnitCommandHandler, CommandExecParams } from "../IUnitCommandHandler";

export class OverwatchPointHandler implements IUnitCommandHandler {
  public type = CommandType.OVERWATCH_POINT;

  public execute({ unit, cmd, state, isManual, registry, director }: CommandExecParams): Unit {
    const overwatchCmd = cmd as OverwatchPointCommand;
    let currentUnit = { ...unit };

    if (
      currentUnit.state !== UnitState.Extracted &&
      currentUnit.state !== UnitState.Dead
    ) {
      currentUnit.aiEnabled = false;
      currentUnit.aiProfile = AIProfile.STAND_GROUND;
      currentUnit = registry.execute({
        unit: currentUnit,
        cmd: {
          type: CommandType.MOVE_TO,
          unitIds: [currentUnit.id],
          target: overwatchCmd.target,
          label: "Overwatching",
        },
        state,
        isManual,
        director,
      });
      currentUnit.activeCommand = overwatchCmd;
    }

    return currentUnit;
  }
}
