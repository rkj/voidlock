import { Unit, Command, GameState, CommandType } from "@src/shared/types";
import { IDirector } from "@src/engine/interfaces/IDirector";
import { UnitCommandRegistry } from "./UnitCommandRegistry";

export interface IUnitCommandHandler {
  type: CommandType;
  execute(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean,
    registry: UnitCommandRegistry,
    director?: IDirector,
  ): Unit;
}
