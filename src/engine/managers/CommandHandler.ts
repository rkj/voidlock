import { GameState, Command, CommandType, Unit } from "../../shared/types";
import { UnitManager } from "./UnitManager";

export class CommandHandler {
  constructor(private unitManager: UnitManager) {}

  public applyCommand(state: GameState, cmd: Command) {
    if (state.status !== "Playing") return;

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
