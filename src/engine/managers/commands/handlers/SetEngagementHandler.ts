import type {
  Unit,
  SetEngagementCommand} from "@src/shared/types";
import {
  CommandType
} from "@src/shared/types";
import type { IUnitCommandHandler, CommandExecParams } from "../IUnitCommandHandler";

export class SetEngagementHandler implements IUnitCommandHandler {
  public type = CommandType.SET_ENGAGEMENT;

  public execute({ unit, cmd }: CommandExecParams): Unit {
    const engagementCmd = cmd as SetEngagementCommand;
    const currentUnit = { ...unit };

    currentUnit.engagementPolicy = engagementCmd.mode;
    currentUnit.engagementPolicySource = "Manual";
    currentUnit.activeCommand = undefined;

    return currentUnit;
  }
}
