import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  PickupCommand,
  Door,
} from "../../../shared/types";
import { AIContext } from "../../managers/UnitAI";
import { PRNG } from "../../../shared/PRNG";
import { Behavior, BehaviorResult } from "./Behavior";
import { SPEED_NORMALIZATION_CONST, ITEMS } from "../../config/GameConstants";
import { IDirector } from "../../interfaces/IDirector";

export class InteractionBehavior implements Behavior {
  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    _doors: Map<string, Door>,
    _prng: PRNG,
    context: AIContext,
    _director?: IDirector,
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
    if (currentUnit.archetypeId !== "vip" && state.objectives) {
      for (const obj of state.objectives) {
        if (obj.state === "Pending") {
          const isAtTarget =
            obj.targetCell &&
            Math.floor(currentUnit.pos.x) === obj.targetCell.x &&
            Math.floor(currentUnit.pos.y) === obj.targetCell.y;

          const isClaimedByMe =
            (currentUnit.activeCommand?.type === CommandType.PICKUP &&
              (currentUnit.activeCommand as PickupCommand).lootId === obj.id) ||
            context.claimedObjectives.get(obj.id) === currentUnit.id;

          if (isAtTarget && (!context.claimedObjectives.has(obj.id) || isClaimedByMe)) {
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

      const isAtExtraction =
        Math.floor(currentUnit.pos.x) === ext.x && Math.floor(currentUnit.pos.y) === ext.y;

      const isVipAtExtraction = currentUnit.archetypeId === "vip" && isAtExtraction;

      const isExplicitExtract =
        currentUnit.activeCommand?.type === CommandType.EXTRACT;

      if (
        (allObjectivesReady || isVipAtExtraction || isExplicitExtract) &&
        isAtExtraction
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
      currentUnit = context.executeCommand(currentUnit, currentUnit.activeCommand, state, true, _director);
      return { unit: currentUnit, handled: true };
    }

    return { unit: currentUnit, handled: false };
  }
}