import type {
  GameState,
  Command,
  DeployUnitCommand} from "@src/shared/types";
import {
  CommandType
} from "@src/shared/types";
import type { IGlobalCommandHandler } from "../../IGlobalCommandHandler";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { MapUtils } from "@src/shared/utils/MapUtils";

export class DeployUnitHandler implements IGlobalCommandHandler {
  public type = CommandType.DEPLOY_UNIT;

  public handle(state: GameState, cmd: Command): void {
    const deployCmd = cmd as DeployUnitCommand;
    const unit = state.units.find((u) => u.id === deployCmd.unitId);
    if (unit && unit.archetypeId !== "vip") {
      // Validate that the target is a valid spawn tile
      const isValidSpawn = MapUtils.isValidSpawnPoint(state.map, deployCmd.target);

      if (!isValidSpawn) return;

      const targetCell = MathUtils.toCellCoord(deployCmd.target);
      const occupants = state.units.filter(
        (u) =>
          u.id !== unit.id &&
          u.archetypeId !== "vip" &&
          u.isDeployed !== false &&
          MathUtils.sameCellPosition(u.pos, targetCell),
      );

      const oldCell = MathUtils.toCellCoord(unit.pos);
      const wasDeployed = unit.isDeployed !== false;

      let occupantToDisplace = null;
      if (occupants.length >= 4) {
        occupantToDisplace = occupants[0];
      }

      state.units = state.units.map((u) => {
        if (u.id === unit.id) {
          return {
            ...u,
            pos: MathUtils.getCellCenter(deployCmd.target, u.visualJitter),
            isDeployed: true,
          };
        }
        if (u.id === occupantToDisplace?.id) {
          return {
            ...u,
            pos: wasDeployed ? MathUtils.getCellCenter(oldCell, u.visualJitter) : u.pos,
            isDeployed: wasDeployed,
          };
        }
        return u;
      });
    }
  }
}
