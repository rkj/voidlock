import { CommandType, Unit, Command, GameState } from "@src/shared/types";
import { IDirector } from "@src/engine/interfaces/IDirector";
import { IUnitCommandHandler } from "./IUnitCommandHandler";

export class UnitCommandRegistry {
  private handlers: Map<CommandType, IUnitCommandHandler> = new Map();

  public register(handler: IUnitCommandHandler): void {
    this.handlers.set(handler.type, handler);
  }

  public execute(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean,
    director?: IDirector,
  ): Unit {
    const handler = this.handlers.get(cmd.type);
    if (handler) {
      return handler.execute(unit, cmd, state, isManual, this, director);
    }
    return unit;
  }
}
