import {
  GameState,
  Command,
  CommandType,
} from "@src/shared/types";
import { IGlobalCommandHandler } from "../../IGlobalCommandHandler";

export class DebugForceWinHandler implements IGlobalCommandHandler {
  public type = CommandType.DEBUG_FORCE_WIN;

  public handle(state: GameState, _cmd: Command): void {
    state.objectives = state.objectives.map((o) => ({
      ...o,
      state: "Completed" as const,
    }));
    state.status = "Won";
  }
}
