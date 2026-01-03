import {
  GameState,
  Command,
  CommandType,
  Unit,
  ItemLibrary,
  UseItemCommand,
} from "../../shared/types";
import { UnitManager } from "./UnitManager";
import { Director } from "../Director";

export class CommandHandler {
  constructor(
    private unitManager: UnitManager,
    private director: Director,
  ) {}

  public applyCommand(state: GameState, cmd: Command) {
    if (state.status !== "Playing") return;

    if (cmd.type === CommandType.USE_ITEM) {
      const count = state.squadInventory[cmd.itemId] || 0;
      if (count > 0) {
        cmd.unitIds.forEach((id) => {
          const unit = state.units.find((u) => u.id === id);
          if (unit) {
            if (cmd.queue) {
              unit.commandQueue.push(cmd);
            } else {
              unit.commandQueue = [];
              this.unitManager.executeCommand(unit, cmd, state, true, this.director);
            }
          }
        });
      }
      return;
    }

    if (cmd.type === CommandType.TOGGLE_DEBUG_OVERLAY) {
      state.settings.debugOverlayEnabled = cmd.enabled;
      return;
    }

    if (cmd.type === CommandType.TOGGLE_LOS_OVERLAY) {
      state.settings.losOverlayEnabled = cmd.enabled;
      return;
    }

    if (
      cmd.type === CommandType.MOVE_TO ||
      cmd.type === CommandType.ATTACK_TARGET ||
      cmd.type === CommandType.SET_ENGAGEMENT ||
      cmd.type === CommandType.STOP ||
      cmd.type === CommandType.RESUME_AI ||
      cmd.type === CommandType.OVERWATCH_POINT ||
      cmd.type === CommandType.EXPLORE ||
      cmd.type === CommandType.PICKUP ||
      cmd.type === CommandType.ESCORT_UNIT ||
      cmd.type === CommandType.EXTRACT
    ) {
      if (cmd.type === CommandType.ATTACK_TARGET) {
        const unit = state.units.find((u) => u.id === cmd.unitId);
        if (unit) {
          if (cmd.queue) {
            unit.commandQueue.push(cmd);
          } else {
            unit.commandQueue = [];
            this.unitManager.executeCommand(unit, cmd, state, true, this.director);
          }
        }
      } else {
        cmd.unitIds.forEach((id) => {
          const unit = state.units.find((u) => u.id === id);
          if (unit) {
            if (cmd.queue) {
              unit.commandQueue.push(cmd);
            } else {
              unit.commandQueue = [];
              this.unitManager.executeCommand(unit, cmd, state, true, this.director);
            }
          }
        });
      }
    }
  }
}
