import { CommandType, Command, GameState } from "@src/shared/types";
import { IGlobalCommandHandler } from "./IGlobalCommandHandler";

export class GlobalCommandRegistry {
  private handlers: Map<CommandType, IGlobalCommandHandler> = new Map();

  public register(handler: IGlobalCommandHandler): void {
    this.handlers.set(handler.type, handler);
  }

  public handle(state: GameState, cmd: Command): boolean {
    const handler = this.handlers.get(cmd.type);
    if (handler) {
      handler.handle(state, cmd);
      return true;
    }
    return false;
  }
}
