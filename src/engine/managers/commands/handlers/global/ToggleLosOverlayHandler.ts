import type {
  GameState,
  Command,
  ToggleLosOverlayCommand} from "@src/shared/types";
import {
  CommandType
} from "@src/shared/types";
import type { IGlobalCommandHandler } from "../../IGlobalCommandHandler";

export class ToggleLosOverlayHandler implements IGlobalCommandHandler {
  public type = CommandType.TOGGLE_LOS_OVERLAY;

  public handle(state: GameState, cmd: Command): void {
    const toggleCmd = cmd as ToggleLosOverlayCommand;
    state.settings = { ...state.settings, losOverlayEnabled: toggleCmd.enabled };
  }
}
