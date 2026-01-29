import {
  GameState,
  Command,
  CommandType,
  ItemLibrary,
} from "../../shared/types";
import { UnitManager } from "./UnitManager";
import { IDirector } from "../interfaces/IDirector";

export class CommandHandler {
  constructor(
    private unitManager: UnitManager,
    private director: IDirector,
  ) {}

  public applyCommand(state: GameState, cmd: Command) {
    if (state.status !== "Playing") return;

    if (cmd.type === CommandType.USE_ITEM) {
      const item = ItemLibrary[cmd.itemId];
      const isGlobal =
        item &&
        (item.action === "Heal" ||
          item.action === "Grenade" ||
          item.action === "Scanner");

      if (isGlobal && cmd.unitIds.length === 0) {
        const count = state.squadInventory[cmd.itemId] || 0;
        if (count > 0) {
          state.squadInventory[cmd.itemId] = count - 1;
          this.director.handleUseItem(state, cmd);
        }
        return;
      }

      const count = state.squadInventory[cmd.itemId] || 0;
      if (count > 0) {
        state.units = state.units.map((unit) => {
          if (cmd.unitIds.includes(unit.id)) {
            if (cmd.queue) {
              return { ...unit, commandQueue: unit.commandQueue.concat(cmd) };
            } else {
              const unitWithEmptyQueue = { ...unit, commandQueue: [] };
              return this.unitManager.executeCommand(
                unitWithEmptyQueue,
                cmd,
                state,
                true,
                this.director,
              );
            }
          }
          return unit;
        });
      }
      return;
    }

    if (cmd.type === CommandType.TOGGLE_DEBUG_OVERLAY) {
      state.settings = { ...state.settings, debugOverlayEnabled: cmd.enabled };
      return;
    }

    if (cmd.type === CommandType.TOGGLE_LOS_OVERLAY) {
      state.settings = { ...state.settings, losOverlayEnabled: cmd.enabled };
      return;
    }

    if (cmd.type === CommandType.DEBUG_FORCE_WIN) {
      state.objectives = state.objectives.map((o) => ({
        ...o,
        state: "Completed" as const,
      }));
      state.status = "Won";
      return;
    }

    if (cmd.type === CommandType.DEBUG_FORCE_LOSE) {
      state.status = "Lost";
      return;
    }

    if (
      cmd.type === CommandType.MOVE_TO ||
      cmd.type === CommandType.SET_ENGAGEMENT ||
      cmd.type === CommandType.STOP ||
      cmd.type === CommandType.RESUME_AI ||
      cmd.type === CommandType.OVERWATCH_POINT ||
      cmd.type === CommandType.EXPLORE ||
      cmd.type === CommandType.PICKUP ||
      cmd.type === CommandType.ESCORT_UNIT ||
      cmd.type === CommandType.EXTRACT
    ) {
      state.units = state.units.map((unit) => {
        if (cmd.unitIds.includes(unit.id)) {
          if (cmd.queue) {
            return { ...unit, commandQueue: unit.commandQueue.concat(cmd) };
          } else {
            const unitWithEmptyQueue = { ...unit, commandQueue: [] };
            return this.unitManager.executeCommand(
              unitWithEmptyQueue,
              cmd,
              state,
              true,
              this.director,
            );
          }
        }
        return unit;
      });
    }
  }
}