import { GameState, Command, CommandType } from "@src/shared/types";
import { IGlobalCommandHandler } from "../../IGlobalCommandHandler";
import { UnitManager } from "@src/engine/managers/UnitManager";
import { IDirector } from "@src/engine/interfaces/IDirector";

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
