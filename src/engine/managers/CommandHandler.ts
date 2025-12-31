import {
  GameState,
  Command,
  CommandType,
  Unit,
  ItemLibrary,
  UseItemCommand,
} from "../../shared/types";
import { UnitManager } from "./UnitManager";

export class CommandHandler {
  constructor(private unitManager: UnitManager) {}

  public applyCommand(state: GameState, cmd: Command) {
    if (state.status !== "Playing") return;

    if (cmd.type === CommandType.USE_ITEM) {
      const count = state.squadInventory[cmd.itemId] || 0;
      if (count > 0) {
        state.squadInventory[cmd.itemId] = count - 1;
        this.executeGlobalItemEffect(state, cmd);
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

  private executeGlobalItemEffect(state: GameState, cmd: UseItemCommand) {
    const item = ItemLibrary[cmd.itemId];
    if (!item) return;

    if (item.action === "Heal") {
      if (cmd.target) {
        state.units.forEach((u) => {
          if (
            u.hp > 0 &&
            Math.floor(u.pos.x) === cmd.target!.x &&
            Math.floor(u.pos.y) === cmd.target!.y
          ) {
            u.hp = Math.min(u.maxHp, u.hp + 50);
          }
        });
      }
    } else if (item.action === "Grenade") {
      if (cmd.target) {
        state.enemies.forEach((e) => {
          const dx = e.pos.x - (cmd.target!.x + 0.5);
          const dy = e.pos.y - (cmd.target!.y + 0.5);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= 2.5) {
            e.hp -= 100;
          }
        });
      }
    }
  }
}
