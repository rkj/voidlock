import {
  GameState,
  Command,
  CommandType,
  ToggleLosOverlayCommand,
} from "@src/shared/types";
import { IGlobalCommandHandler } from "../../IGlobalCommandHandler";

export class ToggleLosOverlayHandler implements IGlobalCommandHandler {
  public type = CommandType.TOGGLE_LOS_OVERLAY;

  public handle(state: GameState, cmd: Command): void {
    const toggleCmd = cmd as ToggleLosOverlayCommand;
    state.settings = { ...state.settings, losOverlayEnabled: toggleCmd.enabled };
  }
}
