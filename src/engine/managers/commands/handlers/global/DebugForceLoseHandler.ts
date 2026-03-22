import type {
  GameState,
  Command} from "@src/shared/types";
import {
  CommandType,
} from "@src/shared/types";
import type { IGlobalCommandHandler } from "../../IGlobalCommandHandler";

export class DebugForceLoseHandler implements IGlobalCommandHandler {
  public type = CommandType.DEBUG_FORCE_LOSE;

  public handle(state: GameState, _cmd: Command): void {
    state.status = "Lost";
  }
}
