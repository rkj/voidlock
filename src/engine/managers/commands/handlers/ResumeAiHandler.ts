import type { Unit, Command, GameState} from "@src/shared/types";
import { CommandType } from "@src/shared/types";
import type { ItemEffectHandler } from "@src/engine/interfaces/IDirector";
import type { IUnitCommandHandler } from "../IUnitCommandHandler";
import type { UnitCommandRegistry } from "../UnitCommandRegistry";

export class ResumeAiHandler implements IUnitCommandHandler {
  public type = CommandType.RESUME_AI;

  public execute(
    unit: Unit,
    _cmd: Command,
    _state: GameState,
    _isManual: boolean,
    _registry: UnitCommandRegistry,
    _director?: ItemEffectHandler,
  ): Unit {
    const currentUnit = { ...unit };

    currentUnit.aiEnabled = true;
    currentUnit.activeCommand = undefined;

    return currentUnit;
  }
}
