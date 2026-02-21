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

      const unitAtTarget = state.units.find(
        (u) =>
          u.isDeployed && MathUtils.sameCellPosition(u.pos, deployCmd.target),
      );

      state.units = state.units.map((u) => {
        if (u.id === unit.id) {
          return {
            ...u,
            pos: { x: deployCmd.target.x, y: deployCmd.target.y },
            isDeployed: true,
          };
        }
        if (unitAtTarget && u.id === unitAtTarget.id) {
          return {
            ...u,
            pos: { x: unit.pos.x, y: unit.pos.y },
          };
        }
        return u;
      });
    }
  }
}
