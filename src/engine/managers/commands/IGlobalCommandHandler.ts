import { GameState, Command, CommandType } from "@src/shared/types";

export interface IGlobalCommandHandler {
  type: CommandType;
  handle(state: GameState, cmd: Command): void;
}
