import {
  GameState,
  Command,
  CommandType,
  UndeployUnitCommand,
} from "@src/shared/types";
import { IGlobalCommandHandler } from "../../IGlobalCommandHandler";

export class UndeployUnitHandler implements IGlobalCommandHandler {
  public type = CommandType.UNDEPLOY_UNIT;

  public handle(state: GameState, cmd: Command): void {
    const undeployCmd = cmd as UndeployUnitCommand;
    state.units = state.units.map((u) => {
      if (u.id === undeployCmd.unitId) {
        return { ...u, isDeployed: false };
      }
      return u;
    });
  }
}
