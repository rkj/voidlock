import type {
  GameState,
  Unit,
  Door} from "../../../shared/types";
import {
  UnitState,
  CommandType,
  MissionType
} from "../../../shared/types";
import type { BehaviorContext } from "../../interfaces/AIContext";
import type { PRNG } from "../../../shared/PRNG";
import { MathUtils } from "../../../shared/utils/MathUtils";
import type { Behavior, BehaviorResult } from "./Behavior";
import { SPEED_NORMALIZATION_CONST, ITEMS } from "../../config/GameConstants";
import type { ItemEffectHandler } from "../../interfaces/IDirector";
import { Logger } from "../../../shared/Logger";

export class InteractionBehavior implements Behavior<BehaviorContext> {
  constructor() {}

  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    _doors: Map<string, Door>,
    _prng: PRNG,
    context: BehaviorContext,
    _director?: ItemEffectHandler,
  ): BehaviorResult {
    let currentUnit = { ...unit };
    if (currentUnit.state !== UnitState.Idle && currentUnit.state !== UnitState.Attacking) {
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
        (currentUnit.activeCommand).lootId === loot.id
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
            Math.abs(currentUnit.pos.x - (obj.targetCell.x + 0.5)) < ITEMS.INTERACTION_RADIUS &&
            Math.abs(currentUnit.pos.y - (obj.targetCell.y + 0.5)) < ITEMS.INTERACTION_RADIUS;

          const hasExplicitPickup =
            currentUnit.activeCommand?.type === CommandType.PICKUP &&
            (currentUnit.activeCommand).lootId === obj.id;

          const isClaimedByMe =
            hasExplicitPickup ||
            (context.claimedObjectives?.get(obj.id) === currentUnit.id);

          // In Prologue, require an explicit PICKUP command — don't auto-collect
          // so the tutorial can teach the player to use the Pickup action manually.
          if (state.missionType === MissionType.Prologue && !hasExplicitPickup) {
            continue;
          }

          if (
            isAtTarget &&
            (!context.claimedObjectives || !context.claimedObjectives.has(obj.id) || isClaimedByMe)
          ) {
            Logger.info(`InteractionBehavior: Unit ${currentUnit.id} at target for objective ${obj.id}. Starting Pickup/Collect.`);
            
            // Only Artifacts and the Prologue Disk need to be carried to extraction.
            // Regular 'Recover' objectives (Intel) are completed immediately.
            const needsCarrying = obj.id.includes("artifact") || obj.id.includes("prologue-disk");
            
            const baseTime = needsCarrying ? ITEMS.BASE_PICKUP_TIME : ITEMS.BASE_COLLECT_TIME;
            const duration =
              baseTime * (SPEED_NORMALIZATION_CONST / currentUnit.stats.speed);
            currentUnit = {
              ...currentUnit,
              state: UnitState.Channeling,
              channeling: {
                action: needsCarrying ? "Pickup" : "Collect",
                remaining: duration,
                totalDuration: duration,
                targetId: obj.id,
              },
              path: undefined,
              targetPos: undefined,
              activeCommand: undefined,
            };
            if (context.claimedObjectives) {
                context.claimedObjectives.set(obj.id, currentUnit.id);
            }
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
        currentUnit.activeCommand?.type === CommandType.EXTRACT ||
        currentUnit.activeCommand?.label === "Extracting";

      const isLowHP = currentUnit.hp < currentUnit.maxHp * 0.25;
      const isMapFullyDiscovered = state.discoveredCells.length >= context.totalFloorCells;

      if (
        isAtExtraction &&
        ((allObjectivesReady && (isMapFullyDiscovered || !currentUnit.aiEnabled)) || 
         isVipAtExtraction || isExplicitExtract || isLowHP)
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
