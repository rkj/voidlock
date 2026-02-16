import {
  Unit,
  Command,
  GameState,
  CommandType,
  SetEngagementCommand,
} from "@src/shared/types";
import { ItemEffectHandler } from "@src/engine/interfaces/IDirector";
import { IUnitCommandHandler } from "../IUnitCommandHandler";
import { UnitCommandRegistry } from "../UnitCommandRegistry";

export class SetEngagementHandler implements IUnitCommandHandler {
  public type = CommandType.SET_ENGAGEMENT;

  public execute(
    unit: Unit,
    cmd: Command,
    _state: GameState,
    _isManual: boolean,
    _registry: UnitCommandRegistry,
    _director?: ItemEffectHandler,
  ): Unit {
    const engagementCmd = cmd as SetEngagementCommand;
    let currentUnit = { ...unit };

    currentUnit.engagementPolicy = engagementCmd.mode;
    currentUnit.engagementPolicySource = "Manual";
    currentUnit.activeCommand = undefined;

    return currentUnit;
  }
}
