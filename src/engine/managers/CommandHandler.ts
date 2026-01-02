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
        state.squadInventory[cmd.itemId] = count - 1;
        this.director.handleUseItem(state, cmd);
      }
      return;
    }

    if (
      cmd.type === CommandType.MOVE_TO ||
      cmd.type === CommandType.ATTACK_TARGET ||
      cmd.type === CommandType.SET_ENGAGEMENT ||
      cmd.type === CommandType.STOP ||
      cmd.type === CommandType.RESUME_AI
    ) {
      if (cmd.type === CommandType.ATTACK_TARGET) {
        const unit = state.units.find((u) => u.id === cmd.unitId);
        if (unit) {
          if (cmd.queue) {
            unit.commandQueue.push(cmd);
          } else {
            unit.commandQueue = [];
            this.unitManager.executeCommand(unit, cmd);
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
              this.unitManager.executeCommand(unit, cmd);
            }
          }
        });
      }
    }
  }
}
