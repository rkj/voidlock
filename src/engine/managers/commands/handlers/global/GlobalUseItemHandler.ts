import {
  GameState,
  Command,
  CommandType,
  UseItemCommand,
  ItemLibrary,
} from "@src/shared/types";
import { IGlobalCommandHandler } from "../../IGlobalCommandHandler";
import { IDirector } from "@src/engine/interfaces/IDirector";
import { UnitManager } from "@src/engine/managers/UnitManager";

export class GlobalUseItemHandler implements IGlobalCommandHandler {
  public type = CommandType.USE_ITEM;

  constructor(
    private director: IDirector,
    private unitManager: UnitManager,
  ) {}

  public handle(state: GameState, cmd: Command): void {
    const useItemCmd = cmd as UseItemCommand;
    const item = ItemLibrary[useItemCmd.itemId];
    const isGlobal =
      item &&
      (item.action === "Heal" ||
        item.action === "Grenade" ||
        item.action === "Scanner");

    if (isGlobal && useItemCmd.unitIds.length === 0) {
      const count = state.squadInventory[useItemCmd.itemId] || 0;
      if (count > 0) {
        state.squadInventory[useItemCmd.itemId] = count - 1;
        this.director.handleUseItem(state, useItemCmd);
      }
      return;
    }

    const count = state.squadInventory[useItemCmd.itemId] || 0;
    if (count > 0) {
      state.units = state.units.map((unit) => {
        if (useItemCmd.unitIds.includes(unit.id)) {
          if (useItemCmd.queue) {
            return { ...unit, commandQueue: unit.commandQueue.concat(useItemCmd) };
          } else {
            const unitWithEmptyQueue = { ...unit, commandQueue: [] };
            return this.unitManager.executeCommand(
              unitWithEmptyQueue,
              useItemCmd,
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
