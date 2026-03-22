import type { Unit, Command, GameState, CommandType } from "@src/shared/types";
import type { ItemEffectHandler } from "@src/engine/interfaces/IDirector";
import type { UnitCommandRegistry } from "./UnitCommandRegistry";

export interface CommandExecParams {
  unit: Unit;
  cmd: Command;
  state: GameState;
  isManual: boolean;
  registry: UnitCommandRegistry;
  director?: ItemEffectHandler;
}

export interface IUnitCommandHandler {
  type: CommandType;
  execute(params: CommandExecParams): Unit;
}
