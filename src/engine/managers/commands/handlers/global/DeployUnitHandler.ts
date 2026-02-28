import {
  GameState,
  Command,
  CommandType,
  DeployUnitCommand,
} from "@src/shared/types";
import { IGlobalCommandHandler } from "../../IGlobalCommandHandler";
import { MathUtils } from "@src/shared/utils/MathUtils";

export class DeployUnitHandler implements IGlobalCommandHandler {
  public type = CommandType.DEPLOY_UNIT;

  public handle(state: GameState, cmd: Command): void {
    const deployCmd = cmd as DeployUnitCommand;
    const unit = state.units.find((u) => u.id === deployCmd.unitId);
    if (unit && unit.archetypeId !== "vip") {
      // Validate that the target is a valid spawn tile
      const isValidSpawn =
        state.map.squadSpawns?.some((s) =>
          MathUtils.sameCellPosition(s, deployCmd.target),
        ) ||
        (state.map.squadSpawn &&
          MathUtils.sameCellPosition(state.map.squadSpawn, deployCmd.target));

      if (!isValidSpawn) return;

      const targetCell = MathUtils.toCellCoord(deployCmd.target);
      const occupant = state.units.find(
        (u) =>
          u.id !== unit.id &&
          u.archetypeId !== "vip" &&
          MathUtils.sameCellPosition(u.pos, targetCell),
      );

      const oldCell = MathUtils.toCellCoord(unit.pos);

      state.units = state.units.map((u) => {
        if (u.id === unit.id) {
          return {
            ...u,
            pos: MathUtils.getCellCenter(deployCmd.target, u.visualJitter),
            isDeployed: true,
          };
        }
        if (occupant && u.id === occupant.id) {
          return {
            ...u,
            pos: MathUtils.getCellCenter(oldCell, u.visualJitter),
            isDeployed: true,
          };
        }
        return u;
      });
    }
  }
}
