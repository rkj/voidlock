import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  PickupCommand,
  Door,
} from "../../../shared/types";
import { BehaviorContext, ObjectiveContext, ExplorationContext } from "../../interfaces/AIContext";
import { PRNG } from "../../../shared/PRNG";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { Behavior, BehaviorResult } from "./Behavior";
import { SPEED_NORMALIZATION_CONST, ITEMS } from "../../config/GameConstants";
import { ItemEffectHandler } from "../../interfaces/IDirector";
import { GameGrid } from "../../GameGrid";
import { isMapFullyDiscovered } from "./BehaviorUtils";

export class InteractionBehavior implements Behavior<BehaviorContext & ObjectiveContext & ExplorationContext> {
  constructor(private gameGrid: GameGrid) {}

  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    _doors: Map<string, Door>,
    _prng: PRNG,
    context: BehaviorContext & ObjectiveContext & ExplorationContext,
    _director?: ItemEffectHandler,
  ): BehaviorResult {
    let currentUnit = { ...unit };
    if (currentUnit.state !== UnitState.Idle) {
      return { unit: currentUnit, handled: false };
    }

    // 1. Loot Interaction
    if (state.loot) {
      const loot = state.loot.find(
        (l) =>
          Math.abs(currentUnit.pos.x - l.pos.x) < ITEMS.INTERACTION_RADIUS &&
          Math.abs(currentUnit.pos.y - l.pos.y) < ITEMS.INTERACTION_RADIUS,
      );

      if (
        loot &&
        currentUnit.activeCommand?.type === CommandType.PICKUP &&
        (currentUnit.activeCommand as PickupCommand).lootId === loot.id
      ) {
        const baseTime = ITEMS.BASE_PICKUP_TIME;
        const duration =
          baseTime * (SPEED_NORMALIZATION_CONST / currentUnit.stats.speed);
        currentUnit = {
          ...currentUnit,
          state: UnitState.Channeling,
          channeling: {
            action: "Pickup",
            remaining: duration,
            totalDuration: duration,
            targetId: loot.id,
          },
          path: undefined,
          targetPos: undefined,
          activeCommand: undefined,
        };
        return { unit: currentUnit, handled: true };
      }
    }

    // 2. Objective Interaction
    if (
      currentUnit.archetypeId !== "vip" &&
      !currentUnit.carriedObjectiveId &&
      state.objectives
    ) {
      for (const obj of state.objectives) {
        if (obj.state === "Pending") {
          const isAtTarget =
            obj.targetCell &&
            MathUtils.sameCellPosition(currentUnit.pos, obj.targetCell);

          const isClaimedByMe =
            (currentUnit.activeCommand?.type === CommandType.PICKUP &&
              (currentUnit.activeCommand as PickupCommand).lootId === obj.id) ||
            context.claimedObjectives.get(obj.id) === currentUnit.id;

          if (
            isAtTarget &&
            (!context.claimedObjectives.has(obj.id) || isClaimedByMe)
          ) {
            const baseTime = ITEMS.BASE_COLLECT_TIME;
            const duration =
              baseTime * (SPEED_NORMALIZATION_CONST / currentUnit.stats.speed);
            currentUnit = {
              ...currentUnit,
              state: UnitState.Channeling,
              channeling: {
                action: "Collect",
                remaining: duration,
                totalDuration: duration,
                targetId: obj.id,
              },
              path: undefined,
              targetPos: undefined,
              activeCommand: undefined,
            };
            context.claimedObjectives.set(obj.id, currentUnit.id);
            return { unit: currentUnit, handled: true };
          }
        }
      }
    }

    // 3. Extraction Interaction
    if (state.map.extraction) {
      const ext = state.map.extraction;
      const allObjectivesReady = state.objectives
        .filter((o) => o.kind !== "Escort")
        .every((o) => {
          if (o.state === "Completed") return true;
          if (o.kind === "Recover") {
            return state.units.some((u) => u.carriedObjectiveId === o.id);
          }
          return false;
        });

      const isAtExtraction = MathUtils.sameCellPosition(currentUnit.pos, ext);

      const isVipAtExtraction =
        currentUnit.archetypeId === "vip" && isAtExtraction;

      const isExplicitExtract =
        currentUnit.activeCommand?.type === CommandType.EXTRACT;

      const isExploring = currentUnit.activeCommand?.type === CommandType.EXPLORE || 
                          currentUnit.activeCommand?.label === "Exploring";
      const isMapFinished = isMapFullyDiscovered(state, context.totalFloorCells, this.gameGrid);

      if (
        (allObjectivesReady || isVipAtExtraction || isExplicitExtract) &&
        isAtExtraction &&
        (isExplicitExtract || !currentUnit.aiEnabled || isMapFinished)
      ) {
        const baseTime = ITEMS.BASE_EXTRACT_TIME;
        const duration =
          baseTime * (SPEED_NORMALIZATION_CONST / currentUnit.stats.speed);
        currentUnit = {
          ...currentUnit,
          state: UnitState.Channeling,
          channeling: {
            action: "Extract",
            remaining: duration,
            totalDuration: duration,
          },
          path: undefined,
          targetPos: undefined,
          activeCommand: undefined,
        };
        return { unit: currentUnit, handled: true };
      }
    }

    // 4. Use Item Interaction
    if (currentUnit.activeCommand?.type === CommandType.USE_ITEM) {
      currentUnit = context.executeCommand(
        currentUnit,
        currentUnit.activeCommand,
        state,
        true,
        _director,
      );
      return { unit: currentUnit, handled: true };
    }

    return { unit: currentUnit, handled: false };
  }
}
