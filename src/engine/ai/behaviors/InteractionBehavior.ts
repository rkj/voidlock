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
import { Behavior } from "./Behavior";
import { SPEED_NORMALIZATION_CONST } from "../../Constants";
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
  ): boolean {
    if (unit.state !== UnitState.Idle) {
      return false;
    }

    // 1. Loot Interaction
    if (state.loot) {
      const loot = state.loot.find(
        (l) =>
          Math.abs(unit.pos.x - l.pos.x) < 0.8 &&
          Math.abs(unit.pos.y - l.pos.y) < 0.8,
      );

      if (
        loot &&
        unit.activeCommand?.type === CommandType.PICKUP &&
        (unit.activeCommand as PickupCommand).lootId === loot.id
      ) {
        const baseTime = 3000;
        const duration =
          baseTime * (SPEED_NORMALIZATION_CONST / unit.stats.speed);
        unit.state = UnitState.Channeling;
        unit.channeling = {
          action: "Pickup",
          remaining: duration,
          totalDuration: duration,
          targetId: loot.id,
        };
        unit.path = undefined;
        unit.targetPos = undefined;
        unit.activeCommand = undefined;
        return true;
      }
    }

    // 2. Objective Interaction
    if (unit.archetypeId !== "vip" && state.objectives) {
      for (const obj of state.objectives) {
        if (obj.state === "Pending") {
          const isAtTarget =
            obj.targetCell &&
            Math.floor(unit.pos.x) === obj.targetCell.x &&
            Math.floor(unit.pos.y) === obj.targetCell.y;

          const isClaimedByMe =
            (unit.activeCommand?.type === CommandType.PICKUP &&
              (unit.activeCommand as PickupCommand).lootId === obj.id) ||
            context.claimedObjectives.get(obj.id) === unit.id;

          if (isAtTarget && (!context.claimedObjectives.has(obj.id) || isClaimedByMe)) {
            const baseTime = 3000;
            const duration =
              baseTime * (SPEED_NORMALIZATION_CONST / unit.stats.speed);
            unit.state = UnitState.Channeling;
            unit.channeling = {
              action: "Collect",
              remaining: duration,
              totalDuration: duration,
              targetId: obj.id,
            };
            context.claimedObjectives.set(obj.id, unit.id);
            unit.path = undefined;
            unit.targetPos = undefined;
            unit.activeCommand = undefined;
            return true;
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
        Math.floor(unit.pos.x) === ext.x && Math.floor(unit.pos.y) === ext.y;

      const isVipAtExtraction = unit.archetypeId === "vip" && isAtExtraction;

      const isExplicitExtract =
        unit.activeCommand?.type === CommandType.EXTRACT;

      if (
        (allObjectivesReady || isVipAtExtraction || isExplicitExtract) &&
        isAtExtraction
      ) {
        const baseTime = 5000;
        const duration =
          baseTime * (SPEED_NORMALIZATION_CONST / unit.stats.speed);
        unit.state = UnitState.Channeling;
        unit.channeling = {
          action: "Extract",
          remaining: duration,
          totalDuration: duration,
        };
        unit.path = undefined;
        unit.targetPos = undefined;
        unit.activeCommand = undefined;
        return true;
      }
    }

    // 4. Use Item Interaction
    if (unit.activeCommand?.type === CommandType.USE_ITEM) {
      context.executeCommand(unit, unit.activeCommand, state, true, _director);
      return true;
    }

    return false;
  }
}
