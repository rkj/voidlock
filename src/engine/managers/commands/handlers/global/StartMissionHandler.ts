import type {
  GameState,
  Command,
  ExploreCommand} from "@src/shared/types";
import {
  CommandType
} from "@src/shared/types";
import type { IGlobalCommandHandler } from "../../IGlobalCommandHandler";
import type { UnitManager } from "@src/engine/managers/UnitManager";

export class StartMissionHandler implements IGlobalCommandHandler {
  public type = CommandType.START_MISSION;

  constructor(private unitManager: UnitManager) {}

  public handle(state: GameState, _cmd: Command): void {
    state.status = "Playing";
    // Ensure all units are marked as deployed
    state.units = state.units.map((u) => ({ ...u, isDeployed: true }));

    // Auto-assign exploration if enabled (default behavior)
    const explorationUnitIds = state.units
      .filter((u) => u.archetypeId !== "vip" && u.aiEnabled !== false)
      .map((u) => u.id);

    if (explorationUnitIds.length > 0) {
      const exploreCmd: ExploreCommand = {
        type: CommandType.EXPLORE,
        unitIds: explorationUnitIds,
      };
      state.units = state.units.map((unit) => {
        if (explorationUnitIds.includes(unit.id)) {
          return this.unitManager.executeCommand({
            unit: { ...unit, commandQueue: [] },
            cmd: exploreCmd,
            state,
            isManual: true,
          });
        }
        return unit;
      });
    }
  }
}
