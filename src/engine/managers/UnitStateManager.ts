import type {
  GameState,
  Unit} from "../../shared/types";
import {
  UnitState,
  CommandType,
} from "../../shared/types";
import type { CommandExecutor } from "./CommandExecutor";
import type { StatsManager } from "./StatsManager";
import type { LootManager } from "./LootManager";
import type { IDirector } from "../interfaces/IDirector";

export interface ProcessChannelingParams {
  unit: Unit;
  state: GameState;
  realDt: number;
  lootManager: LootManager;
  director?: IDirector;
}

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
    director?: IDirector,
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
        updatedUnit = this.commandExecutor.executeCommand({
          unit: updatedUnit,
          cmd: nextCmd,
          state,
          isManual: true,
          director,
        });
      }
      return updatedUnit;
    }
    return unit;
  }

  /**
   * Handles timed actions (channeling) for a unit.
   */
  public processChanneling({
    unit,
    state,
    realDt,
    lootManager,
    director,
  }: ProcessChannelingParams): Unit {
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
    director?: IDirector,
  ): Unit {
    if (!unit.channeling) {
      return unit;
    }
    const { action } = unit.channeling;

    if (action === "Extract") return this.completeExtract(unit, state);
    if (action === "Collect") return this.completeCollect(unit, state);
    if (action === "Pickup") return this.completePickup(unit, state, lootManager);
    if (action === "UseItem") return this.completeUseItem(unit, state, director);

    return {
      ...unit,
      state: UnitState.Idle,
      channeling: undefined,
    };
  }

  private completeExtract(unit: Unit, state: GameState): Unit {
    if (unit.carriedObjectiveId) {
      const objectiveId = unit.carriedObjectiveId;
      state.objectives = state.objectives.map((o) =>
        o.id === objectiveId ? { ...o, state: "Completed" as const } : o,
      );
    }
    return {
      ...unit,
      state: UnitState.Extracted,
      channeling: undefined,
    };
  }

  private completeCollect(unit: Unit, state: GameState): Unit {
    let currentUnit = unit;
    const targetId = unit.channeling?.targetId;

    if (targetId) {
      const obj = state.objectives.find((o) => o.id === targetId);
      if (obj) {
        if (obj.id.startsWith("artifact")) {
          currentUnit = { ...currentUnit, carriedObjectiveId: obj.id };
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
  }

  private completePickup(unit: Unit, state: GameState, lootManager: LootManager): Unit {
    let currentUnit = unit;
    const targetId = unit.channeling?.targetId;

    if (!targetId) {
      return { ...currentUnit, state: UnitState.Idle, channeling: undefined };
    }

    const loot = state.loot?.find((l) => l.id === targetId);
    const objective = state.objectives?.find((o) => o.id === targetId);

    if (loot) {
      currentUnit = this.applyLootPickup(currentUnit, state, loot, lootManager);
    } else if (objective) {
      currentUnit = { ...currentUnit, carriedObjectiveId: objective.id };
      currentUnit = this.statsManager.recalculateStats(currentUnit);
    }

    return {
      ...currentUnit,
      state: UnitState.Idle,
      channeling: undefined,
    };
  }

  private applyLootPickup(
    unit: Unit,
    state: GameState,
    loot: { id: string; itemId: string; objectiveId?: string },
    lootManager: LootManager,
  ): Unit {
    let currentUnit = unit;
    if (loot.objectiveId) {
      currentUnit = { ...currentUnit, carriedObjectiveId: loot.objectiveId };
      currentUnit = this.statsManager.recalculateStats(currentUnit);
    } else {
      const itemId = loot.itemId;
      if (itemId !== "scrap_crate") {
        state.squadInventory[itemId] = (state.squadInventory[itemId] || 0) + 1;
      }
      lootManager.awardScrap(state, itemId);
    }
    lootManager.removeLoot(state, loot.id);
    return currentUnit;
  }

  private completeUseItem(
    unit: Unit,
    state: GameState,
    director?: IDirector,
  ): Unit {
    let currentUnit = unit;

    if (currentUnit.activeCommand?.type === CommandType.USE_ITEM) {
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
}
