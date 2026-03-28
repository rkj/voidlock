import type { GameState, Command, CommandType } from "@src/shared/types";
import type { IGlobalCommandHandler } from "../../IGlobalCommandHandler";
import type { UnitManager } from "@src/engine/managers/UnitManager";
import type { IDirector } from "@src/engine/interfaces/IDirector";

export class UnitCommandApplier implements IGlobalCommandHandler {
  constructor(
    public type: CommandType,
    private unitManager: UnitManager,
    private director: IDirector,
  ) {}

  public handle(state: GameState, cmd: Command): void {
    if ("unitIds" in cmd) {
      state.units = state.units.map((unit) => {
        if (cmd.unitIds.includes(unit.id)) {
          if (cmd.queue) {
            return { ...unit, commandQueue: unit.commandQueue.concat(cmd) };
          } 
            const unitWithEmptyQueue = { ...unit, commandQueue: [] };
            return this.unitManager.executeCommand({
              unit: unitWithEmptyQueue,
              cmd,
              state,
              isManual: true,
              director: this.director,
            });
          
        }
        return unit;
      });
    }
  }
}
