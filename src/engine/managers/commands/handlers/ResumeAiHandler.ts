import type { Unit } from "@src/shared/types";
import { CommandType } from "@src/shared/types";
import type { IUnitCommandHandler, CommandExecParams } from "../IUnitCommandHandler";

export class ResumeAiHandler implements IUnitCommandHandler {
  public type = CommandType.RESUME_AI;

  public execute({ unit }: CommandExecParams): Unit {
    const currentUnit = { ...unit };

    currentUnit.aiEnabled = true;
    currentUnit.activeCommand = undefined;

    return currentUnit;
  }
}
