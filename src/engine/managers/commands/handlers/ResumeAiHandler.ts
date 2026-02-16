import { Unit, Command, GameState, CommandType } from "@src/shared/types";
import { IDirector } from "@src/engine/interfaces/IDirector";
import { IUnitCommandHandler } from "../IUnitCommandHandler";
import { UnitCommandRegistry } from "../UnitCommandRegistry";

export class ResumeAiHandler implements IUnitCommandHandler {
  public type = CommandType.RESUME_AI;

  public execute(
    unit: Unit,
    _cmd: Command,
    _state: GameState,
    _isManual: boolean,
    _registry: UnitCommandRegistry,
    _director?: IDirector,
  ): Unit {
    let currentUnit = { ...unit };

    currentUnit.aiEnabled = true;
    currentUnit.activeCommand = undefined;

    return currentUnit;
  }
}
