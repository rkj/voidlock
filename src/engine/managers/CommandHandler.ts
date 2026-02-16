import {
  GameState,
  Command,
  CommandType,
  ItemLibrary,
} from "../../shared/types";
import { UnitManager } from "./UnitManager";
import { IDirector } from "../interfaces/IDirector";
import { MathUtils } from "../../shared/utils/MathUtils";

export class CommandHandler {
  constructor(
    private unitManager: UnitManager,
    private director: IDirector,
  ) {}

  public applyCommand(state: GameState, cmd: Command) {
    if (state.status !== "Playing" && state.status !== "Deployment") return;

    if (state.status === "Deployment") {
      if (cmd.type === CommandType.DEPLOY_UNIT) {
        const unit = state.units.find((u) => u.id === cmd.unitId);
        if (unit && unit.archetypeId !== "vip") {
          // Validate that the target is a valid spawn tile
          const isValidSpawn =
            state.map.squadSpawns?.some((s) =>
              MathUtils.sameCellPosition(s, cmd.target),
            ) ||
            (state.map.squadSpawn &&
              MathUtils.sameCellPosition(state.map.squadSpawn, cmd.target));

          if (!isValidSpawn) return;

          // Check if target is occupied by an already deployed unit
          const targetUnit = state.units.find((u) =>
            MathUtils.sameCellPosition(u.pos, cmd.target),
          );

          state.units = state.units.map((u) => {
            if (u.id === unit.id) {
              return {
                ...u,
                pos: { x: cmd.target.x, y: cmd.target.y },
                isDeployed: true,
              };
            }
            if (targetUnit && u.id === targetUnit.id) {
              // If swapping with a pending unit, the target unit becomes pending
              const wasDeployed = unit.isDeployed !== false;
              return {
                ...u,
                pos: { ...unit.pos },
                isDeployed: wasDeployed,
              };
            }
            return u;
          });
        }
        return;
      }

      if (cmd.type === CommandType.UNDEPLOY_UNIT) {
        state.units = state.units.map((u) => {
          if (u.id === cmd.unitId) {
            return { ...u, isDeployed: false };
          }
          return u;
        });
        return;
      }

      if (cmd.type === CommandType.START_MISSION) {
        state.status = "Playing";
        // Ensure all units are marked as deployed
        state.units = state.units.map((u) => ({ ...u, isDeployed: true }));

        // Auto-assign exploration if enabled (default behavior)
        const explorationUnitIds = state.units
          .filter((u) => u.archetypeId !== "vip" && u.aiEnabled !== false)
          .map((u) => u.id);

        if (explorationUnitIds.length > 0) {
          this.applyCommand(state, {
            type: CommandType.EXPLORE,
            unitIds: explorationUnitIds,
          });
        }
        return;
      }
    }

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
