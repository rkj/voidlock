import {
  GameState,
  Unit,
  UnitState,
  CommandType,
} from "../../shared/types";
import { CommandExecutor } from "./CommandExecutor";
import { StatsManager } from "./StatsManager";
import { LootManager } from "./LootManager";
import { ItemEffectHandler } from "../interfaces/IDirector";

/**
 * Handles unit state transitions, command queue processing, and channeling state.
 * Extracted from UnitManager to address SRP violation.
 */
export class UnitStateManager {
  constructor(
    private commandExecutor: CommandExecutor,
    private statsManager: StatsManager,
  ) {}

  /**
   * Processes the next command in the unit's queue if it's currently idle.
   */
  public processCommandQueue(
    unit: Unit,
    state: GameState,
    director?: ItemEffectHandler,
  ): Unit {
    if (
      unit.state === UnitState.Idle &&
      (!unit.activeCommand || unit.activeCommand.type === CommandType.EXPLORE) &&
      unit.commandQueue.length > 0
    ) {
      const nextCmd = unit.commandQueue[0];
      const nextQueue = unit.commandQueue.slice(1);
      let updatedUnit = { ...unit, commandQueue: nextQueue };
      if (nextCmd) {
        updatedUnit = this.commandExecutor.executeCommand(
          updatedUnit,
          nextCmd,
          state,
          true,
          director,
        );
      }
      return updatedUnit;
    }
    return unit;
  }

  /**
   * Handles timed actions (channeling) for a unit.
   */
  public processChanneling(
    unit: Unit,
    state: GameState,
    realDt: number,
    lootManager: LootManager,
    director?: ItemEffectHandler,
  ): Unit {
    if (unit.state !== UnitState.Channeling || !unit.channeling) {
      return unit;
    }

    const channeling = { ...unit.channeling };

    // 1. Validate target still exists
    if (channeling.targetId) {
      const targetId = channeling.targetId;
      const isLoot = state.loot?.some((l) => l.id === targetId);
      const isPendingObjective = state.objectives?.some(
        (o) => o.id === targetId && o.state === "Pending",
      );

      if (!isLoot && !isPendingObjective) {
        return {
          ...unit,
          state: UnitState.Idle,
          channeling: undefined,
        };
      }
    }

    // 2. Progress channeling time
    channeling.remaining -= realDt;

    // 3. Handle completion
    if (channeling.remaining <= 0) {
      return this.handleChannelingCompletion(
        { ...unit, channeling },
        state,
        lootManager,
        director,
      );
    }

    return { ...unit, channeling };
  }

  /**
   * Handles the logic for when a channeling action completes.
   */
  private handleChannelingCompletion(
    unit: Unit,
    state: GameState,
    lootManager: LootManager,
    director?: ItemEffectHandler,
  ): Unit {
    const channeling = unit.channeling!;
    let currentUnit = unit;

    if (channeling.action === "Extract") {
      if (currentUnit.carriedObjectiveId) {
        const objectiveId = currentUnit.carriedObjectiveId;
        state.objectives = state.objectives.map((o) =>
          o.id === objectiveId ? { ...o, state: "Completed" as const } : o,
        );
      }
      return {
        ...currentUnit,
        state: UnitState.Extracted,
        channeling: undefined,
      };
    } else if (channeling.action === "Collect") {
      if (channeling.targetId) {
        const targetId = channeling.targetId;
        const obj = state.objectives.find((o) => o.id === targetId);
        if (obj) {
          if (obj.id.startsWith("artifact")) {
            currentUnit = {
              ...currentUnit,
              carriedObjectiveId: obj.id,
            };
            currentUnit = this.statsManager.recalculateStats(currentUnit);
          } else {
            state.objectives = state.objectives.map((o) =>
              o.id === targetId ? { ...o, state: "Completed" as const } : o,
            );
          }
        }
      }
      return {
        ...currentUnit,
        state: UnitState.Idle,
        channeling: undefined,
      };
    } else if (channeling.action === "Pickup") {
      if (channeling.targetId) {
        const loot = state.loot?.find((l) => l.id === channeling.targetId);
        if (loot) {
          if (loot.objectiveId) {
            currentUnit = {
              ...currentUnit,
              carriedObjectiveId: loot.objectiveId,
            };
            currentUnit = this.statsManager.recalculateStats(currentUnit);
          } else {
            // Regular item
            const itemId = loot.itemId;
            if (itemId !== "scrap_crate") {
              state.squadInventory[itemId] =
                (state.squadInventory[itemId] || 0) + 1;
            }
            lootManager.awardScrap(state, itemId);
          }
          lootManager.removeLoot(state, loot.id);
        }
      }
      return {
        ...currentUnit,
        state: UnitState.Idle,
        channeling: undefined,
      };
    } else if (channeling.action === "UseItem") {
      if (
        currentUnit.activeCommand &&
        currentUnit.activeCommand.type === CommandType.USE_ITEM
      ) {
        const cmd = currentUnit.activeCommand;
        const count = state.squadInventory[cmd.itemId] || 0;
        if (count > 0) {
          state.squadInventory[cmd.itemId] = count - 1;
          if (director) {
            director.handleUseItem(state, cmd);
            // Sync back hp in case of self-heal (director mutates state.units)
            const mutated = state.units.find((u) => u.id === currentUnit.id);
            if (mutated) {
              currentUnit = { ...currentUnit, hp: mutated.hp };
            }
          }
        }
      }
      return {
        ...currentUnit,
        state: UnitState.Idle,
        channeling: undefined,
        activeCommand: undefined,
      };
    }

    return {
      ...currentUnit,
      state: UnitState.Idle,
      channeling: undefined,
    };
  }
}
