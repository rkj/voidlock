import type {
  GameState,
  Command,
  ToggleDebugOverlayCommand} from "@src/shared/types";
import {
  CommandType
} from "@src/shared/types";
import type { IGlobalCommandHandler } from "../../IGlobalCommandHandler";

export class ToggleDebugOverlayHandler implements IGlobalCommandHandler {
  public type = CommandType.TOGGLE_DEBUG_OVERLAY;

  public handle(state: GameState, cmd: Command): void {
    const toggleCmd = cmd as ToggleDebugOverlayCommand;
    state.settings = {
      ...state.settings,
      debugOverlayEnabled: toggleCmd.enabled,
    };
  }
}
