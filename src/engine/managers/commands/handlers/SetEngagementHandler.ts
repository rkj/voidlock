import type {
  Unit,
  Command,
  GameState,
  SetEngagementCommand} from "@src/shared/types";
import {
  CommandType
} from "@src/shared/types";
import type { ItemEffectHandler } from "@src/engine/interfaces/IDirector";
import type { IUnitCommandHandler } from "../IUnitCommandHandler";
import type { UnitCommandRegistry } from "../UnitCommandRegistry";

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
    const currentUnit = { ...unit };

    currentUnit.engagementPolicy = engagementCmd.mode;
    currentUnit.engagementPolicySource = "Manual";
    currentUnit.activeCommand = undefined;

    return currentUnit;
  }
}
